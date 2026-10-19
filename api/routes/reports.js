// Agile reports computed from sprints, issues and their change history.
const express = require('express');
const db = require('../db');
const L = require('../lib');
const PM = require('../perms');
const { STATUS_ORDER } = require('../jql');

const r = express.Router();
const day = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);

/** Issues that were ever in a sprint: current members plus items moved out of it (from history). */
function sprintMembers(s) {
  const current = db.prepare("SELECT * FROM issues WHERE sprint = ? AND type != 'Epic'").all(s.name);
  const ids = new Set(current.map((x) => x.id));
  const movedOut = db.prepare(`SELECT DISTINCT i.*, h.to_value AS moved_to, h.created_at AS moved_at FROM history h JOIN issues i ON i.id = h.issue_id
    WHERE h.field = 'sprint' AND h.from_value = ? AND i.type != 'Epic'`).all(s.name).filter((x) => !ids.has(x.id));
  return { current, movedOut };
}

// Velocity: committed vs. completed story points for the last N closed sprints.
r.get('/reports/velocity', L.wrap((req, res) => {
  const P = PM.assert(req, req.query.project || 'KAN').key;
  const n = Math.min(12, parseInt(req.query.sprints, 10) || 7);
  const rows = db.prepare("SELECT * FROM sprints WHERE project_key = ? AND state = 'closed' ORDER BY completed_at DESC LIMIT ?").all(P, n).reverse();
  const sprints = rows.map((s) => {
    const { current, movedOut } = sprintMembers(s);
    const pts = (a) => a.reduce((t, x) => t + (x.story_points || 0), 0);
    const completed = s.completed_points ?? pts(current.filter((x) => x.status === 'Done'));
    const committed = s.committed_points ?? pts(current) + pts(movedOut);
    return { id: s.id, name: s.name, startDate: s.start_date, endDate: s.end_date, completedAt: s.completed_at, committed, completed };
  });
  const avg = sprints.length ? Math.round((sprints.reduce((t, s) => t + s.completed, 0) / sprints.length) * 10) / 10 : 0;
  res.json({ project: P, sprints, averageVelocity: avg });
}));

// Cumulative flow: number of work items in each status at the end of each day.
r.get('/reports/cfd', L.wrap((req, res) => {
  const P = PM.assert(req, req.query.project || 'KAN').key;
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  const issues = db.prepare("SELECT id, status, created_at FROM issues WHERE project_key = ? AND type != 'Epic'").all(P);
  const changes = db.prepare(`SELECT h.issue_id, h.from_value, h.to_value, h.created_at FROM history h JOIN issues i ON i.id = h.issue_id
    WHERE i.project_key = ? AND h.field = 'status' ORDER BY h.created_at`).all(P);
  const byIssue = new Map();
  changes.forEach((c) => { if (!byIssue.has(c.issue_id)) byIssue.set(c.issue_id, []); byIssue.get(c.issue_id).push(c); });
  const today = new Date(); today.setUTCHours(23, 59, 59, 999);
  const dates = []; const series = Object.fromEntries(STATUS_ORDER.map((s) => [s, []]));
  for (let i = days - 1; i >= 0; i--) {
    const end = addDays(today, -i); const endIso = end.toISOString();
    dates.push(day(end));
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    for (const it of issues) {
      if (it.created_at > endIso) continue;
      const ch = byIssue.get(it.id) || [];
      let st = ch.length ? ch[0].from_value : it.status;
      for (const c of ch) { if (c.created_at <= endIso) st = c.to_value; else break; }
      if (counts[st] !== undefined) counts[st]++;
    }
    STATUS_ORDER.forEach((s) => series[s].push(counts[s]));
  }
  res.json({ project: P, dates, statuses: STATUS_ORDER, series });
}));

// Sprint report: completed vs. not completed work, plus a daily burndown of remaining points.
r.get('/reports/sprint/:id', L.wrap((req, res) => {
  const s = db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!s) throw L.notFound('Sprint not found.');
  PM.assert(req, s.project_key);
  const { current, movedOut } = sprintMembers(s);
  const toApi = (rows) => rows.map((x) => L.toIssue(L.getIssueRow(x.key)));
  const completed = current.filter((x) => x.status === 'Done');
  const notCompleted = s.state === 'closed' ? movedOut : current.filter((x) => x.status !== 'Done');
  const removed = s.state === 'closed' ? [] : movedOut;
  const all = [...current, ...movedOut];
  let burndown = null;
  if (s.start_date) {
    const start = new Date(`${s.start_date}T00:00:00Z`);
    const end = new Date(`${s.end_date || day(addDays(start, 14))}T23:59:59Z`);
    const stop = s.state === 'closed' && s.completed_at ? new Date(s.completed_at) : new Date();
    const total = s.committed_points ?? all.reduce((t, x) => t + (x.story_points || 0), 0);
    const points = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const eod = new Date(Math.min(addDays(d, 1).getTime() - 1, end.getTime()));
      if (d > stop) break;
      const done = all.filter((x) => x.resolved_at && x.resolved_at <= eod.toISOString()).reduce((t, x) => t + (x.story_points || 0), 0);
      points.push({ date: day(d), remaining: Math.max(0, total - done) });
    }
    burndown = { start: s.start_date, end: day(end), total, points };
  }
  const pts = (a) => a.reduce((t, x) => t + (x.story_points || 0), 0);
  res.json({
    sprint: { id: s.id, name: s.name, goal: s.goal, state: s.state, startDate: s.start_date, endDate: s.end_date, completedAt: s.completed_at, projectKey: s.project_key },
    summary: { completed: completed.length, completedPoints: pts(completed), notCompleted: notCompleted.length, notCompletedPoints: pts(notCompleted), removed: removed.length },
    completed: toApi(completed), notCompleted: toApi(notCompleted), removed: toApi(removed), burndown,
  });
}));

module.exports = r;
