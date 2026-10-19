// Releases (fix versions): plan what ships together, track progress, release and archive.
const express = require('express');
const db = require('../db');
const L = require('../lib');
const PM = require('../perms');

const r = express.Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['unreleased', 'released', 'archived'];

function versionOut(v) {
  const st = db.prepare(`SELECT COUNT(*) total, SUM(status = 'Done') done, SUM(status != 'Done' AND status != 'To Do') prog,
    COALESCE(SUM(story_points),0) points FROM issues WHERE project_key = ? AND fix_version = ?`).get(v.project_key, v.name);
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: v.id, projectKey: v.project_key, name: v.name, description: v.description, status: v.status,
    startDate: v.start_date, releaseDate: v.release_date, releasedAt: v.released_at, position: v.position, created: v.created_at,
    overdue: v.status === 'unreleased' && !!v.release_date && v.release_date < today,
    stats: { total: st.total, done: st.done || 0, inProgress: st.prog || 0, todo: st.total - (st.done || 0) - (st.prog || 0), points: st.points },
  };
}
const requireVersion = (id) => {
  const v = db.prepare('SELECT * FROM versions WHERE id = ?').get(id);
  if (!v) throw L.notFound('Version not found.');
  return v;
};
const get = (id) => versionOut(requireVersion(id));

function fields(b, P, exceptId = 0) {
  const upd = {};
  if (b.name !== undefined) {
    const n = String(b.name).trim();
    if (!n) throw L.bad('Version name is required.');
    if (n.length > 60) throw L.bad('Version name must be 60 characters or less.');
    if (db.prepare('SELECT 1 FROM versions WHERE project_key = ? AND name = ? COLLATE NOCASE AND id != ?').get(P, n, exceptId)) throw L.bad(`A version named '${n}' already exists in ${P}.`);
    upd.name = n;
  }
  if (b.description !== undefined) upd.description = String(b.description).slice(0, 1000);
  for (const [k, col] of [['startDate', 'start_date'], ['releaseDate', 'release_date']]) {
    if (b[k] !== undefined) { if (b[k] && !DATE.test(b[k])) throw L.bad('Dates must be yyyy-MM-dd.'); upd[col] = b[k] || null; }
  }
  return upd;
}
function checkDates(start, end) { if (start && end && end < start) throw L.bad('The release date must be after the start date.'); }

/** Move a version's unresolved work to another version (or clear it), recording history. */
function moveUnresolved(v, targetName, userId) {
  const rows = db.prepare("SELECT * FROM issues WHERE project_key = ? AND fix_version = ? AND status != 'Done'").all(v.project_key, v.name);
  rows.forEach((row) => L.applyUpdate(row, { fix_version: targetName }, userId));
  return rows.length;
}
function targetVersion(v, id) {
  if (id === null || id === undefined || id === '') return null;
  const t = requireVersion(id);
  if (t.project_key !== v.project_key || t.id === v.id) throw L.bad('Choose another version in the same project.');
  if (t.status !== 'unreleased') throw L.bad('Work can only move to an unreleased version.');
  return t.name;
}

r.get('/versions', L.wrap((req, res) => {
  const P = PM.assert(req, req.query.project || 'KAN').key;
  const want = String(req.query.status || '').split(',').filter(Boolean);
  const rows = db.prepare("SELECT * FROM versions WHERE project_key = ? ORDER BY CASE status WHEN 'unreleased' THEN 0 WHEN 'released' THEN 1 ELSE 2 END, position, id").all(P)
    .filter((v) => !want.length || want.includes(v.status));
  res.json(rows.map(versionOut));
}));
r.get('/versions/:id', L.wrap((req, res) => {
  const v = get(req.params.id);
  PM.assert(req, v.projectKey);
  const issues = db.prepare(`${L.ISSUE_SELECT} WHERE i.project_key = ? AND i.fix_version = ? ORDER BY i.rank`).all(v.projectKey, v.name).map(L.toIssue);
  res.json({ ...v, issues });
}));

