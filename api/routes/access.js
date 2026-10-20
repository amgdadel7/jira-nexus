// People & roles, permission schemes, global permissions, board settings, components, recycle bin,
// audit log and teams.
const express = require('express');
const db = require('../db');
const A = require('../auth');
const L = require('../lib');
const PM = require('../perms');
const T = require('../trash');

const B = require('../billing');
const r = express.Router();
const userRow = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// ======================= project people & roles =======================
function membersOut(req, p) {
  const explicit = db.prepare('SELECT m.user_id, m.role, m.added_by, m.added_at FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_key = ? ORDER BY u.name').all(p.key);
  const byId = new Map(explicit.map((m) => [m.user_id, m]));
  const users = db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY name').all();
  // everyone with access, explaining where their role comes from
  const people = [];
  for (const u of users) {
    const m = byId.get(u.id);
    const effective = PM.roleFor(u, p);
    if (!effective) continue;
    const source = u.role === 'admin' ? 'site-admin' : p.lead_id === u.id ? 'lead' : m ? 'member' : 'access-level';
    if (source === 'access-level') continue; // listed separately as "everyone else"
    people.push({ user: A.publicUser(u), role: m?.role || effective, effectiveRole: effective, source, explicit: !!m, addedBy: m?.added_by || null, added: m?.added_at || null });
  }
  return {
    project: { key: p.key, name: p.name, access: p.access, leadId: p.lead_id },
    roles: PM.ROLES.map((id) => ({ id, label: PM.ROLE_LABEL[id] })),
    everyoneElse: p.access === 'open' || !B.feature('permissions') ? 'member' : p.access === 'limited' ? 'viewer' : null,
    people,
    canManage: PM.can(req, p.key, 'ADMINISTER_PROJECT'),
    planLocked: !B.feature('permissions'),
  };
}

r.get('/projects/:key/members', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key);
  res.json(membersOut(req, p));
}));

r.post('/projects/:key/members', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  const ids = Array.isArray(req.body?.userIds) ? req.body.userIds : [req.body?.userId].filter(Boolean);
  const role = req.body?.role || 'member';
  if (!PM.ROLES.includes(role)) throw L.bad('Role must be admin, member or viewer.');
  if (!ids.length) throw L.bad('Choose at least one person.');
  const t = L.now();
  const ins = db.prepare('INSERT INTO project_members (project_key,user_id,role,added_by,added_at) VALUES (?,?,?,?,?) ON CONFLICT(project_key,user_id) DO UPDATE SET role = excluded.role');
  db.transaction(() => {
    for (const id of ids) {
      const u = userRow(id);
      if (!u || !u.active) throw L.bad('Unknown or inactive user.');
      ins.run(p.key, id, role, req.user.id, t);
      PM.audit(req, 'member.added', { project: p.key, target: u.name, details: { userId: id, role } });
    }
  })();
  res.status(201).json(membersOut(req, p));
}));

r.patch('/projects/:key/members/:userId', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  const role = req.body?.role;
  if (!PM.ROLES.includes(role)) throw L.bad('Role must be admin, member or viewer.');
  const u = userRow(req.params.userId);
  if (!u) throw L.notFound('User not found.');
  if (p.lead_id === u.id && role !== 'admin') throw L.bad(`${u.name} is the project lead and is always an administrator. Change the lead first.`);
  if (u.id === req.user.id && role !== 'admin' && req.user.role !== 'admin') throw L.bad('You can’t remove your own administrator role. Ask another administrator.');
  const before = db.prepare('SELECT role FROM project_members WHERE project_key = ? AND user_id = ?').get(p.key, u.id)?.role || null;
  db.prepare('INSERT INTO project_members (project_key,user_id,role,added_by,added_at) VALUES (?,?,?,?,?) ON CONFLICT(project_key,user_id) DO UPDATE SET role = excluded.role')
    .run(p.key, u.id, role, req.user.id, L.now());
  PM.audit(req, 'member.role_changed', { project: p.key, target: u.name, details: { userId: u.id, from: before, to: role } });
  res.json(membersOut(req, p));
}));

r.delete('/projects/:key/members/:userId', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  const u = userRow(req.params.userId);
  if (!u) throw L.notFound('User not found.');
  if (p.lead_id === u.id) throw L.bad(`${u.name} is the project lead. Choose a different lead before removing them.`);
  if (u.id === req.user.id && req.user.role !== 'admin') throw L.bad('You can’t remove yourself. Ask another administrator.');
  const info = db.prepare('DELETE FROM project_members WHERE project_key = ? AND user_id = ?').run(p.key, u.id);
  if (!info.changes) throw L.notFound(`${u.name} isn’t a member of this project.`);
  PM.audit(req, 'member.removed', { project: p.key, target: u.name, details: { userId: u.id } });
  res.json(membersOut(req, p));
}));

