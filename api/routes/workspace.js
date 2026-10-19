const express = require('express');
const db = require('../db');
const { STATUS_ORDER, PRIORITY_ORDER, compile } = require('../jql');
const A = require('../auth');
const L = require('../lib');
const P = require('../perms');

const r = express.Router();
const { issueFor } = require('./issues');

// ---------- meta / project ----------
function planMeta() {
  const B = require('../billing');
  const s = B.summary();
  return { key: s.plan, name: s.planName, status: s.status, features: s.features, trialEndsAt: s.trialEndsAt, cancelAtPeriodEnd: s.cancelAtPeriodEnd, currentPeriodEnd: s.currentPeriodEnd, limits: s.limits, usage: B.usage() };
}
const PROJECT_COLS = 'key, name, type, description, lead_id AS leadId, color, category, created_at AS created, access, board_config';
r.get('/meta', L.wrap((req, res) => {
  const all = db.prepare(`SELECT ${PROJECT_COLS} FROM projects ORDER BY name`).all();
  const starred = new Set(db.prepare('SELECT project_key FROM project_stars WHERE user_id = ?').all(req.user.id).map((x) => x.project_key));
  const visible = new Set(P.browsableKeys(req));
  const projects = all.filter((p) => visible.has(p.key)).map(({ board_config: bc, ...p }) => ({ ...p, starred: starred.has(p.key), myRole: P.permsFor(req, p.key).role, canCreate: P.can(req, p.key, 'CREATE_ISSUES'), permissions: P.describe(req, p.key).permissions }));
  const wanted = String(req.query.project || '').toUpperCase();
  const denied = wanted && !visible.has(wanted) ? wanted : null; // exists-but-private and unknown look the same
  const project = projects.find((p) => p.key === wanted) || projects.find((p) => p.starred) || projects.find((p) => p.key === 'KAN') || projects[0];
  if (!project) {
    return res.json({ project: null, projects: [], noAccess: true, users: db.prepare('SELECT * FROM users ORDER BY name').all().map(A.publicUser), currentUserId: req.user.id, currentUser: A.publicUser(req.user),
      globalPermissions: P.GLOBAL_PERMISSIONS.map((g) => g.key).filter((k) => P.canGlobal(req.user, k)), plan: planMeta() });
  }
  const PK = project.key;
  let board = {}; try { board = JSON.parse(all.find((p) => p.key === PK).board_config || '{}'); } catch { board = {}; }
  project.board = { wip: board.wip || {}, swimlanes: board.swimlanes || 'none' };
  const access = P.describe(req, PK);
  const components = db.prepare('SELECT id, name, lead_id AS leadId FROM components WHERE project_key = ? ORDER BY name').all(PK);
  const teams = db.prepare('SELECT id, name, color FROM teams ORDER BY name').all();
  const users = db.prepare('SELECT * FROM users ORDER BY name').all().map(A.publicUser);
  const labels = db.prepare('SELECT DISTINCT value AS l FROM issues, json_each(issues.labels) WHERE issues.project_key = ? ORDER BY l').all(PK).map((x) => x.l);
  const sprints = db.prepare("SELECT name FROM sprints WHERE state != 'closed' AND project_key = ? ORDER BY state = 'future', position, id").all(PK).map((x) => x.name);
  const activeSprint = db.prepare("SELECT id, name, goal, start_date AS startDate, end_date AS endDate FROM sprints WHERE state = 'active' AND project_key = ? LIMIT 1").get(PK) || null;
  const versions = db.prepare("SELECT id, name, status, release_date AS releaseDate FROM versions WHERE project_key = ? AND status != 'archived' ORDER BY status = 'released', position, id").all(PK);
  const repos = db.prepare('SELECT DISTINCT repo FROM dev_items ORDER BY repo').all().map((x) => x.repo);
  res.json({
    project, projects, versions, users, currentUserId: req.user.id, currentUser: A.publicUser(req.user), denied,
    myRole: access.role, myRoleLabel: access.roleLabel, permissions: access.permissions, components, teams,
    globalPermissions: P.GLOBAL_PERMISSIONS.map((g) => g.key).filter((k) => P.canGlobal(req.user, k)),
    statuses: STATUS_ORDER, priorities: PRIORITY_ORDER, types: L.TYPES, labels, sprints, activeSprint, repos,
    linkTypes: Object.entries(L.LINK_TYPES).map(([id, v]) => ({ id, ...v })), goalStatuses: L.GOAL_STATUSES,
    plan: planMeta(),
  });
}));

