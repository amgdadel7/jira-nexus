// Shared helpers for routes
const db = require('./db');
const { STATUS_ORDER, PRIORITY_ORDER, JqlError } = require('./jql');
const TF = require('./timefmt');
const hooks = require('./hooks');

const TYPES = ['Epic', 'Story', 'Task', 'Bug', 'Subtask'];
const LINK_TYPES = {
  blocks: { outward: 'blocks', inward: 'is blocked by' },
  relates: { outward: 'relates to', inward: 'relates to' },
  duplicates: { outward: 'duplicates', inward: 'is duplicated by' },
  clones: { outward: 'clones', inward: 'is cloned by' },
};
const GOAL_STATUSES = ['pending', 'on_track', 'at_risk', 'off_track', 'done', 'cancelled'];
const now = () => new Date().toISOString();

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const notFound = (msg) => Object.assign(new Error(msg), { status: 404 });
const forbidden = (msg) => Object.assign(new Error(msg), { status: 403 });

function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); } catch (e) {
      if (e instanceof JqlError) return res.status(400).json({ error: e.message });
      if (e.status && e.status < 500) return res.status(e.status).json({ error: e.message, ...(e.extra || {}) });
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'That already exists.' });
      console.error(e);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

const ISSUE_SELECT = `
  SELECT i.*, p.key AS parent_key, p.summary AS parent_summary, p.type AS parent_type,
    (SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id) AS comment_count,
    (SELECT COUNT(*) FROM issues ch WHERE ch.parent_id = i.id) AS child_count,
    (SELECT COUNT(*) FROM issues ch WHERE ch.parent_id = i.id AND ch.status = 'Done') AS child_done,
    (SELECT COUNT(*) FROM attachments a WHERE a.issue_id = i.id) AS attachment_count,
    (SELECT COUNT(*) FROM issue_links l WHERE l.source_id = i.id OR l.target_id = i.id) AS link_count,
    (SELECT COUNT(*) FROM votes v WHERE v.issue_id = i.id) AS vote_count
  FROM issues i LEFT JOIN issues p ON p.id = i.parent_id`;

function toIssue(r) {
  if (!r) return null;
  return {
    id: r.id, key: r.key, project: r.project_key, type: r.type, summary: r.summary,
    description: r.description, status: r.status, priority: r.priority,
    assigneeId: r.assignee_id, reporterId: r.reporter_id,
    parent: r.parent_key ? { key: r.parent_key, summary: r.parent_summary, type: r.parent_type } : null,
    labels: JSON.parse(r.labels || '[]'), dueDate: r.due_date, startDate: r.start_date,
    storyPoints: r.story_points, sprint: r.sprint, fixVersion: r.fix_version || null, rank: r.rank,
    components: JSON.parse(r.components || '[]'), teamId: r.team_id ?? null,
    created: r.created_at, updated: r.updated_at, resolved: r.resolved_at,
    commentCount: r.comment_count, childCount: r.child_count, childDone: r.child_done,
    attachmentCount: r.attachment_count, linkCount: r.link_count, votes: r.vote_count ?? 0,
    originalEstimate: r.original_estimate ?? null, remainingEstimate: r.remaining_estimate ?? null, timeSpent: r.time_spent || 0,
  };
}

const getIssueRow = (key) => db.prepare(`${ISSUE_SELECT} WHERE i.key = ? COLLATE NOCASE`).get(key);
const getRawIssue = (key) => db.prepare('SELECT * FROM issues WHERE key = ? COLLATE NOCASE').get(key);
function requireIssue(key) {
  const row = getRawIssue(key);
  if (!row) throw notFound(`Work item ${key} does not exist.`);
  return row;
}

function requireProject(key) {
  const p = db.prepare('SELECT * FROM projects WHERE key = ? COLLATE NOCASE').get(String(key || ''));
  if (!p) throw notFound(`Project '${key}' does not exist.`);
  return p;
}