// ======================= permission scheme =======================
function schemeOut(req, p) {
  const scheme = PM.schemeFor(p);
  const isDefault = PM.PERM_KEYS.every((k) => [...scheme[k]].sort().join() === [...new Set([...(PM.LOCKED[k] || []), ...PM.DEFAULT_SCHEME[k]])].sort().join());
  return {
    project: p.key,
    roles: PM.ROLES.map((id) => ({ id, label: PM.ROLE_LABEL[id] })),
    permissions: PM.PERMISSIONS,
    scheme, defaults: PM.DEFAULT_SCHEME, locked: PM.LOCKED, isDefault,
    mine: PM.describe(req, p.key),
    canManage: PM.can(req, p.key, 'ADMINISTER_PROJECT'),
    planLocked: !B.feature('permissions'),
  };
}
r.get('/projects/:key/permissions', L.wrap((req, res) => res.json(schemeOut(req, PM.assert(req, req.params.key)))));
r.put('/projects/:key/permissions', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  B.assertFeature('permissions');
  const input = req.body?.scheme;
  if (!input || typeof input !== 'object') throw L.bad('scheme is required: { PERMISSION: [roles] }.');
  const before = PM.schemeFor(p);
  const next = {};
  for (const k of PM.PERM_KEYS) {
    const roles = Array.isArray(input[k]) ? input[k] : before[k];
    const bad = roles.filter((x) => !PM.ROLES.includes(x));
    if (bad.length) throw L.bad(`Unknown role: ${bad.join(', ')}.`);
    for (const must of PM.LOCKED[k] || []) if (!roles.includes(must)) throw L.bad(`Administrators must always have “${PM.PERMISSIONS.find((x) => x.key === k).name}”.`);
    next[k] = [...new Set(roles)];
  }
  db.prepare('UPDATE projects SET permissions = ? WHERE key = ?').run(JSON.stringify(next), p.key);
  const changes = PM.PERM_KEYS.filter((k) => [...before[k]].sort().join() !== [...next[k]].sort().join())
    .map((k) => ({ permission: k, from: before[k], to: next[k] }));
  if (changes.length) PM.audit(req, 'permissions.changed', { project: p.key, target: p.key, details: { changes } });
  req._perm = null; // clear the per-request cache
  res.json(schemeOut(req, L.requireProject(p.key)));
}));
r.post('/projects/:key/permissions/reset', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  db.prepare('UPDATE projects SET permissions = NULL WHERE key = ?').run(p.key);
  PM.audit(req, 'permissions.reset', { project: p.key, target: p.key });
  req._perm = null;
  res.json(schemeOut(req, L.requireProject(p.key)));
}));

// what can I do? (any project; handy for API clients)
r.get('/mypermissions', L.wrap((req, res) => {
  const p = PM.assert(req, req.query.project || 'KAN');
  res.json({ project: p.key, ...PM.describe(req, p.key), global: PM.GLOBAL_PERMISSIONS.map((g) => g.key).filter((k) => PM.canGlobal(req.user, k)) });
}));