r.patch('/project', L.wrap((req, res) => {
  const upd = {};
  if (req.body.name !== undefined) { const n = String(req.body.name).trim(); if (!n) throw L.bad('Project name is required.'); upd.name = n.slice(0, 80); }
  if (req.body.description !== undefined) upd.description = String(req.body.description).slice(0, 2000);
  if (req.body.leadId !== undefined) {
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(req.body.leadId)) throw L.bad('Unknown user.');
    upd.lead_id = req.body.leadId;
  }
  const PK = P.assert(req, req.query.project || req.body.key || 'KAN', 'ADMINISTER_PROJECT').key;
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE projects SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE key = ?`).run(...cols.map((c) => upd[c]), PK);
  if (cols.length) P.audit(req, 'project.updated', { project: PK, target: PK, details: { fields: cols } });
  res.json(db.prepare(`SELECT ${PROJECT_COLS} FROM projects WHERE key = ?`).get(PK));
}));

// ---------- quick search (top bar) ----------
r.get('/quicksearch', L.wrap((req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ issues: [], filters: [], users: [] });
  const like = `%${q}%`;
  const vis = P.issueFilter(req);
  const issues = db.prepare(`${L.ISSUE_SELECT} WHERE (i.key = ? COLLATE NOCASE OR i.summary LIKE ? COLLATE NOCASE OR i.description LIKE ? COLLATE NOCASE) AND ${vis.sql}
    ORDER BY CASE WHEN i.key = ? COLLATE NOCASE THEN 0 WHEN i.summary LIKE ? COLLATE NOCASE THEN 1 ELSE 2 END, i.updated_at DESC LIMIT 8`)
    .all(q, like, like, ...vis.params, q, `${q}%`).map(L.toIssue);
  const filters = db.prepare('SELECT id, name, jql FROM filters WHERE name LIKE ? COLLATE NOCASE LIMIT 4').all(like);
  const users = db.prepare('SELECT * FROM users WHERE active = 1 AND (name LIKE ? COLLATE NOCASE OR email LIKE ? COLLATE NOCASE) LIMIT 4').all(like, like).map(A.publicUser);
  res.json({ issues, filters, users });
}));

// ---------- activity feed ----------
r.get('/activity', L.wrap((req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
  const rows = db.prepare(`
    SELECT 'history' AS kind, h.id, h.author_id AS authorId, h.field, h.from_value AS "from", h.to_value AS "to", NULL AS body, h.created_at AS created, i.key, i.summary, i.type, i.status
      FROM history h JOIN issues i ON i.id = h.issue_id WHERE (@p IS NULL OR i.project_key = @p)
    UNION ALL
    SELECT 'comment', c.id, c.author_id, NULL, NULL, NULL, c.body, c.created_at, i.key, i.summary, i.type, i.status
      FROM comments c JOIN issues i ON i.id = c.issue_id WHERE (@p IS NULL OR i.project_key = @p)
    ORDER BY created DESC LIMIT @limit`).all({ p: req.query.project ? String(req.query.project).toUpperCase() : null, limit: limit * 3 });
  res.json(rows.filter((x) => P.can(req, x.key.split('-')[0], 'BROWSE_PROJECT')).slice(0, limit));
}));

// ---------- "for you" ----------
r.get('/me/worked-on', L.wrap((req, res) => {
  const rows = db.prepare(`
    SELECT i.key, MAX(t) AS last FROM (
      SELECT issue_id, created_at AS t FROM history WHERE author_id = ?
      UNION ALL SELECT issue_id, created_at FROM comments WHERE author_id = ?
    ) x JOIN issues i ON i.id = x.issue_id GROUP BY i.id ORDER BY last DESC LIMIT 50`).all(req.user.id, req.user.id);
  const issues = rows.filter((x) => P.can(req, x.key.split('-')[0], 'BROWSE_PROJECT')).map((x) => ({ ...L.toIssue(L.getIssueRow(x.key)), lastActivity: x.last }));
  res.json({ issues });
}));

// ---------- notifications ----------
r.get('/notifications', L.wrap((req, res) => {
  const items = db.prepare(`SELECT n.id, n.actor_id AS actorId, n.type, n.message, n.read, n.created_at AS created, i.key, i.summary, i.type AS issueType
    FROM notifications n LEFT JOIN issues i ON i.id = n.issue_id WHERE n.user_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT 50`).all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c;
  res.json({ unread, items: items.filter((n) => !n.key || P.can(req, n.key.split('-')[0], 'BROWSE_PROJECT')).map((n) => ({ ...n, read: !!n.read })) });
}));
r.post('/notifications/read', L.wrap((req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (ids) db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',') || 'NULL'})`).run(req.user.id, ...ids);
  else db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
}));

