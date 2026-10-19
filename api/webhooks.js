// Outgoing webhooks (Jira-compatible payloads). Admins register URLs for events; every delivery is
// signed with HMAC-SHA256 (X-Hub-Signature: sha256=<hex>) when a secret is set, retried on network
// errors / 5xx (3 attempts with back-off) and recorded in webhook_deliveries.
const crypto = require('crypto');
const db = require('./db');
const hooks = require('./hooks');
const { compile } = require('./jql');

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
const EVENT_MAP = {
  issue_created: 'jira:issue_created', issue_updated: 'jira:issue_updated', issue_deleted: 'jira:issue_deleted',
  comment_created: 'comment_created', worklog_created: 'worklog_created', sprint_started: 'sprint_started',
  sprint_closed: 'sprint_closed', version_released: 'jira:version_released',
};
const RETRY_DELAYS = process.env.NODE_ENV === 'test' ? [50, 100] : [2000, 8000];
const TIMEOUT_MS = 10000;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

const baseUrl = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const userRef = (id) => {
  if (!id) return null;
  const u = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id);
  return u ? { accountId: u.id, displayName: u.name, emailAddress: u.email } : null;
};

function issueRef(row) {
  if (!row) return null;
  const p = db.prepare('SELECT key, name FROM projects WHERE key = ?').get(row.project_key);
  const parent = row.parent_id ? db.prepare('SELECT key FROM issues WHERE id = ?').get(row.parent_id) : null;
  return {
    id: String(row.id), key: row.key, self: `${baseUrl()}/api/issues/${row.key}`,
    fields: {
      summary: row.summary, description: row.description, issuetype: { name: row.type }, status: { name: row.status }, priority: { name: row.priority },
      assignee: userRef(row.assignee_id), reporter: userRef(row.reporter_id), labels: JSON.parse(row.labels || '[]'),
      project: p ? { key: p.key, name: p.name } : { key: row.project_key }, parent: parent ? { key: parent.key } : null,
      duedate: row.due_date, created: row.created_at, updated: row.updated_at, resolutiondate: row.resolved_at,
      customfield_10016: row.story_points, sprint: row.sprint, fixVersions: row.fix_version ? [{ name: row.fix_version }] : [],
      components: JSON.parse(row.components || '[]').map((name) => ({ name })),
      timeoriginalestimate: row.original_estimate ?? null, timeestimate: row.remaining_estimate ?? null, timespent: row.time_spent || null,
      votes: { votes: db.prepare('SELECT COUNT(*) c FROM votes WHERE issue_id = ?').get(row.id)?.c || 0 },
    },
  };
}

