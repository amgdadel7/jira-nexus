// Projects: directory, create / edit / delete, and per-user stars.
const express = require('express');
const db = require('../db');
const L = require('../lib');
const PM = require('../perms');

const r = express.Router();
const TYPES = ['software', 'business', 'service'];
const COLORS = ['#FFAB00', '#0C66E4', '#22A06B', '#E2483D', '#6E5DC6', '#1D7AFC', '#D97008', '#943D73'];
const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;

function projectOut(p, userId, req) {
  const st = db.prepare(`SELECT COUNT(*) total, SUM(status = 'Done') done, SUM(status != 'Done') open, MAX(updated_at) last
    FROM issues WHERE project_key = ?`).get(p.key);
  return {
    key: p.key, name: p.name, type: p.type, description: p.description, leadId: p.lead_id, color: p.color,
    category: p.category, created: p.created_at, access: p.access,
    ...(req ? { myRole: PM.permsFor(req, p.key).role, members: db.prepare('SELECT COUNT(*) c FROM project_members WHERE project_key = ?').get(p.key).c } : {}),
    starred: !!db.prepare('SELECT 1 FROM project_stars WHERE user_id = ? AND project_key = ?').get(userId, p.key),
    stats: { total: st.total, done: st.done || 0, open: st.open || 0, lastActivity: st.last },
  };
}

function fields(body, existing) {
  const upd = {};
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) throw L.bad('Project name is required.');
    if (n.length > 80) throw L.bad('Project name must be 80 characters or less.');
    if (db.prepare('SELECT 1 FROM projects WHERE name = ? COLLATE NOCASE AND key != ?').get(n, existing?.key || '')) throw L.bad('A project with that name already exists.');
    upd.name = n;
  }
  if (body.description !== undefined) upd.description = String(body.description).slice(0, 2000);
  if (body.type !== undefined) { if (!TYPES.includes(body.type)) throw L.bad('Invalid project type.'); upd.type = body.type; }
  if (body.category !== undefined) upd.category = String(body.category).trim().slice(0, 60);
  if (body.color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(body.color)) throw L.bad('Color must be a hex value like #0C66E4.'); upd.color = body.color; }
  if (body.access !== undefined) { if (!PM.ACCESS.includes(body.access)) throw L.bad('Access must be open, limited or private.'); if (body.access !== 'open' && body.access !== existing?.access) require('../billing').assertFeature('permissions'); upd.access = body.access; }
  if (body.leadId !== undefined) {
    if (body.leadId && !db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(body.leadId)) throw L.bad('Unknown or inactive user.');
    upd.lead_id = body.leadId || null;
  }
  return upd;
}

r.get('/projects', L.wrap((req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM projects ORDER BY name').all()
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
    .filter((p) => PM.can(req, p.key, 'BROWSE_PROJECT'));
  res.json(rows.map((p) => projectOut(p, req.user.id, req)));
}));

r.get('/projects/:key', L.wrap((req, res) => res.json(projectOut(PM.assert(req, req.params.key), req.user.id, req))));

r.post('/projects', L.wrap((req, res) => {
  PM.assertGlobal(req, 'CREATE_PROJECTS');
  const b = req.body || {};
  const key = String(b.key || '').trim().toUpperCase();
  if (!KEY_RE.test(key)) throw L.bad('Project key must be 2–10 characters: a letter followed by letters or numbers.');
  if (db.prepare('SELECT 1 FROM projects WHERE key = ?').get(key)) throw L.bad(`The key ${key} is already in use.`);
  if (!b.name) throw L.bad('Project name is required.');
  const count = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
  const upd = fields({ type: 'software', color: COLORS[count % COLORS.length], leadId: req.user.id, ...b });
  const t = L.now();
  db.transaction(() => {
    db.prepare('INSERT INTO projects (key,name,type,description,lead_id,color,category,created_at,next_num,access) VALUES (?,?,?,?,?,?,?,?,1,?)')
      .run(key, upd.name, upd.type, upd.description || '', upd.lead_id ?? null, upd.color, upd.category || '', t, upd.access || 'open');
    // the creator administers the new project
    db.prepare('INSERT OR IGNORE INTO project_members (project_key,user_id,role,added_by,added_at) VALUES (?,?,?,?,?)').run(key, req.user.id, 'admin', req.user.id, t);
    if (upd.lead_id && upd.lead_id !== req.user.id) db.prepare('INSERT OR IGNORE INTO project_members (project_key,user_id,role,added_by,added_at) VALUES (?,?,?,?,?)').run(key, upd.lead_id, 'admin', req.user.id, t);
    // Scrum projects start with an empty first sprint, like Jira.
    if (upd.type === 'software') {
      const pos = (db.prepare('SELECT MAX(position) m FROM sprints').get().m ?? -1) + 1;
      db.prepare("INSERT INTO sprints (project_key,name,goal,state,position,created_at) VALUES (?,?,'','future',?,?)").run(key, `${key} Sprint 1`, pos, t);
    }
    db.prepare('INSERT OR IGNORE INTO project_stars (user_id,project_key) VALUES (?,?)').run(req.user.id, key);
  })();
  PM.audit(req, 'project.created', { project: key, target: key, details: { name: upd.name, type: upd.type, access: upd.access || 'open' } });
  res.status(201).json(projectOut(L.requireProject(key), req.user.id, req));
}));