// ---------- saved filters ----------
const filterOut = (f) => ({ id: f.id, name: f.name, description: f.description, jql: f.jql, ownerId: f.owner_id, starred: !!f.starred, created: f.created_at, updated: f.updated_at });
function validJql(jql, userId) { compile(jql, { currentUserId: userId }); return jql; }

r.get('/filters', L.wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM filters ORDER BY starred DESC, name').all().map(filterOut));
}));
r.post('/filters', L.wrap((req, res) => {
  const name = String(req.body?.name || '').trim();
  const jql = String(req.body?.jql || '').trim();
  if (!name) throw L.bad('Filter name is required.');
  if (!jql) throw L.bad('JQL is required.');
  validJql(jql, req.user.id);
  if (db.prepare('SELECT 1 FROM filters WHERE name = ? COLLATE NOCASE AND owner_id = ?').get(name, req.user.id)) throw L.bad('You already have a filter with that name.');
  const t = L.now();
  const info = db.prepare('INSERT INTO filters (name,description,jql,owner_id,starred,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(name.slice(0, 100), String(req.body.description || '').slice(0, 500), jql, req.user.id, req.body.starred ? 1 : 0, t, t);
  res.status(201).json(filterOut(db.prepare('SELECT * FROM filters WHERE id = ?').get(info.lastInsertRowid)));
}));
function ownFilter(req) {
  const f = db.prepare('SELECT * FROM filters WHERE id = ?').get(req.params.id);
  if (!f) throw L.notFound('Filter not found.');
  if (f.owner_id !== req.user.id && req.user.role !== 'admin') throw L.forbidden('Only the owner can change this filter.');
  return f;
}
r.patch('/filters/:id', L.wrap((req, res) => {
  const f = db.prepare('SELECT * FROM filters WHERE id = ?').get(req.params.id);
  if (!f) throw L.notFound('Filter not found.');
  const upd = {};
  if (req.body.starred !== undefined) upd.starred = req.body.starred ? 1 : 0; // anyone can star
  if (req.body.name !== undefined || req.body.jql !== undefined || req.body.description !== undefined) {
    ownFilter(req);
    if (req.body.name !== undefined) { if (!String(req.body.name).trim()) throw L.bad('Filter name is required.'); upd.name = String(req.body.name).trim(); }
    if (req.body.jql !== undefined) upd.jql = validJql(String(req.body.jql).trim(), req.user.id);
    if (req.body.description !== undefined) upd.description = String(req.body.description);
  }
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE filters SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...cols.map((c) => upd[c]), L.now(), f.id);
  res.json(filterOut(db.prepare('SELECT * FROM filters WHERE id = ?').get(f.id)));
}));
r.delete('/filters/:id', L.wrap((req, res) => {
  const f = ownFilter(req);
  db.prepare('DELETE FROM filters WHERE id = ?').run(f.id);
  res.json({ ok: true });
}));

// ---------- goals ----------
function goalOut(g, req) {
  const issues = db.prepare(`${L.ISSUE_SELECT} JOIN goal_issues gi ON gi.issue_id = i.id WHERE gi.goal_id = ? ORDER BY i.rank`).all(g.id).map(L.toIssue)
    .filter((x) => !req || P.can(req, x.project, 'BROWSE_PROJECT'));
  // progress counts linked items plus their children
  const ids = issues.map((x) => x.id);
  let total = 0; let done = 0;
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const row = db.prepare(`SELECT COUNT(*) t, SUM(status = 'Done') d FROM issues WHERE id IN (${ph}) OR parent_id IN (${ph})`).get(...ids, ...ids);
    total = row.t; done = row.d || 0;
  }
  return {
    id: g.id, name: g.name, description: g.description, status: g.status, ownerId: g.owner_id, targetDate: g.target_date,
    created: g.created_at, updated: g.updated_at, issues, progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 },
  };
}
function goalFields(body) {
  const upd = {};
  if (body.name !== undefined) { if (!String(body.name).trim()) throw L.bad('Goal name is required.'); upd.name = String(body.name).trim().slice(0, 200); }
  if (body.description !== undefined) upd.description = String(body.description).slice(0, 5000);
  if (body.status !== undefined) { if (!L.GOAL_STATUSES.includes(body.status)) throw L.bad('Invalid goal status.'); upd.status = body.status; }
  if (body.ownerId !== undefined) { if (body.ownerId && !db.prepare('SELECT 1 FROM users WHERE id = ?').get(body.ownerId)) throw L.bad('Unknown user.'); upd.owner_id = body.ownerId || null; }
  if (body.targetDate !== undefined) { if (body.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) throw L.bad('Dates must be yyyy-MM-dd.'); upd.target_date = body.targetDate || null; }
  return upd;
}
const requireGoal = (id) => { const g = db.prepare('SELECT * FROM goals WHERE id = ?').get(id); if (!g) throw L.notFound('Goal not found.'); return g; };

