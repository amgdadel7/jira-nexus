'use strict';

const crypto = require('crypto');
const { bad, notFound } = require('../../shared/errors');
const { clampInt } = require('../../shared/validation');
const { HISTORY_LABEL } = require('../../domain/issue');

const EVENTS = {
  'jira:issue_created': 'Work item created',
  'jira:issue_updated': 'Work item updated',
  'jira:issue_deleted': 'Work item deleted',
  comment_created: 'Comment created',
  worklog_created: 'Work logged',
  sprint_started: 'Sprint started',
  sprint_closed: 'Sprint completed',
  'jira:version_released': 'Version released',
};
/** Domain event → Jira-compatible webhook event name. */
const EVENT_MAP = {
  issue_created: 'jira:issue_created', issue_updated: 'jira:issue_updated', issue_deleted: 'jira:issue_deleted',
  comment_created: 'comment_created', worklog_created: 'worklog_created', sprint_started: 'sprint_started',
  sprint_closed: 'sprint_closed', version_released: 'jira:version_released',
};

const display = (value) => (Array.isArray(value) ? value.join(', ') : value == null ? null : String(value));

/**
 * Outgoing webhooks (site admin): CRUD, delivery log, test ping and redelivery,
 * plus the dispatcher that turns domain events into signed HTTP POSTs with
 * retries (5xx / 429 / network errors).
 */
class WebhookService {
  constructor({ audit, config, webhookRepo, issueRepo, userRepo, projectRepo, voteRepo, issueQuery, webhookSender, logger = console }) {
    Object.assign(this, {
      audit, issueQuery, logger, sender: webhookSender, repo: webhookRepo,
      issues: issueRepo, users: userRepo, projects: projectRepo, votes: voteRepo,
    });
    this.baseUrl = config.publicUrl || '';
    this.retryDelays = config.webhookRetryDelays || [2000, 8000];
  }

  static get EVENTS() {
    return EVENTS;
  }

  start(bus) {
    bus.subscribe((event, data) => this.dispatch(event, data));
    return this;
  }

  /* ---------- admin ---------- */
  async withStats(hooks) {
    const stats = await this.repo.stats(hooks.map((h) => h.id));
    return hooks.map((h) => ({ ...h, stats: stats.get(h.id) || null }));
  }

  async load(id) {
    const hook = await this.repo.find(id);
    if (!hook) throw notFound('Webhook not found.');
    return hook;
  }

  async list() {
    return { webhooks: await this.withStats(await this.repo.list()), events: EVENTS };
  }