function normalizeFields(body, existing, projectKey = existing?.project_key || 'KAN') {
  const out = {};
  if ('summary' in body) {
    const s = String(body.summary || '').trim();
    if (!s) throw bad('Summary is required.');
    if (s.length > 255) throw bad('Summary must be less than 255 characters.');
    out.summary = s;
  }
  if ('description' in body) out.description = String(body.description ?? '').slice(0, 32000);
  if ('type' in body) { if (!TYPES.includes(body.type)) throw bad('Invalid work type.'); out.type = body.type; }
  if ('status' in body) { if (!STATUS_ORDER.includes(body.status)) throw bad('Invalid status.'); out.status = body.status; }
  if ('priority' in body) { if (!PRIORITY_ORDER.includes(body.priority)) throw bad('Invalid priority.'); out.priority = body.priority; }
  for (const [k, col] of [['assigneeId', 'assignee_id'], ['reporterId', 'reporter_id']]) {
    if (k in body) {
      if (body[k] && !db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(body[k])) throw bad('Unknown or inactive user.');
      out[col] = body[k] || null;
    }
  }
  if ('parentKey' in body) {
    if (!body.parentKey) out.parent_id = null;
    else {
      const p = db.prepare('SELECT id, key, parent_id FROM issues WHERE key = ? COLLATE NOCASE').get(body.parentKey);
      if (!p) throw bad(`Parent ${body.parentKey} not found.`);
      if (existing && (p.id === existing.id || p.parent_id === existing.id)) throw bad('That would create a circular parent relationship.');
      const pp = db.prepare('SELECT project_key FROM issues WHERE id = ?').get(p.id).project_key;
      if (pp !== projectKey) throw bad(`Parent ${p.key} belongs to another project.`);
      out.parent_id = p.id;
    }
  }
  if ('labels' in body) {
    if (!Array.isArray(body.labels)) throw bad('Labels must be an array.');
    const clean = [...new Set(body.labels.map((l) => String(l).trim().replace(/\s+/g, '_').slice(0, 60)).filter(Boolean))];
    out.labels = JSON.stringify(clean);
  }
  for (const [k, col] of [['dueDate', 'due_date'], ['startDate', 'start_date']]) {
    if (k in body) {
      if (body[k] && !/^\d{4}-\d{2}-\d{2}$/.test(body[k])) throw bad('Dates must be yyyy-MM-dd.');
      out[col] = body[k] || null;
    }
  }
  const start = 'start_date' in out ? out.start_date : existing?.start_date;
  const due = 'due_date' in out ? out.due_date : existing?.due_date;
  if (start && due && start > due && ('start_date' in out || 'due_date' in out)) throw bad('Start date must be before the due date.');
  if ('storyPoints' in body) {
    const v = body.storyPoints;
    if (v === null || v === '') out.story_points = null;
    else { const n = Number(v); if (Number.isNaN(n) || n < 0 || n > 1000) throw bad('Story points must be a number between 0 and 1000.'); out.story_points = n; }
  }
  if ('sprint' in body) {
    if (!body.sprint) out.sprint = null;
    else {
      const sp = db.prepare('SELECT name, state, project_key FROM sprints WHERE name = ? COLLATE NOCASE').get(String(body.sprint));
      if (!sp) throw bad(`Sprint '${body.sprint}' does not exist.`);
      if (sp.project_key !== projectKey) throw bad(`Sprint '${sp.name}' belongs to another project.`);
      if (sp.state === 'closed' && sp.name !== existing?.sprint) throw bad(`Sprint '${sp.name}' is closed. Choose an active or future sprint.`);
      out.sprint = sp.name;
    }
  }
  if ('fixVersion' in body) {
    if (!body.fixVersion) out.fix_version = null;
    else {
      const v = db.prepare('SELECT name, status FROM versions WHERE project_key = ? AND name = ? COLLATE NOCASE').get(projectKey, String(body.fixVersion));
      if (!v) throw bad(`Version '${body.fixVersion}' does not exist in ${projectKey}.`);
      if (v.status === 'archived' && v.name !== existing?.fix_version) throw bad(`Version '${v.name}' is archived.`);
      out.fix_version = v.name;
    }
  }
  if ('components' in body) {
    if (!Array.isArray(body.components)) throw bad('Components must be an array of names.');
    const known = db.prepare('SELECT name FROM components WHERE project_key = ?').all(projectKey).map((c) => c.name);
    const clean = [];
    for (const n of body.components) {
      const hit = known.find((k) => k.toLowerCase() === String(n).trim().toLowerCase());
      if (!hit) throw bad(`Component '${n}' does not exist in ${projectKey}.`);
      if (!clean.includes(hit)) clean.push(hit);
    }
    out.components = JSON.stringify(clean);
  }
  for (const [k, col] of [['originalEstimate', 'original_estimate'], ['remainingEstimate', 'remaining_estimate']]) {
    if (k in body) {
      try { out[col] = TF.parseDuration(body[k]); } catch (e) { throw bad(e.message); }
      if (out[col] !== null && out[col] > 10 * 365 * 24 * 3600) throw bad('That estimate is too large.');
    }
  }
  // Like Jira: setting the original estimate on work with no remaining estimate (and no time logged) sets both
  if ('original_estimate' in out && !('remainingEstimate' in body) && (existing?.remaining_estimate ?? null) === null && !(existing?.time_spent > 0)) {
    out.remaining_estimate = out.original_estimate;
  }
  if ('teamId' in body) {
    if (body.teamId === null || body.teamId === '') out.team_id = null;
    else {
      const t = db.prepare('SELECT id FROM teams WHERE id = ?').get(Number(body.teamId));
      if (!t) throw bad('Unknown team.');
      out.team_id = t.id;
    }
  }
  return out;
}