r.get('/goals', L.wrap((req, res) => res.json(db.prepare('SELECT * FROM goals ORDER BY target_date IS NULL, target_date').all().map((g) => goalOut(g, req)))));
r.get('/goals/:id', L.wrap((req, res) => res.json(goalOut(requireGoal(req.params.id), req))));
r.post('/goals', L.wrap((req, res) => {
  P.assertGlobal(req, 'MANAGE_GOALS');
  const upd = goalFields({ status: 'pending', ownerId: req.user.id, ...req.body });
  if (!upd.name) throw L.bad('Goal name is required.');
  const t = L.now();
  const info = db.prepare('INSERT INTO goals (name,description,status,owner_id,target_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(upd.name, upd.description || '', upd.status, upd.owner_id ?? null, upd.target_date ?? null, t, t);
  res.status(201).json(goalOut(requireGoal(info.lastInsertRowid), req));
}));
r.patch('/goals/:id', L.wrap((req, res) => {
  P.assertGlobal(req, 'MANAGE_GOALS');
  const g = requireGoal(req.params.id);
  const upd = goalFields(req.body || {});
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE goals SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...cols.map((c) => upd[c]), L.now(), g.id);
  res.json(goalOut(requireGoal(g.id), req));
}));
r.delete('/goals/:id', L.wrap((req, res) => { P.assertGlobal(req, 'MANAGE_GOALS'); requireGoal(req.params.id); db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id); res.json({ ok: true }); }));
r.post('/goals/:id/issues', L.wrap((req, res) => {
  P.assertGlobal(req, 'MANAGE_GOALS');
  const g = requireGoal(req.params.id);
  const issue = issueFor(req, String(req.body?.key || ''));
  db.prepare('INSERT OR IGNORE INTO goal_issues (goal_id,issue_id) VALUES (?,?)').run(g.id, issue.id);
  db.prepare('UPDATE goals SET updated_at = ? WHERE id = ?').run(L.now(), g.id);
  res.status(201).json(goalOut(requireGoal(g.id), req));
}));
r.delete('/goals/:id/issues/:key', L.wrap((req, res) => {
  P.assertGlobal(req, 'MANAGE_GOALS');
  const g = requireGoal(req.params.id);
  const issue = issueFor(req, req.params.key);
  db.prepare('DELETE FROM goal_issues WHERE goal_id = ? AND issue_id = ?').run(g.id, issue.id);
  res.json(goalOut(requireGoal(g.id), req));
}));

// ---------- forms ----------
const FORM_FIELDS = ['summary', 'description', 'priority', 'dueDate', 'labels', 'storyPoints'];
const formOut = (f) => ({
  id: f.id, name: f.name, description: f.description, issueType: f.issue_type, fields: JSON.parse(f.fields),
  defaultLabels: JSON.parse(f.default_labels), defaultAssigneeId: f.default_assignee_id, active: !!f.active,
  projectKey: f.project_key, submissions: f.submissions, createdBy: f.created_by, created: f.created_at, updated: f.updated_at,
});
function formFields(body) {
  const upd = {};
  if (body.name !== undefined) { if (!String(body.name).trim()) throw L.bad('Form name is required.'); upd.name = String(body.name).trim().slice(0, 120); }
  if (body.description !== undefined) upd.description = String(body.description).slice(0, 2000);
  if (body.issueType !== undefined) { if (!L.TYPES.includes(body.issueType) || body.issueType === 'Subtask') throw L.bad('Invalid work type.'); upd.issue_type = body.issueType; }
  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields)) throw L.bad('fields must be an array.');
    const f = ['summary', ...body.fields.filter((x) => FORM_FIELDS.includes(x) && x !== 'summary')];
    upd.fields = JSON.stringify([...new Set(f)]);
  }
  if (body.defaultLabels !== undefined) upd.default_labels = JSON.stringify((body.defaultLabels || []).map((l) => String(l).trim().replace(/\s+/g, '_')).filter(Boolean));
  if (body.defaultAssigneeId !== undefined) { if (body.defaultAssigneeId && !db.prepare('SELECT 1 FROM users WHERE id = ?').get(body.defaultAssigneeId)) throw L.bad('Unknown user.'); upd.default_assignee_id = body.defaultAssigneeId || null; }
  if (body.active !== undefined) upd.active = body.active ? 1 : 0;
  return upd;
}
const requireForm = (id) => { const f = db.prepare('SELECT * FROM forms WHERE id = ?').get(id); if (!f) throw L.notFound('Form not found.'); return f; };

