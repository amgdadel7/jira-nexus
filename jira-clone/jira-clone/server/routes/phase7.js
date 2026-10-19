// Phase 7: time tracking (worklogs, estimates, timesheet), votes, personal preferences + avatars,
// project automation rules, outgoing webhooks and CSV import.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const L = require('../lib');
const P = require('../perms');
const A = require('../auth');
const TF = require('../timefmt');
const AU = require('../automation');
const WH = require('../webhooks');
const hooks = require('../hooks');

const r = express.Router();
const AVATAR_DIR = path.join(db.UPLOAD_DIR, 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

function issueFor(req, key, perm = 'BROWSE_PROJECT') {
  const row = L.requireIssue(key);
  if (!P.can(req, row.project_key, 'BROWSE_PROJECT')) throw L.notFound(`Work item ${key} does not exist.`);
  if (perm !== 'BROWSE_PROJECT') P.assert(req, row.project_key, perm);
  return row;
}

// ===================================================================== time tracking
const worklogOut = (w) => ({ id: w.id, issueKey: w.issue_key, authorId: w.author_id, started: w.started_at, timeSpent: w.time_spent, timeSpentText: TF.formatDuration(w.time_spent), comment: w.comment, created: w.created_at, updated: w.updated_at });
const WL_SELECT = 'SELECT w.*, i.key AS issue_key FROM worklogs w JOIN issues i ON i.id = w.issue_id';

function parseSpent(v) {
  let sec;
  try { sec = TF.parseDuration(v); } catch (e) { throw L.bad(e.message); }
  if (!sec || sec < 60) throw L.bad('Time spent must be at least 1m.');
  if (sec > 7 * 24 * 3600) throw L.bad('You can log at most 1 week of time at once.');
  return sec;
}
function parseStarted(v) {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw L.bad('Date started is invalid.');
  if (d.getTime() > Date.now() + 365 * 864e5) throw L.bad('Date started is too far in the future.');
  return d.toISOString();
}

/** Recalculates time spent and applies the remaining-estimate adjustment, recording history. */
function updateTotals(row, actorId, { remaining } = {}) {
  const spent = db.prepare('SELECT COALESCE(SUM(time_spent),0) s FROM worklogs WHERE issue_id = ?').get(row.id).s;
  const f = {};
  if (spent !== (row.time_spent || 0)) f.time_spent = spent;
  if (remaining !== undefined && remaining !== (row.remaining_estimate ?? null)) f.remaining_estimate = remaining;
  if (Object.keys(f).length) L.applyUpdate(row, f, actorId);
}

function remainingAfter(row, mode, deltaSec, value) {
  const cur = row.remaining_estimate ?? null;
  switch (mode || 'auto') {
    case 'leave': return undefined;
    case 'new': { let s; try { s = TF.parseDuration(value); } catch (e) { throw L.bad(e.message); } if (s === null) throw L.bad('Enter the new remaining estimate.'); return s; }
    case 'manual': { let s; try { s = TF.parseDuration(value); } catch (e) { throw L.bad(e.message); } return cur === null ? undefined : Math.max(0, cur - (s || 0)); }
    case 'auto': return cur === null ? undefined : Math.max(0, cur - deltaSec);
    default: throw L.bad("adjustEstimate must be 'auto', 'leave', 'new' or 'manual'.");
  }
}

r.get('/issues/:key/worklogs', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  const logs = db.prepare(`${WL_SELECT} WHERE w.issue_id = ? ORDER BY w.started_at DESC, w.id DESC`).all(row.id).map(worklogOut);
  res.json({ worklogs: logs, total: row.time_spent || 0, originalEstimate: row.original_estimate ?? null, remainingEstimate: row.remaining_estimate ?? null });
}));