const HIST_LABEL = { original_estimate: 'original estimate', remaining_estimate: 'remaining estimate', time_spent: 'time spent', team_id: 'team', fix_version: 'fix version', assignee_id: 'assignee', reporter_id: 'reporter', parent_id: 'parent', due_date: 'due date', start_date: 'start date', story_points: 'story points' };
function displayValue(col, v) {
  if (v === null || v === undefined || v === '') return null;
  if (col === 'assignee_id' || col === 'reporter_id') return db.prepare('SELECT name FROM users WHERE id = ?').get(v)?.name ?? v;
  if (col === 'parent_id') return db.prepare('SELECT key FROM issues WHERE id = ?').get(v)?.key ?? v;
  if (col === 'labels' || col === 'components') { const a = JSON.parse(v); return a.length ? a.join(', ') : null; }
  if (col === 'team_id') return db.prepare('SELECT name FROM teams WHERE id = ?').get(v)?.name ?? String(v);
  if (col === 'original_estimate' || col === 'remaining_estimate' || col === 'time_spent') return TF.formatDuration(Number(v));
  if (col === 'description') return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  return String(v);
}

function addHistory(issueId, authorId, field, from, to, t = now()) {
  db.prepare('INSERT INTO history (issue_id,author_id,field,from_value,to_value,created_at) VALUES (?,?,?,?,?,?)').run(issueId, authorId, field, from, to, t);
}

function watch(issueId, userId) {
  if (userId) db.prepare('INSERT OR IGNORE INTO watchers (issue_id,user_id) VALUES (?,?)').run(issueId, userId);
}

/** Notify watchers (+ extra users) of an event, excluding the actor. */
function notify({ issue, actorId, type, message, only, extra = [] }) {
  const recipients = new Set(only || [
    ...db.prepare('SELECT user_id FROM watchers WHERE issue_id = ?').all(issue.id).map((r) => r.user_id),
    issue.assignee_id, issue.reporter_id, ...extra,
  ]);
  recipients.delete(actorId); recipients.delete(null); recipients.delete(undefined);
  const ins = db.prepare('INSERT INTO notifications (user_id,actor_id,issue_id,type,message,read,created_at) VALUES (?,?,?,?,?,0,?)');
  const t = now();
  for (const uid of recipients) {
    const u = db.prepare('SELECT prefs FROM users WHERE id = ? AND active = 1 AND bot = 0').get(uid);
    if (!u) continue;
    let prefs = {}; try { prefs = JSON.parse(u.prefs || '{}'); } catch { /* ignore */ }
    if (prefs.notify && prefs.notify[type] === false) continue; // the person switched this kind of notification off
    ins.run(uid, actorId, issue.id, type, message, t);
  }
}