r.get('/forms', L.wrap((req, res) => {
  if (req.query.project) P.assert(req, req.query.project);
  const rows = req.query.project
    ? db.prepare('SELECT * FROM forms WHERE project_key = ? COLLATE NOCASE ORDER BY active DESC, name').all(req.query.project)
    : db.prepare('SELECT * FROM forms ORDER BY active DESC, name').all();
  res.json(rows.filter((f) => P.can(req, f.project_key, 'BROWSE_PROJECT')).map(formOut));
}));
r.get('/forms/:id', L.wrap((req, res) => { const f = requireForm(req.params.id); P.assert(req, f.project_key); res.json(formOut(f)); }));
r.post('/forms', L.wrap((req, res) => {
  const upd = formFields({ issueType: 'Task', fields: ['summary', 'description'], defaultLabels: ['form'], active: true, ...req.body });
  if (!upd.name) throw L.bad('Form name is required.');
  const t = L.now();
  const pk = P.assert(req, req.body.projectKey || 'KAN', 'ADMINISTER_PROJECT').key;
  const info = db.prepare('INSERT INTO forms (name,description,issue_type,fields,default_labels,default_assignee_id,active,submissions,created_by,created_at,updated_at,project_key) VALUES (?,?,?,?,?,?,?,0,?,?,?,?)')
    .run(upd.name, upd.description || '', upd.issue_type, upd.fields, upd.default_labels, upd.default_assignee_id ?? null, upd.active, req.user.id, t, t, pk);
  res.status(201).json(formOut(requireForm(info.lastInsertRowid)));
}));
r.patch('/forms/:id', L.wrap((req, res) => {
  const f = requireForm(req.params.id);
  P.assert(req, f.project_key, 'ADMINISTER_PROJECT');
  const upd = formFields(req.body || {});
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE forms SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...cols.map((c) => upd[c]), L.now(), f.id);
  res.json(formOut(requireForm(f.id)));
}));
r.delete('/forms/:id', L.wrap((req, res) => { P.assert(req, requireForm(req.params.id).project_key, 'ADMINISTER_PROJECT'); db.prepare('DELETE FROM forms WHERE id = ?').run(req.params.id); res.json({ ok: true }); }));
r.post('/forms/:id/submit', L.wrap((req, res) => {
  const form = formOut(requireForm(req.params.id));
  P.assert(req, form.projectKey, 'CREATE_ISSUES');
  if (!form.active) throw L.bad('This form is not accepting submissions.');
  const v = req.body?.values || {};
  const body = { projectKey: form.projectKey, type: form.issueType, assigneeId: form.defaultAssigneeId, labels: form.defaultLabels };
  for (const f of form.fields) if (v[f] !== undefined && v[f] !== '') body[f] = v[f];
  if (form.fields.includes('labels') && Array.isArray(v.labels)) body.labels = [...new Set([...form.defaultLabels, ...v.labels])];
  body.description = `${body.description || ''}\n\n— Submitted via form “${form.name}”`.trim();
  const issue = L.createIssue(body, req.user.id);
  db.prepare('UPDATE forms SET submissions = submissions + 1 WHERE id = ?').run(form.id);
  res.status(201).json(issue);
}));