r.post('/issues/:key/worklogs', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'WORK_ON_ISSUES');
  const b = req.body || {};
  const sec = parseSpent(b.timeSpent);
  const started = parseStarted(b.started);
  const comment = String(b.comment || '').trim().slice(0, 5000);
  const remaining = remainingAfter(row, b.adjustEstimate, sec, b.newEstimate ?? b.reduceBy);
  const t = L.now();
  const id = db.transaction(() => {
    const info = db.prepare('INSERT INTO worklogs (issue_id,author_id,started_at,time_spent,comment,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(row.id, req.user.id, started, sec, comment, t, t);
    updateTotals(row, req.user.id, { remaining });
    return info.lastInsertRowid;
  })();
  const w = worklogOut(db.prepare(`${WL_SELECT} WHERE w.id = ?`).get(id));
  hooks.emit('worklog_created', { key: row.key, actorId: req.user.id, worklog: { id: String(w.id), issueId: String(row.id), timeSpent: w.timeSpentText, timeSpentSeconds: w.timeSpent, started: w.started, comment: w.comment, author: { accountId: req.user.id, displayName: req.user.name } } });
  res.status(201).json({ worklog: w, issue: L.toIssue(L.getIssueRow(row.key)) });
}));

function ownWorklog(req) {
  const w = db.prepare(`${WL_SELECT} WHERE w.id = ?`).get(req.params.id);
  if (!w) throw L.notFound('Worklog not found.');
  const row = issueFor(req, w.issue_key);
  P.assert(req, row.project_key, w.author_id === req.user.id ? 'WORK_ON_ISSUES' : 'EDIT_ALL_WORKLOGS');
  return { w, row };
}

r.patch('/worklogs/:id', L.wrap((req, res) => {
  const { w, row } = ownWorklog(req);
  const b = req.body || {};
  const upd = {};
  if ('timeSpent' in b) upd.time_spent = parseSpent(b.timeSpent);
  if ('started' in b) upd.started_at = parseStarted(b.started);
  if ('comment' in b) upd.comment = String(b.comment || '').trim().slice(0, 5000);
  const delta = (upd.time_spent ?? w.time_spent) - w.time_spent;
  const remaining = 'time_spent' in upd ? remainingAfter(row, b.adjustEstimate, delta, b.newEstimate) : undefined;
  db.transaction(() => {
    const cols = Object.keys(upd);
    if (cols.length) db.prepare(`UPDATE worklogs SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @t WHERE id = @id`).run({ ...upd, t: L.now(), id: w.id });
    updateTotals(row, req.user.id, { remaining });
  })();
  res.json({ worklog: worklogOut(db.prepare(`${WL_SELECT} WHERE w.id = ?`).get(w.id)), issue: L.toIssue(L.getIssueRow(row.key)) });
}));

r.delete('/worklogs/:id', L.wrap((req, res) => {
  const { w, row } = ownWorklog(req);
  const mode = req.query.adjustEstimate || req.body?.adjustEstimate || 'auto';
  // deleting work gives the time back to the remaining estimate (Jira's "Automatically adjust")
  const remaining = mode === 'leave' ? undefined : (row.remaining_estimate === null ? undefined : row.remaining_estimate + w.time_spent);
  db.transaction(() => {
    db.prepare('DELETE FROM worklogs WHERE id = ?').run(w.id);
    updateTotals(row, req.user.id, { remaining });
  })();
  res.json({ ok: true, issue: L.toIssue(L.getIssueRow(row.key)) });
}));