r.patch('/projects/:key', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key, 'ADMINISTER_PROJECT');
  const upd = fields(req.body || {}, p);
  const cols = Object.keys(upd).filter((c) => String(upd[c] ?? '') !== String(p[c] ?? ''));
  if (cols.length) {
    db.prepare(`UPDATE projects SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE key = ?`).run(...cols.map((c) => upd[c]), p.key);
    const details = Object.fromEntries(cols.map((c) => [c, { from: p[c] ?? null, to: upd[c] ?? null }]));
    if (details.description) details.description = { changed: true };
    PM.audit(req, cols.includes('access') ? 'project.access_changed' : 'project.updated', { project: p.key, target: p.key, details });
  }
  res.json(projectOut(L.requireProject(p.key), req.user.id, req));
}));

// Deleting a project removes its work items, sprints, releases and forms. Admins only; the last project cannot be deleted.
r.delete('/projects/:key', L.wrap((req, res) => {
  if (req.user.role !== 'admin') throw L.forbidden('Only administrators can delete projects.');
  const p = L.requireProject(req.params.key);
  if (db.prepare('SELECT COUNT(*) c FROM projects').get().c <= 1) throw L.bad('You cannot delete the only project.');
  if (req.body?.confirm !== undefined && String(req.body.confirm).toUpperCase() !== p.key) throw L.bad(`Type ${p.key} to confirm.`);
  let removed = 0;
  db.transaction(() => {
    const ids = db.prepare('SELECT id FROM issues WHERE project_key = ?').all(p.key).map((x) => x.id);
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      db.prepare(`UPDATE issues SET parent_id = NULL WHERE parent_id IN (${ph}) AND project_key != ?`).run(...ids, p.key);
    }
    removed = db.prepare('DELETE FROM issues WHERE project_key = ?').run(p.key).changes;
    db.prepare('DELETE FROM sprints WHERE project_key = ?').run(p.key);
    db.prepare('DELETE FROM versions WHERE project_key = ?').run(p.key);
    db.prepare('DELETE FROM forms WHERE project_key = ?').run(p.key);
    db.prepare('DELETE FROM project_stars WHERE project_key = ?').run(p.key);
    db.prepare('DELETE FROM trash WHERE project_key = ?').run(p.key);
    db.prepare('DELETE FROM projects WHERE key = ?').run(p.key);
  })();
  PM.audit(req, 'project.deleted', { project: p.key, target: p.key, details: { name: p.name, removedIssues: removed } });
  res.json({ ok: true, removedIssues: removed });
}));

r.post('/projects/:key/star', L.wrap((req, res) => {
  const p = PM.assert(req, req.params.key);
  db.prepare('INSERT OR IGNORE INTO project_stars (user_id,project_key) VALUES (?,?)').run(req.user.id, p.key);
  res.json({ ok: true, starred: true });
}));
r.delete('/projects/:key/star', L.wrap((req, res) => {
  const p = L.requireProject(req.params.key);
  db.prepare('DELETE FROM project_stars WHERE user_id = ? AND project_key = ?').run(req.user.id, p.key);
  res.json({ ok: true, starred: false });
}));

module.exports = r;
module.exports.KEY_RE = KEY_RE;