/** Apply a field update to an issue row, record history + notifications. Returns changed columns. */
function applyUpdate(row, fields, actorId) {
  const f = { ...fields };
  const changed = Object.keys(f).filter((c) => String(row[c] ?? '') !== String(f[c] ?? ''));
  if (!changed.length) return [];
  const t = now();
  if ('status' in f) f.resolved_at = f.status === 'Done' ? (row.resolved_at || t) : null;
  const cols = Object.keys(f);
  db.prepare(`UPDATE issues SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...cols.map((c) => f[c]), t, row.id);
  changed.forEach((c) => addHistory(row.id, actorId, HIST_LABEL[c] || c, displayValue(c, row[c]), displayValue(c, f[c]), t));
  const after = { ...row, ...f };
  if (changed.includes('assignee_id') && f.assignee_id) {
    watch(row.id, f.assignee_id);
    notify({ issue: after, actorId, type: 'assigned', message: `assigned ${row.key} to you`, only: [f.assignee_id] });
  }
  if (changed.includes('status')) {
    notify({ issue: after, actorId, type: 'status', message: `changed ${row.key} from ${row.status} to ${f.status}` });
  }
  hooks.emit('issue_updated', { key: row.key, before: row, changed, actorId });
  return changed;
}

function computeRank({ beforeKey, afterKey }) {
  const ref = db.prepare('SELECT id, rank FROM issues WHERE key = ?').get(beforeKey || afterKey);
  if (!ref) throw bad('Reference work item not found.');
  let lo; let hi;
  if (beforeKey) {
    hi = ref.rank;
    lo = db.prepare('SELECT MAX(rank) r FROM issues WHERE rank < ?').get(ref.rank).r ?? hi - 2048;
  } else {
    lo = ref.rank;
    hi = db.prepare('SELECT MIN(rank) r FROM issues WHERE rank > ?').get(ref.rank).r ?? lo + 2048;
  }
  if (hi - lo < 1e-6) { rebalance(); return computeRank({ beforeKey, afterKey }); }
  return (lo + hi) / 2;
}
function rebalance() {
  const rows = db.prepare('SELECT id FROM issues ORDER BY rank, id').all();
  const upd = db.prepare('UPDATE issues SET rank = ? WHERE id = ?');
  rows.forEach((r, i) => upd.run((i + 1) * 1024, r.id));
}

/** Creates an issue; returns the API issue object. */
function createIssue(body, actorId) {
  if (!body.summary) throw bad('Summary is required.');
  let pk = body.projectKey || body.project;
  if (!pk && body.parentKey) pk = db.prepare('SELECT project_key FROM issues WHERE key = ? COLLATE NOCASE').get(body.parentKey)?.project_key;
  const P = requireProject(pk || 'KAN').key;
  const f = normalizeFields({ type: 'Task', status: 'To Do', priority: 'Medium', reporterId: actorId, ...body }, null, P);
  const t = now();
  const key = db.transaction(() => {
    const num = db.prepare('SELECT next_num FROM projects WHERE key = ?').get(P).next_num;
    db.prepare('UPDATE projects SET next_num = next_num + 1 WHERE key = ?').run(P);
    const K = `${P}-${num}`;
    const rank = (body.afterKey || body.beforeKey) ? computeRank(body) : (db.prepare('SELECT MAX(rank) m FROM issues').get().m || 0) + 1024;
    // Component default assignee (component lead / project lead) when nobody was chosen
    if (!f.assignee_id && f.components) {
      const comp = JSON.parse(f.components)[0];
      const c = comp && db.prepare('SELECT default_assignee, lead_id FROM components WHERE project_key = ? AND name = ?').get(P, comp);
      if (c?.default_assignee === 'component_lead' && c.lead_id) f.assignee_id = c.lead_id;
      if (c?.default_assignee === 'project_lead') f.assignee_id = db.prepare('SELECT lead_id FROM projects WHERE key = ?').get(P).lead_id;
    }
    const info = db.prepare(`INSERT INTO issues (key,num,project_key,type,summary,description,status,priority,assignee_id,reporter_id,parent_id,labels,due_date,start_date,story_points,sprint,fix_version,components,team_id,rank,created_at,updated_at,resolved_at,original_estimate,remaining_estimate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      K, num, P, f.type, f.summary, f.description || '', f.status, f.priority,
      f.assignee_id ?? null, f.reporter_id ?? null, f.parent_id ?? null, f.labels || '[]',
      f.due_date ?? null, f.start_date ?? null, f.story_points ?? null, f.sprint ?? null, f.fix_version ?? null, f.components || '[]', f.team_id ?? null, rank, t, t, f.status === 'Done' ? t : null, f.original_estimate ?? null, f.remaining_estimate ?? null);
    const id = info.lastInsertRowid;
    addHistory(id, actorId, 'created', null, null, t);
    watch(id, actorId); watch(id, f.reporter_id); watch(id, f.assignee_id);
    if (f.assignee_id && f.assignee_id !== actorId) {
      notify({ issue: { id, key: K }, actorId, type: 'assigned', message: `assigned ${K} to you`, only: [f.assignee_id] });
    }
    return K;
  })();
  hooks.emit('issue_created', { key, actorId });
  return toIssue(getIssueRow(key));
}

module.exports = {
  TYPES, LINK_TYPES, GOAL_STATUSES, now, requireProject, bad, notFound, forbidden, wrap, ISSUE_SELECT, toIssue, getIssueRow, getRawIssue, requireIssue,
  normalizeFields, addHistory, watch, notify, applyUpdate, computeRank, rebalance, createIssue, displayValue, HIST_LABEL,
};