// Timesheet: logged time per person per day (and per work item) for a project and date range
r.get('/reports/timesheet', L.wrap((req, res) => {
  const pk = String(req.query.project || 'KAN').toUpperCase();
  L.requireProject(pk);
  P.assert(req, pk, 'BROWSE_PROJECT');
  const iso = (d) => d.toISOString().slice(0, 10);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : iso(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : iso(new Date(Date.parse(to) - 6 * 864e5));
  if (from > to) throw L.bad('The start date must be before the end date.');
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 62) throw L.bad('Choose a range of at most 62 days.');
  const rows = db.prepare(`SELECT w.author_id, substr(w.started_at,1,10) AS day, w.time_spent, i.key, i.summary, i.type, i.status
    FROM worklogs w JOIN issues i ON i.id = w.issue_id
    WHERE i.project_key = ? AND substr(w.started_at,1,10) BETWEEN ? AND ? ${req.query.user ? 'AND w.author_id = ?' : ''}`)
    .all(...[pk, from, to, ...(req.query.user ? [String(req.query.user)] : [])]);
  const days = [];
  for (let d = Date.parse(from); d <= Date.parse(to); d += 864e5) days.push(iso(new Date(d)));
  const users = {}; const issues = {};
  for (const x of rows) {
    const u = (users[x.author_id] ||= { userId: x.author_id, total: 0, days: {} });
    u.total += x.time_spent; u.days[x.day] = (u.days[x.day] || 0) + x.time_spent;
    const i = (issues[x.key] ||= { key: x.key, summary: x.summary, type: x.type, status: x.status, total: 0, byUser: {}, days: {} });
    i.total += x.time_spent; i.byUser[x.author_id] = (i.byUser[x.author_id] || 0) + x.time_spent; i.days[x.day] = (i.days[x.day] || 0) + x.time_spent;
  }
  const est = db.prepare(`SELECT COALESCE(SUM(original_estimate),0) o, COALESCE(SUM(remaining_estimate),0) r, COALESCE(SUM(time_spent),0) s,
    SUM(CASE WHEN original_estimate IS NOT NULL THEN 1 ELSE 0 END) estimated, COUNT(*) n FROM issues WHERE project_key = ? AND type != 'Epic'`).get(pk);
  res.json({
    project: pk, from, to, days, total: rows.reduce((a, x) => a + x.time_spent, 0),
    users: Object.values(users).sort((a, b) => b.total - a.total),
    issues: Object.values(issues).sort((a, b) => b.total - a.total),
    estimates: { original: est.o, remaining: est.r, spent: est.s, estimatedItems: est.estimated, items: est.n },
    workingDay: { hoursPerDay: TF.HOURS_PER_DAY, daysPerWeek: TF.DAYS_PER_WEEK },
  });
}));

// ===================================================================== votes
r.get('/issues/:key/votes', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  const voters = db.prepare('SELECT v.user_id, v.created_at FROM votes v WHERE v.issue_id = ? ORDER BY v.created_at').all(row.id);
  res.json({ votes: voters.length, hasVoted: voters.some((v) => v.user_id === req.user.id), voters: voters.map((v) => ({ userId: v.user_id, at: v.created_at })) });
}));
r.post('/issues/:key/votes', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  if (row.reporter_id === req.user.id) throw L.bad('You can’t vote for a work item you reported.');
  if (row.status === 'Done') throw L.bad('You can’t vote for a work item that’s already done.');
  db.prepare('INSERT OR IGNORE INTO votes (issue_id,user_id,created_at) VALUES (?,?,?)').run(row.id, req.user.id, L.now());
  res.json({ votes: db.prepare('SELECT COUNT(*) c FROM votes WHERE issue_id = ?').get(row.id).c, hasVoted: true });
}));
r.delete('/issues/:key/votes', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  db.prepare('DELETE FROM votes WHERE issue_id = ? AND user_id = ?').run(row.id, req.user.id);
  res.json({ votes: db.prepare('SELECT COUNT(*) c FROM votes WHERE issue_id = ?').get(row.id).c, hasVoted: false });
}));