function sign(secret, body) { return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`; }

function webhookOut(w) {
  const last = db.prepare('SELECT ok, status_code, created_at FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 1').get(w.id);
  const counts = db.prepare('SELECT COUNT(*) total, SUM(ok) ok FROM webhook_deliveries WHERE webhook_id = ?').get(w.id);
  return {
    id: w.id, name: w.name, url: w.url, events: JSON.parse(w.events), jql: w.jql, enabled: !!w.enabled,
    hasSecret: !!w.secret, createdBy: w.created_by, created: w.created_at, updated: w.updated_at,
    deliveries: counts.total, succeeded: counts.ok || 0,
    lastDelivery: last ? { ok: !!last.ok, status: last.status_code, at: last.created_at } : null,
  };
}
function deliveryOut(d, full = false) {
  const o = { id: d.id, webhookId: d.webhook_id, uuid: d.uuid, event: d.event, status: d.status_code, ok: !!d.ok, durationMs: d.duration_ms, error: d.error, attempt: d.attempt, created: d.created_at };
  if (full) { o.payload = JSON.parse(d.payload); o.response = d.response; }
  return o;
}

function validate(body, partial = false) {
  const out = {};
  if (!partial || 'name' in body) {
    const n = String(body.name || '').trim();
    if (!n) throw bad('Give the webhook a name.');
    out.name = n.slice(0, 255);
  }
  if (!partial || 'url' in body) {
    let u;
    try { u = new URL(String(body.url || '')); } catch { throw bad('Enter a valid URL, like https://example.com/hooks/masar.'); }
    if (!['http:', 'https:'].includes(u.protocol)) throw bad('Webhook URLs must start with http:// or https://.');
    out.url = u.toString();
  }
  if (!partial || 'events' in body) {
    const ev = Array.isArray(body.events) ? [...new Set(body.events)] : [];
    if (!ev.length) throw bad('Choose at least one event.');
    const unknown = ev.find((e) => !EVENTS[e]);
    if (unknown) throw bad(`Unknown event '${unknown}'.`);
    out.events = JSON.stringify(ev);
  }
  if ('jql' in body) {
    const j = String(body.jql || '').trim();
    if (j) { try { compile(j, { currentUserId: 'u1' }); } catch (e) { throw bad(`JQL: ${e.message}`); } }
    out.jql = j;
  }
  if ('secret' in body && body.secret !== undefined) out.secret = String(body.secret || '').slice(0, 255);
  if ('enabled' in body) out.enabled = body.enabled ? 1 : 0;
  return out;
}

async function send(webhook, event, payload, attempt = 1, uuid = crypto.randomUUID()) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json', 'User-Agent': 'Masar-Webhooks/1.0',
    'X-Atlassian-Webhook-Identifier': uuid, 'X-Masar-Event': event, 'X-Masar-Delivery': uuid,
  };
  if (webhook.secret) headers['X-Hub-Signature'] = sign(webhook.secret, body);
  const t0 = Date.now();
  let status = null; let ok = false; let error = null; let response = null;
  try {
    const r = await fetch(webhook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' });
    status = r.status; ok = r.status >= 200 && r.status < 300;
    response = (await r.text().catch(() => '')).slice(0, 2000);
    if (!ok) error = `HTTP ${r.status}`;
  } catch (e) {
    error = e.name === 'TimeoutError' ? `Timed out after ${TIMEOUT_MS / 1000}s` : (e.cause?.code || e.message);
  }
  let id;
  try {
    id = db.prepare('INSERT INTO webhook_deliveries (webhook_id,uuid,event,payload,status_code,ok,duration_ms,error,response,attempt,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(webhook.id, uuid, event, body, status, ok ? 1 : 0, Date.now() - t0, error, response, attempt, new Date().toISOString()).lastInsertRowid;
    // keep the log bounded: last 200 deliveries per webhook
    db.prepare('DELETE FROM webhook_deliveries WHERE webhook_id = ? AND id NOT IN (SELECT id FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 200)').run(webhook.id, webhook.id);
  } catch { return null; } // webhook deleted meanwhile
  const retryable = !ok && (status === null || status >= 500 || status === 429);
  if (retryable && attempt <= RETRY_DELAYS.length) {
    setTimeout(() => {
      const still = db.prepare('SELECT * FROM webhooks WHERE id = ? AND enabled = 1').get(webhook.id);
      if (still) send(still, event, payload, attempt + 1, uuid);
    }, RETRY_DELAYS[attempt - 1]).unref?.();
  }
  return { id, ok, status, error };
}

function matchesJql(w, issueRow) {
  if (!w.jql || !issueRow) return true;
  try {
    const c = compile(w.jql, { currentUserId: w.created_by });
    return !!db.prepare(`SELECT 1 FROM issues i WHERE i.id = ? AND (${c.where})`).get(issueRow.id, ...c.params);
  } catch { return false; }
}

/** Builds the payload synchronously (inside the triggering request) and delivers asynchronously. */
function dispatch(internalEvent, data) {
  const event = EVENT_MAP[internalEvent];
  if (!event) return;
  const hooksList = db.prepare('SELECT * FROM webhooks WHERE enabled = 1').all().filter((w) => JSON.parse(w.events).includes(event));
  if (!hooksList.length) return;
  const row = data.key ? (db.prepare('SELECT * FROM issues WHERE key = ?').get(data.key) || data.before) : null;
  const payload = { timestamp: Date.now(), webhookEvent: event, user: userRef(data.actorId) };
  if (row) payload.issue = issueRef(row);
  if (internalEvent === 'issue_updated') {
    const L = require('./lib');
    payload.issue_event_type_name = data.changed.includes('status') ? 'issue_generic' : data.changed.includes('assignee_id') ? 'issue_assigned' : 'issue_updated';
    payload.changelog = { items: data.changed.map((c) => ({ field: L.HIST_LABEL[c] || c, fromString: L.displayValue(c, data.before[c]), toString: L.displayValue(c, row[c]) })) };
  }
  if (internalEvent === 'comment_created') payload.comment = { id: String(data.commentId), body: data.body, author: userRef(data.actorId), created: new Date().toISOString() };
  if (internalEvent === 'worklog_created') payload.worklog = data.worklog;
  if (data.sprint) payload.sprint = data.sprint;
  if (data.version) payload.version = data.version;
  for (const w of hooksList) {
    if (row && !matchesJql(w, row)) continue;
    setImmediate(() => send(w, event, payload));
  }
}

hooks.on(dispatch);

function testPayload(w, userId) {
  return { timestamp: Date.now(), webhookEvent: 'ping', user: userRef(userId), webhook: { id: w.id, name: w.name, events: JSON.parse(w.events) }, message: 'This is a test delivery from Masar.' };
}

module.exports = { EVENTS, validate, webhookOut, deliveryOut, send, sign, testPayload };
