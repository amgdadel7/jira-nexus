// Sprints (Scrum): plan in the backlog, start one sprint at a time, complete it and carry over open work.
const express = require('express');
const db = require('../db');
const L = require('../lib');
const PM = require('../perms');

const r = express.Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function sprintOut(s) {
  const st = db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'Done') AS done, SUM(status != 'Done' AND status != 'To Do') AS inprogress,
    COALESCE(SUM(story_points),0) AS points, COALESCE(SUM(CASE WHEN status = 'Done' THEN story_points END),0) AS donePoints
    FROM issues WHERE sprint = ? AND type != 'Epic'`).get(s.name);
  return {
    id: s.id, name: s.name, goal: s.goal, state: s.state, startDate: s.start_date, endDate: s.end_date,
    completedAt: s.completed_at, position: s.position, created: s.created_at, projectKey: s.project_key,
    committed: s.committed_points === null ? null : { points: s.committed_points, count: s.committed_count },
    completed: s.completed_points === null ? null : { points: s.completed_points, count: s.completed_count },
    stats: { total: st.total, done: st.done || 0, inProgress: st.inprogress || 0, todo: st.total - (st.done || 0) - (st.inprogress || 0), points: st.points, donePoints: st.donePoints },
  };
}
const requireSprint = (id) => {
  const s = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
  if (!s) throw L.notFound('Sprint not found.');
  return s;
};
const get = (id) => sprintOut(requireSprint(id));
function nextName(P) {
  const prefix = `${P} Sprint `;
  const nums = db.prepare('SELECT name FROM sprints WHERE name LIKE ?').all(`${prefix}%`).map((x) => parseInt(x.name.slice(prefix.length), 10)).filter((n) => !Number.isNaN(n));
  return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`;
}
const sprintTotals = (name) => db.prepare("SELECT COUNT(*) c, COALESCE(SUM(story_points),0) p FROM issues WHERE sprint = ? AND type != 'Epic'").get(name);
function validName(name, exceptId) {
  const n = String(name || '').trim();
  if (!n) throw L.bad('Sprint name is required.');
  if (n.length > 60) throw L.bad('Sprint name must be 60 characters or less.');
  if (db.prepare('SELECT 1 FROM sprints WHERE name = ? COLLATE NOCASE AND id != ?').get(n, exceptId || 0)) throw L.bad('A sprint with that name already exists.');
  return n;
}
function validDates(start, end) {
  if (start && !DATE.test(start)) throw L.bad('Dates must be yyyy-MM-dd.');
  if (end && !DATE.test(end)) throw L.bad('Dates must be yyyy-MM-dd.');
  if (start && end && end < start) throw L.bad('The end date must be after the start date.');
}
/** Move work items into a sprint (or the backlog when name is null), recording history. */
function moveIssues(rows, name, userId) {
  let n = 0;
  rows.forEach((row) => { if (row.sprint !== name && L.applyUpdate(row, { sprint: name }, userId).length) n++; });
  return n;
}

r.get('/sprints', L.wrap((req, res) => {
  const states = String(req.query.state || '').split(',').filter(Boolean);
  const P = req.query.project ? PM.assert(req, req.query.project).key : null;
  const rows = db.prepare("SELECT * FROM sprints WHERE (@p IS NULL OR project_key = @p) ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'future' THEN 1 ELSE 2 END, CASE WHEN state = 'closed' THEN completed_at END DESC, position, id").all({ p: P })
    .filter((s) => !states.length || states.includes(s.state)).filter((s) => PM.can(req, s.project_key, 'BROWSE_PROJECT'));
  res.json(rows.map(sprintOut));
}));
r.get('/sprints/:id', L.wrap((req, res) => { PM.assert(req, requireSprint(req.params.id).project_key); res.json(get(req.params.id)); }));