// ---------- code / development ----------
const devOut = (d) => ({ id: d.id, kind: d.kind, repo: d.repo, name: d.name, ref: d.ref, status: d.status, authorId: d.author_id, created: d.created_at, issue: d.key ? { key: d.key, summary: d.summary, type: d.type, status: d.istatus } : null });
r.get('/dev', L.wrap((req, res) => {
  const where = []; const params = [];
  if (req.query.kind) { where.push('d.kind = ?'); params.push(req.query.kind); }
  if (req.query.repo) { where.push('d.repo = ?'); params.push(req.query.repo); }
  if (req.query.status) { where.push('d.status = ?'); params.push(req.query.status); }
  const rows = db.prepare(`SELECT d.*, i.key, i.summary, i.type, i.status AS istatus FROM dev_items d LEFT JOIN issues i ON i.id = d.issue_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY d.created_at DESC`).all(...params);
  res.json(rows.filter((d) => !d.key || P.can(req, d.key.split('-')[0], 'BROWSE_PROJECT')).map(devOut));
}));
r.patch('/dev/:id', L.wrap((req, res) => {
  const d = db.prepare('SELECT * FROM dev_items WHERE id = ?').get(req.params.id);
  if (!d) throw L.notFound('Item not found.');
  const dIssue = d.issue_id && db.prepare('SELECT key FROM issues WHERE id = ?').get(d.issue_id);
  if (dIssue) issueFor(req, dIssue.key, 'EDIT_ISSUES');
  if (dIssue && req.body?.transition) issueFor(req, dIssue.key, 'TRANSITION_ISSUES');
  if (d.kind !== 'pr') throw L.bad('Only pull requests have a status.');
  if (!['open', 'merged', 'declined'].includes(req.body?.status)) throw L.bad('Status must be open, merged or declined.');
  db.prepare('UPDATE dev_items SET status = ? WHERE id = ?').run(req.body.status, d.id);
  if (req.body.status === 'merged' && d.issue_id && req.body.transition) {
    const row = db.prepare('SELECT * FROM issues WHERE id = ?').get(d.issue_id);
    if (row.status !== 'Done') L.applyUpdate(row, { status: 'Done' }, req.user.id);
  }
  res.json(devOut(db.prepare('SELECT d.*, i.key, i.summary, i.type, i.status AS istatus FROM dev_items d LEFT JOIN issues i ON i.id = d.issue_id WHERE d.id = ?').get(d.id)));
}));
r.delete('/dev/:id', L.wrap((req, res) => {
  const d = db.prepare('SELECT d.*, i.key FROM dev_items d LEFT JOIN issues i ON i.id = d.issue_id WHERE d.id = ?').get(req.params.id);
  if (d?.key) issueFor(req, d.key, 'EDIT_ISSUES');
  const info = db.prepare('DELETE FROM dev_items WHERE id = ?').run(req.params.id);
  if (!info.changes) throw L.notFound('Item not found.');
  res.json({ ok: true });
}));

// Webhook for commits (e.g. from a CI job): { repo, commits: [{ id, message, authorEmail }] }
// Every issue key found in a commit message (e.g. "KAN-12 fix …") links that commit to the issue.
r.post('/webhooks/commits', L.wrap((req, res) => {
  const { repo, commits } = req.body || {};
  if (!repo || !Array.isArray(commits)) throw L.bad('repo and commits[] are required.');
  let linked = 0;
  const ins = db.prepare('INSERT INTO dev_items (issue_id,kind,repo,name,ref,status,author_id,created_at) VALUES (?,?,?,?,?,NULL,?,?)');
  db.transaction(() => {
    for (const c of commits.slice(0, 200)) {
      const msg = String(c.message || '').split('\n')[0].slice(0, 255);
      const author = c.authorEmail ? db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(c.authorEmail)?.id : req.user.id;
      const keys = [...new Set((msg.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || []))];
      for (const k of keys) {
        const issue = L.getRawIssue(k);
        if (!issue || !P.can(req, issue.project_key, 'EDIT_ISSUES')) continue;
        ins.run(issue.id, 'commit', String(repo), msg, String(c.id || '').slice(0, 40) || null, author ?? null, L.now());
        linked++;
      }
    }
  })();
  res.json({ ok: true, linked });
}));

// ---------- demo reset (admin) ----------
r.post('/reset', A.requireAdmin, L.wrap((req, res) => {
  require('../seed')({ force: true });
  // re-create a session for the caller so they stay logged in
  const uid = db.prepare('SELECT 1 FROM users WHERE id = ?').get(req.user.id) ? req.user.id : 'u1';
  const session = A.createSession(uid, { userAgent: req.headers['user-agent'] });
  A.setSessionCookie(req, res, session);
  res.json({ ok: true, token: session.token });
}));

module.exports = r;