r.post('/versions', L.wrap((req, res) => {
  const P = PM.assert(req, req.body?.projectKey || 'KAN', 'MANAGE_VERSIONS').key;
  const upd = fields(req.body || {}, P);
  if (!upd.name) throw L.bad('Version name is required.');
  checkDates(upd.start_date, upd.release_date);
  const pos = (db.prepare('SELECT MAX(position) m FROM versions WHERE project_key = ?').get(P).m ?? -1) + 1;
  const info = db.prepare("INSERT INTO versions (project_key,name,description,status,start_date,release_date,position,created_at) VALUES (?,?,?,'unreleased',?,?,?,?)")
    .run(P, upd.name, upd.description || '', upd.start_date ?? null, upd.release_date ?? null, pos, L.now());
  res.status(201).json(get(info.lastInsertRowid));
}));

r.patch('/versions/:id', L.wrap((req, res) => {
  const v = requireVersion(req.params.id);
  PM.assert(req, v.project_key, 'MANAGE_VERSIONS');
  const b = req.body || {};
  const upd = fields(b, v.project_key, v.id);
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) throw L.bad('Invalid version status.');
    upd.status = b.status;
    if (b.status === 'released' && v.status !== 'released') upd.released_at = L.now();
    if (b.status === 'unreleased') upd.released_at = null;
  }
  checkDates(upd.start_date !== undefined ? upd.start_date : v.start_date, upd.release_date !== undefined ? upd.release_date : v.release_date);
  db.transaction(() => {
    const cols = Object.keys(upd);
    if (cols.length) db.prepare(`UPDATE versions SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => upd[c]), v.id);
    if (upd.name && upd.name !== v.name) db.prepare('UPDATE issues SET fix_version = ? WHERE project_key = ? AND fix_version = ?').run(upd.name, v.project_key, v.name);
  })();
  res.json(get(v.id));
}));

// Release: { releaseDate?, moveUnresolvedTo?: versionId | null }. Unresolved work can stay, move, or be cleared.
r.post('/versions/:id/release', L.wrap((req, res) => {
  const v = requireVersion(req.params.id);
  PM.assert(req, v.project_key, 'MANAGE_VERSIONS');
  if (v.status !== 'unreleased') throw L.bad('This version has already been released.');
  const b = req.body || {};
  if (b.releaseDate && !DATE.test(b.releaseDate)) throw L.bad('Dates must be yyyy-MM-dd.');
  let moved = 0;
  db.transaction(() => {
    if ('moveUnresolvedTo' in b) moved = moveUnresolved(v, targetVersion(v, b.moveUnresolvedTo), req.user.id);
    db.prepare("UPDATE versions SET status = 'released', released_at = ?, release_date = ? WHERE id = ?")
      .run(L.now(), b.releaseDate || v.release_date || new Date().toISOString().slice(0, 10), v.id);
  })();
  require('../hooks').emit('version_released', { actorId: req.user.id, version: { id: String(v.id), name: v.name, projectKey: v.project_key, released: true, releaseDate: b.releaseDate || v.release_date || new Date().toISOString().slice(0, 10) } });
  res.json({ version: get(v.id), moved });
}));

r.delete('/versions/:id', L.wrap((req, res) => {
  const v = requireVersion(req.params.id);
  PM.assert(req, v.project_key, 'MANAGE_VERSIONS');
  const target = targetVersion(v, req.body?.moveTo ?? req.query.moveTo);
  db.transaction(() => {
    db.prepare('SELECT * FROM issues WHERE project_key = ? AND fix_version = ?').all(v.project_key, v.name)
      .forEach((row) => L.applyUpdate(row, { fix_version: target }, req.user.id));
    db.prepare('DELETE FROM versions WHERE id = ?').run(v.id);
  })();
  res.json({ ok: true });
}));

module.exports = r;