// ===================================================================== personal preferences + avatar
const NOTIFY_TYPES = ['assigned', 'status', 'comment', 'mention'];
const DEFAULT_PREFS = { theme: 'light', reduceMotion: false, notify: Object.fromEntries(NOTIFY_TYPES.map((t) => [t, true])), weekStart: 'sunday' };
function prefsOf(user) {
  let p = {}; try { p = JSON.parse(user.prefs || '{}'); } catch { /* ignore */ }
  return { ...DEFAULT_PREFS, ...p, notify: { ...DEFAULT_PREFS.notify, ...(p.notify || {}) } };
}
r.get('/auth/me/preferences', L.wrap((req, res) => res.json(prefsOf(db.prepare('SELECT prefs FROM users WHERE id = ?').get(req.user.id)))));
r.patch('/auth/me/preferences', L.wrap((req, res) => {
  const cur = prefsOf(db.prepare('SELECT prefs FROM users WHERE id = ?').get(req.user.id));
  const b = req.body || {};
  if ('theme' in b) { if (!['light', 'dark', 'system'].includes(b.theme)) throw L.bad("Theme must be 'light', 'dark' or 'system'."); cur.theme = b.theme; }
  if ('reduceMotion' in b) cur.reduceMotion = !!b.reduceMotion;
  if ('weekStart' in b) { if (!['sunday', 'monday', 'saturday'].includes(b.weekStart)) throw L.bad('Unknown week start.'); cur.weekStart = b.weekStart; }
  if ('notify' in b) {
    if (typeof b.notify !== 'object' || !b.notify) throw L.bad('notify must be an object.');
    for (const [k, v] of Object.entries(b.notify)) { if (!NOTIFY_TYPES.includes(k)) throw L.bad(`Unknown notification type '${k}'.`); cur.notify[k] = !!v; }
  }
  db.prepare('UPDATE users SET prefs = ? WHERE id = ?').run(JSON.stringify(cur), req.user.id);
  res.json(cur);
}));