// ======================= global permissions =======================
r.get('/permissions/global', L.wrap((req, res) => {
  res.json({ permissions: PM.GLOBAL_PERMISSIONS, roles: [{ id: 'admin', label: 'Site administrators' }, { id: 'member', label: 'All users' }],
    scheme: PM.globalScheme(), defaults: PM.GLOBAL_DEFAULT, mine: PM.GLOBAL_PERMISSIONS.map((g) => g.key).filter((k) => PM.canGlobal(req.user, k)), canManage: req.user.role === 'admin', planLocked: !B.feature('permissions') });
}));
r.put('/permissions/global', A.requireAdmin, L.wrap((req, res) => {
  B.assertFeature('permissions');
  const input = req.body?.scheme;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw L.bad('scheme is required: { PERMISSION: [roles] }.');
  const before = PM.globalScheme();
  const next = {};
  for (const g of PM.GLOBAL_PERMISSIONS) {
    const roles = Array.isArray(input[g.key]) ? input[g.key] : before[g.key];
    next[g.key] = [...new Set(['admin', ...roles.filter((x) => x === 'member')])];
  }
  db.prepare("INSERT INTO site_settings (key,value) VALUES ('global_permissions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
  const changes = Object.keys(next).filter((k) => before[k].join() !== next[k].join()).map((k) => ({ permission: k, from: before[k], to: next[k] }));
  if (changes.length) PM.audit(req, 'global_permissions.changed', { details: { changes } });
  res.json({ scheme: PM.globalScheme() });
}));

// ======================= board settings (WIP limits, swimlanes) =======================
const SWIMLANES = ['none', 'assignee', 'epic', 'priority', 'type'];
r.patch('/projects/:key/board', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  let cfg = {}; try { cfg = JSON.parse(p.board_config || '{}'); } catch { cfg = {}; }
  const b = req.body || {};
  if (b.wip !== undefined) {
    if (typeof b.wip !== 'object' || !b.wip) throw L.bad('wip must be an object of { status: limit }.');
    const wip = {};
    for (const [status, n] of Object.entries(b.wip)) {
      if (!require('../jql').STATUS_ORDER.includes(status)) throw L.bad(`Unknown status '${status}'.`);
      if (n === null || n === '' || n === 0) continue;
      const v = Number(n);
      if (!Number.isInteger(v) || v < 1 || v > 999) throw L.bad('WIP limits must be whole numbers between 1 and 999.');
      wip[status] = v;
    }
    cfg.wip = wip;
  }
  if (b.swimlanes !== undefined) {
    if (!SWIMLANES.includes(b.swimlanes)) throw L.bad(`swimlanes must be one of ${SWIMLANES.join(', ')}.`);
    cfg.swimlanes = b.swimlanes;
  }
  db.prepare('UPDATE projects SET board_config = ? WHERE key = ?').run(JSON.stringify(cfg), p.key);
  PM.audit(req, 'board.updated', { project: p.key, target: p.key, details: cfg });
  res.json({ wip: cfg.wip || {}, swimlanes: cfg.swimlanes || 'none' });
}));