  async clean(actor, body, partial = false) {
    const out = {};
    if (!partial || body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Give the webhook a name.');
      out.name = name.slice(0, 255);
    }
    if (!partial || body.url !== undefined) {
      let url;
      try { url = new URL(String(body.url || '')); } catch { throw bad('Enter a valid URL, like https://example.com/hooks/masar.'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw bad('Webhook URLs must start with http:// or https://.');
      out.url = url.toString();
    }
    if (!partial || body.events !== undefined) {
      const events = Array.isArray(body.events) ? [...new Set(body.events)] : [];
      if (!events.length) throw bad('Choose at least one event.');
      const unknown = events.find((e) => !EVENTS[e]);
      if (unknown) throw bad(`Unknown event '${unknown}'.`);
      out.events = events;
    }
    if (body.jql !== undefined) {
      const jql = String(body.jql || '').trim();
      if (jql) {
        try { await this.issueQuery.compile(actor, jql); } catch (err) { throw bad(`JQL: ${err.message}`); }
      }
      out.jql = jql;
    }
    if (body.secret !== undefined) out.secret = String(body.secret || '').slice(0, 255);
    if (body.enabled !== undefined) out.enabled = Boolean(body.enabled);
    return out;
  }

  async create(actor, body = {}) {
    const fields = await this.clean(actor, body);
    const hook = await this.repo.insert({ secret: '', jql: '', enabled: true, ...fields, created_by: actor.id });
    await this.audit.record(actor, 'webhook.created', { target: hook.name, details: { url: hook.url } });
    return (await this.withStats([hook]))[0];
  }

  async update(actor, id, body = {}) {
    const hook = await this.load(id);
    const fields = await this.clean(actor, body, true);
    const updated = Object.keys(fields).length ? await this.repo.update(hook.id, fields) : hook;
    await this.audit.record(actor, 'webhook.updated', { target: updated.name, details: { fields: Object.keys(fields).filter((f) => f !== 'secret') } });
    return (await this.withStats([updated]))[0];
  }

  async remove(actor, id) {
    const hook = await this.load(id);
    await this.repo.delete(hook.id);
    await this.audit.record(actor, 'webhook.deleted', { target: hook.name });
    return { ok: true };
  }

  async deliveries(id, limit) {
    const hook = await this.load(id);
    return this.repo.deliveries(hook.id, clampInt(limit, 50, 1, 200));
  }

  async delivery(id) {
    const d = await this.repo.findDelivery(id);
    if (!d) throw notFound('Delivery not found.');
    return d;
  }

  async test(actor, id) {
    const hook = await this.load(id);
    const payload = {
      timestamp: Date.now(), webhookEvent: 'ping', user: await this.userRef(actor.id),
      webhook: { id: hook.id, name: hook.name, events: hook.events }, message: 'This is a test delivery from Masar.',
    };
    return this.deliveryResult(await this.send(hook, 'ping', payload));
  }

  async redeliver(id) {
    const d = await this.delivery(id);
    const hook = await this.load(d.webhook_id);
    const attempt = 1 + ((await this.repo.lastAttempt(d.uuid)) || 0);
    return this.deliveryResult(await this.send(hook, d.event, d.payload, { attempt, uuid: d.uuid }));
  }

  deliveryResult(out) {
    return { ok: Boolean(out?.ok), status: out?.status ?? null, error: out?.error ?? null, delivery: out?.delivery || null };
  }

  /* ---------- delivery ---------- */
  async send(hook, event, payload, { attempt = 1, uuid = crypto.randomUUID(), retry = false } = {}) {
    const body = JSON.stringify(payload);
    const result = await this.sender.post({ url: hook.url, secret: hook.secret, event, uuid, body });
    const delivery = await this.repo.recordDelivery({ webhookId: hook.id, uuid, event, body, attempt, ...result });
    if (!delivery) return null;
    const retryable = !result.ok && (result.status === null || result.status >= 500 || result.status === 429);
    if (retry && retryable && attempt <= this.retryDelays.length) {
      setTimeout(async () => {
        const still = await this.repo.find(hook.id).catch(() => null);
        if (still?.enabled) await this.send(still, event, payload, { attempt: attempt + 1, uuid, retry: true }).catch(() => {});
      }, this.retryDelays[attempt - 1]).unref?.();
    }
    return { ...result, delivery };
  }

  async userRef(id) {
    if (!id) return null;
    const u = await this.users.findById(id);
    return u ? { accountId: u.id, displayName: u.name, emailAddress: u.email } : null;
  }

  async issueRef(row) {
    const project = await this.projects.findByKey(row.project_key);
    return {
      id: String(row.id), key: row.key, self: `${this.baseUrl}/api/issues/${row.key}`,
      fields: {
        summary: row.summary, description: row.description, issuetype: { name: row.type }, status: { name: row.status }, priority: { name: row.priority },
        assignee: await this.userRef(row.assignee_id), reporter: await this.userRef(row.reporter_id), labels: row.labels || [],
        project: project ? { key: project.key, name: project.name } : { key: row.project_key }, parent: row.parent_key ? { key: row.parent_key } : null,
        duedate: row.due_date, created: row.created_at, updated: row.updated_at, resolutiondate: row.resolved_at, resolution: row.resolution ? { name: row.resolution } : null,
        customfield_10016: row.story_points, sprint: row.sprint, fixVersions: row.fix_version ? [{ name: row.fix_version }] : [],
        components: (row.components || []).map((name) => ({ name })),
        timeoriginalestimate: row.original_estimate ?? null, timeestimate: row.remaining_estimate ?? null, timespent: row.time_spent || null,
        votes: { votes: row.vote_count || 0 },
      },
    };
  }

  async matchesJql(hook, row) {
    if (!hook.jql || !row) return true;
    try {
      const { where } = await this.issueQuery.compile({ id: hook.created_by }, hook.jql);
      return await this.issues.matches(row.id, where);
    } catch {
      return false;
    }
  }

  /** Domain event listener: builds the payload now (committed data) and delivers in the background. */
  async dispatch(internalEvent, data) {
    const event = EVENT_MAP[internalEvent];
    if (!event) return;
    const hooks = await this.repo.enabledFor(event);
    if (!hooks.length) return;
    const row = data.key ? ((await this.issues.findByKey(data.key)) || data.before || null) : null;
    const payload = { timestamp: Date.now(), webhookEvent: event, user: await this.userRef(data.actorId) };
    if (row) payload.issue = await this.issueRef(row);
    if (internalEvent === 'issue_updated') {
      payload.issue_event_type_name = data.changed.includes('status') ? 'issue_generic' : data.changed.includes('assignee_id') ? 'issue_assigned' : 'issue_updated';
      payload.changelog = { items: data.changed.map((f) => ({ field: HISTORY_LABEL[f] || f, fromString: display(data.before?.[f]), toString: display(row?.[f]) })) };
    }
    if (internalEvent === 'comment_created') payload.comment = { id: String(data.commentId), body: data.body, author: await this.userRef(data.actorId), created: new Date().toISOString() };
    if (internalEvent === 'worklog_created') payload.worklog = data.worklog;
    if (data.sprint) payload.sprint = data.sprint;
    if (data.version) payload.version = data.version;
    for (const hook of hooks) {
      if (row && !(await this.matchesJql(hook, row))) continue;
      setImmediate(() => this.send(hook, event, payload, { retry: true }).catch((err) => this.logger.error('webhook delivery failed', err)));
    }
  }
}

module.exports = { WebhookService };