const IMAGE_SIGS = [
  { mime: 'image/png', ext: 'png', test: (b) => b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG' },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.length > 6 && b.toString('ascii', 0, 3) === 'GIF' },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
];
r.post('/auth/me/avatar', express.raw({ type: () => true, limit: 2 * 1024 * 1024 }), L.wrap((req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) throw L.bad('Choose an image to upload.');
  if (buf.length > 1024 * 1024) throw L.bad('Profile photos must be 1 MB or smaller.');
  const kind = IMAGE_SIGS.find((s) => s.test(buf));
  if (!kind) throw L.bad('Upload a PNG, JPG, GIF or WebP image.');
  const name = `${req.user.id}-${crypto.randomBytes(8).toString('hex')}.${kind.ext}`;
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  fs.writeFileSync(path.join(AVATAR_DIR, name), buf);
  const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id)?.avatar;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(name, req.user.id);
  if (old) fs.rm(path.join(AVATAR_DIR, old), { force: true }, () => {});
  res.json({ user: A.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));
r.delete('/auth/me/avatar', L.wrap((req, res) => {
  const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.user.id)?.avatar;
  db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(req.user.id);
  if (old) fs.rm(path.join(AVATAR_DIR, old), { force: true }, () => {});
  res.json({ user: A.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));

/** Public (no auth) avatar files: names are unguessable and <img> tags can't send bearer tokens. */
function serveAvatar(req, res) {
  const f = String(req.params.file || '');
  if (!/^[\w-]+\.(png|jpg|gif|webp)$/.test(f)) return res.status(404).end();
  const p = path.join(AVATAR_DIR, f);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(p);
}

// ===================================================================== automation
function adminOf(req, pk) {
  const p = L.requireProject(pk);
  if (!P.can(req, p.key, 'BROWSE_PROJECT')) throw L.notFound(`Project '${pk}' does not exist.`);
  P.assert(req, p.key, 'ADMINISTER_PROJECT');
  return p;
}
function requireRule(req) {
  const rule = db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(Number(req.params.id));
  if (!rule) throw L.notFound('Rule not found.');
  adminOf(req, rule.project_key);
  return rule;
}
const runOut = (x) => ({ id: x.id, ruleId: x.rule_id, ruleName: x.rule_name, issueKey: x.issue_key, status: x.status, statusLabel: AU.STATUSES[x.status] || x.status, message: x.message, actions: JSON.parse(x.actions || '[]'), durationMs: x.duration_ms, created: x.created_at });

r.get('/projects/:key/automation', L.wrap((req, res) => {
  const p = adminOf(req, req.params.key);
  const rules = db.prepare('SELECT * FROM automation_rules WHERE project_key = ? ORDER BY id').all(p.key).map(AU.ruleOut);
  res.json({ rules, usage: AU.usage(), triggers: AU.TRIGGERS, actions: AU.ACTIONS, templates: AU.TEMPLATES, fields: Object.keys(AU.WATCHABLE_FIELDS) });
}));
r.post('/projects/:key/automation', L.wrap((req, res) => {
  const p = adminOf(req, req.params.key);
  const b = req.body || {};
  const tpl = b.templateId ? AU.TEMPLATES.find((t) => t.id === b.templateId) : null;
  if (b.templateId && !tpl) throw L.bad('Unknown template.');
  const v = AU.validate(tpl ? { ...tpl, ...b } : b, p.key);
  const t = L.now();
  const info = db.prepare('INSERT INTO automation_rules (project_key,name,description,enabled,trigger,condition,actions,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(p.key, v.name, v.description || '', v.enabled ?? 1, v.trigger, v.condition || '', v.actions, req.user.id, t, t);
  P.audit(req, 'automation.rule_created', { project: p.key, target: v.name, details: { ruleId: info.lastInsertRowid } });
  res.status(201).json(AU.ruleOut(db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(info.lastInsertRowid)));
}));
r.get('/automation/:id', L.wrap((req, res) => res.json(AU.ruleOut(requireRule(req)))));
r.patch('/automation/:id', L.wrap((req, res) => {
  const rule = requireRule(req);
  const v = AU.validate(req.body || {}, rule.project_key, true);
  const cols = Object.keys(v);
  if (cols.length) db.prepare(`UPDATE automation_rules SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @t WHERE id = @id`).run({ ...v, t: L.now(), id: rule.id });
  if ('enabled' in v) P.audit(req, v.enabled ? 'automation.rule_enabled' : 'automation.rule_disabled', { project: rule.project_key, target: rule.name });
  else if (cols.length) P.audit(req, 'automation.rule_updated', { project: rule.project_key, target: v.name || rule.name, details: { fields: cols } });
  res.json(AU.ruleOut(db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(rule.id)));
}));
r.delete('/automation/:id', L.wrap((req, res) => {
  const rule = requireRule(req);
  db.prepare('DELETE FROM automation_rules WHERE id = ?').run(rule.id);
  P.audit(req, 'automation.rule_deleted', { project: rule.project_key, target: rule.name });
  res.json({ ok: true });
}));
r.get('/automation/:id/runs', L.wrap((req, res) => {
  const rule = requireRule(req);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json(db.prepare('SELECT x.*, ? AS rule_name FROM automation_runs x WHERE rule_id = ? ORDER BY id DESC LIMIT ?').all(rule.name, rule.id, limit).map(runOut));
}));
/** "Run rule" against one work item (ignores the trigger, still checks the condition). */
r.post('/automation/:id/run', L.wrap((req, res) => {
  const rule = requireRule(req);
  const key = String(req.body?.issueKey || '');
  const row = L.requireIssue(key);
  if (row.project_key !== rule.project_key) throw L.bad(`${row.key} isn’t in ${rule.project_key}.`);
  const out = AU.execute(rule, row.key, req.user.id);
  res.json({ ...out, statusLabel: AU.STATUSES[out.status], issue: L.toIssue(L.getIssueRow(row.key)) });
}));
r.get('/projects/:key/automation/audit', L.wrap((req, res) => {
  const p = adminOf(req, req.params.key);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const status = req.query.status ? String(req.query.status) : null;
  res.json(db.prepare(`SELECT x.*, r.name AS rule_name FROM automation_runs x JOIN automation_rules r ON r.id = x.rule_id
    WHERE r.project_key = @p AND (@s IS NULL OR x.status = @s) ORDER BY x.id DESC LIMIT @limit`).all({ p: p.key, s: status, limit }).map(runOut));
}));

// ===================================================================== outgoing webhooks (site admin)
const requireWebhook = (id) => { const w = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(Number(id)); if (!w) throw L.notFound('Webhook not found.'); return w; };
r.get('/admin/webhooks', A.requireAdmin, L.wrap((req, res) => {
  res.json({ webhooks: db.prepare('SELECT * FROM webhooks ORDER BY id').all().map(WH.webhookOut), events: WH.EVENTS });
}));
r.post('/admin/webhooks', A.requireAdmin, L.wrap((req, res) => {
  const v = WH.validate(req.body || {});
  const t = L.now();
  const info = db.prepare('INSERT INTO webhooks (name,url,secret,events,jql,enabled,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(v.name, v.url, v.secret || '', v.events, v.jql || '', v.enabled ?? 1, req.user.id, t, t);
  P.audit(req, 'webhook.created', { target: v.name, details: { url: v.url } });
  res.status(201).json(WH.webhookOut(requireWebhook(info.lastInsertRowid)));
}));
r.patch('/admin/webhooks/:id', A.requireAdmin, L.wrap((req, res) => {
  const w = requireWebhook(req.params.id);
  const v = WH.validate(req.body || {}, true);
  const cols = Object.keys(v);
  if (cols.length) db.prepare(`UPDATE webhooks SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = @t WHERE id = @id`).run({ ...v, t: L.now(), id: w.id });
  P.audit(req, 'webhook.updated', { target: v.name || w.name, details: { fields: cols.filter((c) => c !== 'secret') } });
  res.json(WH.webhookOut(requireWebhook(w.id)));
}));
r.delete('/admin/webhooks/:id', A.requireAdmin, L.wrap((req, res) => {
  const w = requireWebhook(req.params.id);
  db.prepare('DELETE FROM webhooks WHERE id = ?').run(w.id);
  P.audit(req, 'webhook.deleted', { target: w.name });
  res.json({ ok: true });
}));
r.post('/admin/webhooks/:id/test', A.requireAdmin, L.wrap(async (req, res) => {
  const w = requireWebhook(req.params.id);
  const out = await WH.send({ ...w, enabled: 1 }, 'ping', WH.testPayload(w, req.user.id));
  const d = out?.id ? db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(out.id) : null;
  res.json({ ok: !!out?.ok, status: out?.status ?? null, error: out?.error ?? null, delivery: d ? WH.deliveryOut(d) : null });
}));
r.get('/admin/webhooks/:id/deliveries', A.requireAdmin, L.wrap((req, res) => {
  const w = requireWebhook(req.params.id);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json(db.prepare('SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT ?').all(w.id, limit).map((d) => WH.deliveryOut(d)));
}));
r.get('/admin/webhook-deliveries/:id', A.requireAdmin, L.wrap((req, res) => {
  const d = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(Number(req.params.id));
  if (!d) throw L.notFound('Delivery not found.');
  res.json(WH.deliveryOut(d, true));
}));
r.post('/admin/webhook-deliveries/:id/redeliver', A.requireAdmin, L.wrap(async (req, res) => {
  const d = db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(Number(req.params.id));
  if (!d) throw L.notFound('Delivery not found.');
  const w = requireWebhook(d.webhook_id);
  const out = await WH.send({ ...w, enabled: 1 }, d.event, JSON.parse(d.payload), 1 + db.prepare('SELECT MAX(attempt) m FROM webhook_deliveries WHERE uuid = ?').get(d.uuid).m, d.uuid);
  const nd = out?.id ? db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(out.id) : null;
  res.json({ ok: !!out?.ok, status: out?.status ?? null, error: out?.error ?? null, delivery: nd ? WH.deliveryOut(nd) : null });
}));

// ===================================================================== CSV import
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  const s = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (q) throw L.bad('The CSV has an unterminated quoted value.');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r0) => r0.some((x) => x.trim() !== ''));
}
const CSV_COLUMNS = {
  summary: 'summary', 'issue type': 'type', issuetype: 'type', type: 'type', 'work type': 'type', priority: 'priority', status: 'status',
  assignee: 'assignee', reporter: 'reporter', labels: 'labels', label: 'labels', 'story points': 'storyPoints', 'story point estimate': 'storyPoints',
  'due date': 'dueDate', duedate: 'dueDate', 'start date': 'startDate', description: 'description', sprint: 'sprint',
  'fix version': 'fixVersion', 'fix versions': 'fixVersion', 'fix version/s': 'fixVersion', component: 'components', components: 'components', 'component/s': 'components',
  'original estimate': 'originalEstimate', 'remaining estimate': 'remainingEstimate', parent: 'parentKey', 'parent key': 'parentKey', 'parent id': 'parentKey',
};
function findUser(v) {
  if (!v) return null;
  const u = db.prepare('SELECT id FROM users WHERE active = 1 AND bot = 0 AND (email = ? COLLATE NOCASE OR name = ? COLLATE NOCASE OR id = ?)').get(v, v, v);
  if (!u) throw new Error(`No active user matches “${v}”.`);
  return u.id;
}
function normDate(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`“${v}” isn’t a date (use yyyy-MM-dd).`);
  return d.toISOString().slice(0, 10);
}

r.post('/projects/:key/import', express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }), L.wrap((req, res) => {
  const p = L.requireProject(req.params.key);
  if (!P.can(req, p.key, 'BROWSE_PROJECT')) throw L.notFound(`Project '${req.params.key}' does not exist.`);
  P.assert(req, p.key, 'CREATE_ISSUES');
  const csv = typeof req.body === 'string' ? req.body : req.body?.csv;
  const dryRun = typeof req.body === 'string' ? req.query.dryRun === '1' || req.query.dryRun === 'true' : !!req.body?.dryRun;
  if (!csv || !String(csv).trim()) throw L.bad('Paste or upload a CSV file.');
  const rows = parseCsv(csv);
  if (rows.length < 2) throw L.bad('The CSV needs a header row and at least one work item.');
  if (rows.length > 501) throw L.bad('You can import at most 500 work items at once.');
  const header = rows[0].map((h) => h.trim());
  const mapping = header.map((h) => CSV_COLUMNS[h.toLowerCase()] || null);
  if (!mapping.includes('summary')) throw L.bad('The CSV must have a “Summary” column.');
  const items = []; const errors = [];
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    try {
      const body = { projectKey: p.key };
      mapping.forEach((m, i) => {
        const v = String(cells[i] ?? '').trim();
        if (!m || v === '') return;
        if (m === 'assignee') body.assigneeId = findUser(v);
        else if (m === 'reporter') body.reporterId = findUser(v);
        else if (m === 'labels') body.labels = v.split(/[\s,;]+/).filter(Boolean);
        else if (m === 'components') body.components = v.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
        else if (m === 'dueDate' || m === 'startDate') body[m] = normDate(v);
        else if (m === 'type') body.type = ({ 'sub-task': 'Subtask', subtask: 'Subtask' })[v.toLowerCase()] || v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
        else if (m === 'priority' || m === 'status') {
          const known = m === 'priority' ? ['Highest', 'High', 'Medium', 'Low', 'Lowest'] : ['To Do', 'In Progress', 'In Review', 'Done'];
          const hit = known.find((k) => k.toLowerCase() === v.toLowerCase());
          if (!hit) throw new Error(`Unknown ${m} “${v}”.`);
          body[m] = hit;
        } else body[m] = v;
      });
      L.normalizeFields({ type: 'Task', ...body }, null, p.key); // validates everything without writing
      items.push({ line, body });
    } catch (e) { errors.push({ line, error: e.message }); }
  });
  const preview = items.slice(0, 20).map(({ line, body }) => ({ line, summary: body.summary, type: body.type || 'Task', status: body.status || 'To Do', priority: body.priority || 'Medium', assigneeId: body.assigneeId || null, labels: body.labels || [] }));
  const columns = header.map((h, i) => ({ header: h, field: mapping[i] }));
  if (dryRun) return res.json({ dryRun: true, total: rows.length - 1, valid: items.length, errors, columns, preview });
  if (errors.length) return res.status(400).json({ error: `Fix ${errors.length} row${errors.length > 1 ? 's' : ''} before importing.`, errors, columns });
  const created = db.transaction(() => items.map(({ body }) => L.createIssue(body, req.user.id).key))();
  P.audit(req, 'issues.imported', { project: p.key, target: `${created.length} work items`, details: { first: created[0], last: created[created.length - 1] } });
  res.status(201).json({ created, count: created.length, columns });
}));

module.exports = r;
module.exports.serveAvatar = serveAvatar;
module.exports.prefsOf = prefsOf;
