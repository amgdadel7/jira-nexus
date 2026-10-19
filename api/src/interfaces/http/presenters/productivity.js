'use strict';

const { RUN_STATUSES } = require('../../../domain/automation');

const rule = (r) => ({
  id: r.id, project: r.project_key, name: r.name, description: r.description, enabled: r.enabled,
  trigger: r.trigger, condition: r.condition, actions: r.actions,
  createdBy: r.created_by, created: r.created_at, updated: r.updated_at,
  runs: r.stats?.total || 0, succeeded: r.stats?.ok || 0, failed: r.stats?.failed || 0,
  lastRun: r.stats?.last || null, lastStatus: r.stats?.last_status || null,
});

const run = (x) => ({
  id: x.id, ruleId: x.rule_id, ruleName: x.rule_name, issueKey: x.issue_key, status: x.status, statusLabel: RUN_STATUSES[x.status] || x.status,
  message: x.message, actions: x.actions, durationMs: x.duration_ms, created: x.created_at,
});

const webhook = (w) => ({
  id: w.id, name: w.name, url: w.url, events: w.events, jql: w.jql, enabled: w.enabled,
  hasSecret: Boolean(w.secret), createdBy: w.created_by, created: w.created_at, updated: w.updated_at,
  deliveries: w.stats?.total || 0, succeeded: w.stats?.ok || 0,
  lastDelivery: w.stats ? { ok: w.stats.last_ok, status: w.stats.last_status, at: w.stats.last_at } : null,
});

const delivery = (d, full = false) => ({
  id: d.id, webhookId: d.webhook_id, uuid: d.uuid, event: d.event, status: d.status_code, ok: d.ok, durationMs: d.duration_ms,
  error: d.error, attempt: d.attempt, created: d.created_at, ...(full ? { payload: d.payload, response: d.response } : {}),
});

const deliveryResult = (r) => ({ ...r, delivery: r.delivery ? delivery(r.delivery) : null });

module.exports = { rule, run, webhook, delivery, deliveryResult };