// ======================= components =======================
const DEFAULT_ASSIGNEE = ['unassigned', 'project_lead', 'component_lead'];
function componentOut(c) {
  const n = db.prepare('SELECT COUNT(*) c, SUM(i.status != \'Done\') open FROM issues i, json_each(i.components) j WHERE i.project_key = ? AND j.value = ?').get(c.project_key, c.name);
  return { id: c.id, projectKey: c.project_key, name: c.name, description: c.description, leadId: c.lead_id, defaultAssignee: c.default_assignee, created: c.created_at, issueCount: n.c, openCount: n.open || 0 };
}
const requireComponent = (id) => { const c = db.prepare('SELECT * FROM components WHERE id = ?').get(id); if (!c) throw L.notFound('Component not found.'); return c; };
function componentFields(b, existing, projectKey) {
  const upd = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) throw L.bad('Component name is required.');
    if (n.length > 80) throw L.bad('Component name must be 80 characters or less.');
    if (db.prepare('SELECT 1 FROM components WHERE project_key = ? AND name = ? COLLATE NOCASE AND id != ?').get(projectKey, n, existing?.id || 0)) throw L.bad(`A component called '${n}' already exists.`);
    upd.name = n;
  }
  if (b.description !== undefined) upd.description = String(b.description).slice(0, 1000);
  if (b.leadId !== undefined) { if (b.leadId && !userRow(b.leadId)) throw L.bad('Unknown user.'); upd.lead_id = b.leadId || null; }
  if (b.defaultAssignee !== undefined) { if (!DEFAULT_ASSIGNEE.includes(b.defaultAssignee)) throw L.bad('Invalid default assignee.'); upd.default_assignee = b.defaultAssignee; }
  return upd;
}
r.get('/components', L.wrap((req, res) => {
  const p = PM.assert(req, req.query.project || 'KAN');
  res.json(db.prepare('SELECT * FROM components WHERE project_key = ? ORDER BY name').all(p.key).map(componentOut));
}));
r.post('/components', L.wrap((req, res) => {
  const p = PM.assert(req, req.body?.projectKey || 'KAN', 'ADMINISTER_PROJECT');
  const upd = componentFields({ defaultAssignee: 'unassigned', ...req.body }, null, p.key);
  if (!upd.name) throw L.bad('Component name is required.');
  const info = db.prepare('INSERT INTO components (project_key,name,description,lead_id,default_assignee,created_at) VALUES (?,?,?,?,?,?)')
    .run(p.key, upd.name, upd.description || '', upd.lead_id ?? null, upd.default_assignee, L.now());
  PM.audit(req, 'component.created', { project: p.key, target: upd.name });
  res.status(201).json(componentOut(requireComponent(info.lastInsertRowid)));
}));
r.patch('/components/:id', L.wrap((req, res) => {
  const c = requireComponent(req.params.id);
  PM.assert(req, c.project_key, 'ADMINISTER_PROJECT');
  const upd = componentFields(req.body || {}, c, c.project_key);
  const cols = Object.keys(upd);
  db.transaction(() => {
    if (cols.length) db.prepare(`UPDATE components SET ${cols.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((x) => upd[x]), c.id);
    if (upd.name && upd.name !== c.name) {
      // rename inside every work item that uses it
      const rows = db.prepare('SELECT i.id, i.components FROM issues i, json_each(i.components) j WHERE i.project_key = ? AND j.value = ?').all(c.project_key, c.name);
      const up = db.prepare('UPDATE issues SET components = ? WHERE id = ?');
      rows.forEach((x) => up.run(JSON.stringify(JSON.parse(x.components).map((n) => (n === c.name ? upd.name : n))), x.id));
    }
  })();
  if (cols.length) PM.audit(req, 'component.updated', { project: c.project_key, target: upd.name || c.name, details: { fields: cols } });
  res.json(componentOut(requireComponent(c.id)));
}));
r.delete('/components/:id', L.wrap((req, res) => {
  const c = requireComponent(req.params.id);
  PM.assert(req, c.project_key, 'ADMINISTER_PROJECT');
  const moveTo = req.body?.moveTo ? requireComponent(req.body.moveTo) : null;
  if (moveTo && (moveTo.project_key !== c.project_key || moveTo.id === c.id)) throw L.bad('Choose another component in the same project.');
  let affected = 0;
  db.transaction(() => {
    const rows = db.prepare('SELECT i.id, i.components FROM issues i, json_each(i.components) j WHERE i.project_key = ? AND j.value = ?').all(c.project_key, c.name);
    const up = db.prepare('UPDATE issues SET components = ? WHERE id = ?');
    rows.forEach((x) => {
      let list = JSON.parse(x.components).filter((n) => n !== c.name);
      if (moveTo && !list.includes(moveTo.name)) list = [...list, moveTo.name];
      up.run(JSON.stringify(list), x.id); affected++;
    });
    db.prepare('DELETE FROM components WHERE id = ?').run(c.id);
  })();
  PM.audit(req, 'component.deleted', { project: c.project_key, target: c.name, details: { affected, movedTo: moveTo?.name || null } });
  res.json({ ok: true, affected });
}));

// ======================= recycle bin =======================
r.get('/trash', L.wrap((req, res) => {
  const p = PM.assert(req, req.query.project || 'KAN', 'DELETE_ISSUES');
  T.purgeExpired();
  res.json({ retentionDays: T.retentionDays(), canPurge: PM.can(req, p.key, 'ADMINISTER_PROJECT'),
    items: db.prepare('SELECT * FROM trash WHERE project_key = ? ORDER BY deleted_at DESC').all(p.key).map(T.entryOut) });
}));
const requireTrash = (id) => { const e = db.prepare('SELECT * FROM trash WHERE id = ?').get(id); if (!e) throw L.notFound('That item is no longer in the recycle bin.'); return e; };
r.post('/trash/:id/restore', L.wrap((req, res) => {
  const e = requireTrash(req.params.id);
  PM.assert(req, e.project_key, 'DELETE_ISSUES');
  const key = T.restore(e);
  PM.audit(req, 'issue.restored', { project: e.project_key, target: key, details: { summary: e.summary } });
  res.json({ ok: true, key });
}));
r.delete('/trash/:id', L.wrap((req, res) => {
  const e = requireTrash(req.params.id);
  PM.assert(req, e.project_key, 'ADMINISTER_PROJECT');
  T.purge(e);
  PM.audit(req, 'issue.purged', { project: e.project_key, target: e.issue_key, details: { summary: e.summary } });
  res.json({ ok: true });
}));

// ======================= audit log =======================
r.get('/audit', L.wrap((req, res) => {
  const project = req.query.project ? String(req.query.project).toUpperCase() : null;
  if (project) PM.assert(req, project, 'ADMINISTER_PROJECT');
  else if (req.user.role !== 'admin') throw L.forbidden('Only site administrators can see the global audit log.');
  B.assertFeature('audit_log');
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const where = []; const params = {};
  if (project) { where.push('project_key = @project'); params.project = project; }
  if (req.query.action) { where.push("action LIKE @action ESCAPE '\\'"); params.action = `${String(req.query.action).replace(/[\\%_]/g, (c) => `\\${c}`)}%`; }
  if (req.query.actor) { where.push('actor_id = @actor'); params.actor = String(req.query.actor); }
  const rows = db.prepare(`SELECT * FROM audit_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT @limit`).all({ ...params, limit });
  res.json(rows.map((a) => ({ id: a.id, actorId: a.actor_id, action: a.action, project: a.project_key, target: a.target, details: JSON.parse(a.details || '{}'), created: a.created_at })));
}));

// ======================= teams =======================
function teamOut(t, full = false) {
  const members = db.prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(t.id).map((x) => x.user_id);
  const out = { id: t.id, name: t.name, description: t.description, color: t.color, createdBy: t.created_by, created: t.created_at, members };
  const st = db.prepare("SELECT COUNT(*) c, SUM(status != 'Done') open FROM issues WHERE team_id = ?").get(t.id);
  out.issueCount = st.c; out.openCount = st.open || 0;
  if (full) out.memberCount = members.length;
  return out;
}
const requireTeam = (id) => { const t = db.prepare('SELECT * FROM teams WHERE id = ?').get(id); if (!t) throw L.notFound('Team not found.'); return t; };
function canEditTeam(req, t) {
  return PM.canGlobal(req.user, 'MANAGE_TEAMS') && (req.user.role === 'admin' || t.created_by === req.user.id || db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(t.id, req.user.id));
}
function teamFields(b, existing) {
  const upd = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) throw L.bad('Team name is required.');
    if (db.prepare('SELECT 1 FROM teams WHERE name = ? COLLATE NOCASE AND id != ?').get(n, existing?.id || 0)) throw L.bad('A team with that name already exists.');
    upd.name = n.slice(0, 80);
  }
  if (b.description !== undefined) upd.description = String(b.description).slice(0, 1000);
  if (b.color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(b.color)) throw L.bad('Invalid colour.'); upd.color = b.color; }
  return upd;
}
r.get('/teams', L.wrap((req, res) => res.json(db.prepare('SELECT * FROM teams ORDER BY name').all().map((t) => ({ ...teamOut(t), canEdit: !!canEditTeam(req, t) })))));
r.get('/teams/:id', L.wrap((req, res) => { const t = requireTeam(req.params.id); res.json({ ...teamOut(t, true), canEdit: !!canEditTeam(req, t) }); }));
r.post('/teams', L.wrap((req, res) => {
  PM.assertGlobal(req, 'MANAGE_TEAMS');
  const upd = teamFields({ color: '#0C66E4', ...req.body });
  if (!upd.name) throw L.bad('Team name is required.');
  const id = db.transaction(() => {
    const info = db.prepare('INSERT INTO teams (name,description,color,created_by,created_at) VALUES (?,?,?,?,?)').run(upd.name, upd.description || '', upd.color, req.user.id, L.now());
    const members = [...new Set([req.user.id, ...(Array.isArray(req.body.members) ? req.body.members : [])])].filter((u) => userRow(u));
    const ins = db.prepare('INSERT OR IGNORE INTO team_members (team_id,user_id) VALUES (?,?)');
    members.forEach((u) => ins.run(info.lastInsertRowid, u));
    return info.lastInsertRowid;
  })();
  PM.audit(req, 'team.created', { target: upd.name });
  res.status(201).json(teamOut(requireTeam(id), true));
}));
r.patch('/teams/:id', L.wrap((req, res) => {
  const t = requireTeam(req.params.id);
  if (!canEditTeam(req, t)) throw L.forbidden('Only team members or administrators can change this team.');
  const upd = teamFields(req.body || {}, t);
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE teams SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => upd[c]), t.id);
  if (Array.isArray(req.body?.members)) {
    const ids = [...new Set(req.body.members)].filter((u) => userRow(u));
    db.transaction(() => {
      db.prepare('DELETE FROM team_members WHERE team_id = ?').run(t.id);
      const ins = db.prepare('INSERT INTO team_members (team_id,user_id) VALUES (?,?)');
      ids.forEach((u) => ins.run(t.id, u));
    })();
  }
  PM.audit(req, 'team.updated', { target: upd.name || t.name, details: { fields: cols, members: Array.isArray(req.body?.members) ? req.body.members.length : undefined } });
  res.json(teamOut(requireTeam(t.id), true));
}));
r.delete('/teams/:id', L.wrap((req, res) => {
  const t = requireTeam(req.params.id);
  if (!canEditTeam(req, t)) throw L.forbidden('Only team members or administrators can delete this team.');
  db.transaction(() => {
    db.prepare('UPDATE issues SET team_id = NULL WHERE team_id = ?').run(t.id);
    db.prepare('DELETE FROM teams WHERE id = ?').run(t.id);
  })();
  PM.audit(req, 'team.deleted', { target: t.name });
  res.json({ ok: true });
}));

module.exports = r;