r.post('/sprints', L.wrap((req, res) => {
  const P = PM.assert(req, req.body?.projectKey || 'KAN', 'MANAGE_SPRINTS').key;
  const name = validName(req.body?.name || nextName(P));
  const { goal = '', startDate = null, endDate = null } = req.body || {};
  validDates(startDate, endDate);
  const pos = (db.prepare('SELECT MAX(position) m FROM sprints').get().m ?? -1) + 1;
  const info = db.prepare("INSERT INTO sprints (project_key,name,goal,state,start_date,end_date,position,created_at) VALUES (?,?,?,'future',?,?,?,?)")
    .run(P, name, String(goal).slice(0, 500), startDate || null, endDate || null, pos, L.now());
  res.status(201).json(get(info.lastInsertRowid));
}));

r.patch('/sprints/:id', L.wrap((req, res) => {
  const s = requireSprint(req.params.id);
  PM.assert(req, s.project_key, 'MANAGE_SPRINTS');
  const b = req.body || {};
  const upd = {};
  if (b.name !== undefined) upd.name = validName(b.name, s.id);
  if (b.goal !== undefined) upd.goal = String(b.goal).slice(0, 500);
  if (b.startDate !== undefined) upd.start_date = b.startDate || null;
  if (b.endDate !== undefined) upd.end_date = b.endDate || null;
  validDates(upd.start_date ?? s.start_date, upd.end_date ?? s.end_date);
  if (s.state === 'active' && (upd.start_date === null || upd.end_date === null)) throw L.bad('An active sprint needs a start and end date.');
  db.transaction(() => {
    const cols = Object.keys(upd);
    if (cols.length) db.prepare(`UPDATE sprints SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => upd[c]), s.id);
    if (upd.name && upd.name !== s.name) db.prepare('UPDATE issues SET sprint = ? WHERE sprint = ?').run(upd.name, s.name);
  })();
  res.json(get(s.id));
}));

r.post('/sprints/:id/start', L.wrap((req, res) => {
  const s = requireSprint(req.params.id);
  PM.assert(req, s.project_key, 'MANAGE_SPRINTS');
  if (s.state !== 'future') throw L.bad(s.state === 'active' ? 'This sprint has already started.' : 'This sprint is already complete.');
  const active = db.prepare("SELECT name FROM sprints WHERE state = 'active' AND project_key = ?").get(s.project_key);
  if (active) throw L.bad(`'${active.name}' is still active. Complete it before starting another sprint.`);
  const count = db.prepare("SELECT COUNT(*) c FROM issues WHERE sprint = ? AND type != 'Epic'").get(s.name).c;
  if (!count) throw L.bad('Add at least one work item to the sprint before starting it.');
  const b = req.body || {};
  const name = b.name !== undefined ? validName(b.name, s.id) : s.name;
  const startDate = b.startDate || s.start_date || new Date().toISOString().slice(0, 10);
  const endDate = b.endDate || s.end_date || new Date(Date.parse(startDate) + 14 * 864e5).toISOString().slice(0, 10);
  validDates(startDate, endDate);
  db.transaction(() => {
    const tot = sprintTotals(s.name);
    db.prepare("UPDATE sprints SET state = 'active', name = ?, goal = ?, start_date = ?, end_date = ?, committed_points = ?, committed_count = ? WHERE id = ?")
      .run(name, b.goal !== undefined ? String(b.goal).slice(0, 500) : s.goal, startDate, endDate, tot.p, tot.c, s.id);
    if (name !== s.name) db.prepare('UPDATE issues SET sprint = ? WHERE sprint = ?').run(name, s.name);
  })();
  { const sp = get(s.id); require('../hooks').emit('sprint_started', { actorId: req.user.id, sprint: { id: sp.id, name: sp.name, state: sp.state, goal: sp.goal, startDate: sp.startDate, endDate: sp.endDate, originBoardId: s.project_key } }); }
  res.json(get(s.id));
}));

r.post('/sprints/:id/complete', L.wrap((req, res) => {
  const s = requireSprint(req.params.id);
  PM.assert(req, s.project_key, 'MANAGE_SPRINTS');
  if (s.state !== 'active') throw L.bad('Only an active sprint can be completed.');
  const moveTo = req.body?.moveTo ?? null; // sprint id | 'new' | null (backlog)
  let target = null; let created = null; let moved = 0;
  db.transaction(() => {
    if (moveTo === 'new') {
      const pos = (db.prepare('SELECT MAX(position) m FROM sprints').get().m ?? -1) + 1;
      const info = db.prepare("INSERT INTO sprints (project_key,name,goal,state,position,created_at) VALUES (?,?,'','future',?,?)").run(s.project_key, nextName(s.project_key), pos, L.now());
      created = requireSprint(info.lastInsertRowid); target = created.name;
    } else if (moveTo !== null && moveTo !== '') {
      const t = requireSprint(moveTo);
      if (t.state !== 'future') throw L.bad('Open work items can only move to a future sprint or the backlog.');
      if (t.project_key !== s.project_key) throw L.bad('That sprint belongs to another project.');
      target = t.name;
    }
    const open = db.prepare("SELECT * FROM issues WHERE sprint = ? AND status != 'Done' AND type != 'Epic'").all(s.name);
    const done = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(story_points),0) p FROM issues WHERE sprint = ? AND status = 'Done' AND type != 'Epic'").get(s.name);
    moved = moveIssues(open, target, req.user.id);
    db.prepare("UPDATE sprints SET state = 'closed', completed_at = ?, completed_points = ?, completed_count = ? WHERE id = ?").run(L.now(), done.p, done.c, s.id);
  })();
  require('../hooks').emit('sprint_closed', { actorId: req.user.id, sprint: { id: s.id, name: s.name, state: 'closed', goal: s.goal, originBoardId: s.project_key, movedOpenItems: moved, movedTo: target } });
  res.json({ sprint: get(s.id), moved, movedTo: target, newSprint: created ? get(created.id) : null });
}));

r.delete('/sprints/:id', L.wrap((req, res) => {
  const s = requireSprint(req.params.id);
  PM.assert(req, s.project_key, 'MANAGE_SPRINTS');
  if (s.state !== 'future') throw L.bad('Only sprints that have not started can be deleted.');
  db.transaction(() => {
    moveIssues(db.prepare('SELECT * FROM issues WHERE sprint = ?').all(s.name), null, req.user.id);
    db.prepare('DELETE FROM sprints WHERE id = ?').run(s.id);
  })();
  res.json({ ok: true });
}));

// Move several work items into a sprint or the backlog: { keys: [...], sprintId: number | null }
r.post('/sprints/move', L.wrap((req, res) => {
  const { keys, sprintId } = req.body || {};
  if (!Array.isArray(keys) || !keys.length) throw L.bad('No work items selected.');
  let name = null;
  if (sprintId !== null && sprintId !== undefined) {
    const s = requireSprint(sprintId);
    if (s.state === 'closed') throw L.bad('You cannot add work to a completed sprint.');
    name = s.name;
    var sprintProject = s.project_key; // eslint-disable-line no-var
  }
  const rows = keys.map((k) => L.requireIssue(String(k)));
  const denied = rows.filter((x) => !PM.can(req, x.project_key, 'EDIT_ISSUES')).map((x) => x.key);
  if (denied.length) throw L.forbidden(`You don’t have permission to plan ${denied.slice(0, 5).join(', ')}.`);
  if (name && rows.some((x) => x.project_key !== sprintProject)) throw L.bad('Work items can only be added to sprints in their own project.');
  let moved = 0;
  db.transaction(() => { moved = moveIssues(rows.filter((x) => x.type !== 'Epic'), name, req.user.id); })();
  res.json({ ok: true, moved });
}));

module.exports = r;
