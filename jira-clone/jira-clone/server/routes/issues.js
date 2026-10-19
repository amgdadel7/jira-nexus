const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { UPLOAD_DIR } = require('../db');
const { compile } = require('../jql');
const L = require('../lib');
const P = require('../perms');
const T = require('../trash');

const r = express.Router();
const MAX_UPLOAD = 10 * 1024 * 1024;

// ---------- search (JQL) ----------
r.get('/search', L.wrap((req, res) => {
  const jql = req.query.jql ?? 'project = KAN ORDER BY cf[10019] ASC';
  const startAt = Math.max(0, parseInt(req.query.startAt, 10) || 0);
  const maxResults = Math.min(1000, Math.max(1, parseInt(req.query.maxResults, 10) || 1000));
  const { where: w, params: p0, orderBy, sort } = compile(jql, { currentUserId: req.user.id });
  const vis = P.issueFilter(req);  // only projects the user can browse
  const where = `(${w}) AND ${vis.sql}`; const params = [...p0, ...vis.params];
  const total = db.prepare(`SELECT COUNT(*) c FROM issues i WHERE ${where}`).get(...params).c;
  const rows = db.prepare(`${L.ISSUE_SELECT} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, maxResults, startAt);
  res.json({ jql, startAt, maxResults, total, sort, issues: rows.map(L.toIssue) });
}));

// ---------- permission helpers ----------
/** Loads a work item the user can see (404 otherwise) and checks an optional permission. */
function issueFor(req, key, perm) {
  const row = L.getRawIssue(key);
  if (!row || !P.can(req, row.project_key, 'BROWSE_PROJECT')) throw L.notFound(`Work item ${key} does not exist or you don’t have permission to see it.`);
  if (perm) P.assert(req, row.project_key, perm);
  return row;
}
/** Which permissions a PATCH body needs: status → transition, assignee → assign, anything else → edit. */
function permsForChange(body) {
  const need = new Set();
  for (const k of Object.keys(body || {})) need.add(k === 'status' ? 'TRANSITION_ISSUES' : k === 'assigneeId' ? 'ASSIGN_ISSUES' : 'EDIT_ISSUES');
  return [...need];
}
function targetProjectForCreate(body) {
  let pk = body.projectKey || body.project;
  if (!pk && body.parentKey) pk = db.prepare('SELECT project_key FROM issues WHERE key = ? COLLATE NOCASE').get(body.parentKey)?.project_key;
  return String(pk || 'KAN').toUpperCase();
}
function assertCanCreate(req, body) {
  const pk = targetProjectForCreate(body);
  P.assert(req, pk, 'CREATE_ISSUES');
  if (body.assigneeId && body.assigneeId !== req.user.id) P.assert(req, pk, 'ASSIGN_ISSUES');
  return pk;
}

// ---------- single issue ----------
function issueDetail(row, userId, req) {
  const issue = L.toIssue(L.getIssueRow(row.key));
  issue.children = db.prepare(`${L.ISSUE_SELECT} WHERE i.parent_id = ? ORDER BY i.rank`).all(row.id).map(L.toIssue);
  issue.comments = db.prepare('SELECT id, author_id AS authorId, body, created_at AS created, updated_at AS updated FROM comments WHERE issue_id = ? ORDER BY created_at DESC').all(row.id);
  issue.history = db.prepare('SELECT id, author_id AS authorId, field, from_value AS "from", to_value AS "to", created_at AS created FROM history WHERE issue_id = ? ORDER BY created_at DESC, id DESC').all(row.id);
  issue.watchers = db.prepare('SELECT user_id FROM watchers WHERE issue_id = ?').all(row.id).map((w) => w.user_id);
  issue.watching = issue.watchers.includes(userId);
  issue.links = db.prepare(`
    SELECT l.id, l.type, 'outward' AS direction, t.key, t.summary, t.status, t.type AS issueType, t.priority, t.assignee_id AS assigneeId
      FROM issue_links l JOIN issues t ON t.id = l.target_id WHERE l.source_id = ?
    UNION ALL
    SELECT l.id, l.type, 'inward' AS direction, s.key, s.summary, s.status, s.type AS issueType, s.priority, s.assignee_id AS assigneeId
      FROM issue_links l JOIN issues s ON s.id = l.source_id WHERE l.target_id = ?`).all(row.id, row.id)
    .map((l) => ({ ...l, label: L.LINK_TYPES[l.type]?.[l.direction] || l.type }))
    .filter((l) => !req || P.can(req, l.key.split('-')[0], 'BROWSE_PROJECT'));
  if (req) issue.permissions = P.describe(req, row.project_key).permissions;
  issue.attachments = db.prepare('SELECT id, filename, mime, size, uploader_id AS uploaderId, created_at AS created FROM attachments WHERE issue_id = ? ORDER BY created_at DESC').all(row.id);
  issue.development = db.prepare('SELECT id, kind, repo, name, ref, status, author_id AS authorId, created_at AS created FROM dev_items WHERE issue_id = ? ORDER BY created_at DESC').all(row.id);
  issue.goals = db.prepare('SELECT g.id, g.name, g.status FROM goal_issues gi JOIN goals g ON g.id = gi.goal_id WHERE gi.issue_id = ?').all(row.id);
  issue.worklogs = db.prepare('SELECT id, author_id AS authorId, started_at AS started, time_spent AS timeSpent, comment, created_at AS created, updated_at AS updated FROM worklogs WHERE issue_id = ? ORDER BY started_at DESC, id DESC').all(row.id);
  issue.voters = db.prepare('SELECT user_id FROM votes WHERE issue_id = ? ORDER BY created_at').all(row.id).map((v) => v.user_id);
  issue.voted = issue.voters.includes(userId);
  return issue;
}

r.get('/issues/:key', L.wrap((req, res) => {
  res.json(issueDetail(issueFor(req, req.params.key), req.user.id, req));
}));

r.post('/issues', L.wrap((req, res) => {
  assertCanCreate(req, req.body || {});
  res.status(201).json(L.createIssue(req.body || {}, req.user.id));
}));

r.patch('/issues/:key', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  permsForChange(req.body).forEach((perm) => P.assert(req, row.project_key, perm));
  const f = L.normalizeFields(req.body || {}, row);
  db.transaction(() => L.applyUpdate(row, f, req.user.id))();
  res.json(L.toIssue(L.getIssueRow(row.key)));
}));

function deleteIssueFiles(issueIds) {
  if (!issueIds.length) return;
  const files = db.prepare(`SELECT stored_name FROM attachments WHERE issue_id IN (${issueIds.map(() => '?').join(',')})`).all(...issueIds);
  files.forEach((f) => fs.rm(path.join(UPLOAD_DIR, f.stored_name), { force: true }, () => {}));
}

r.delete('/issues/:key', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'DELETE_ISSUES');
  const t = T.moveToTrash(row, req.user.id);
  P.audit(req, 'issue.deleted', { project: row.project_key, target: row.key, details: { summary: row.summary, trashId: t.id } });
  require('../hooks').emit('issue_deleted', { key: row.key, before: row, actorId: req.user.id });
  res.json({ ok: true, trashId: t.id, recycleBin: true });
}));

// ---------- clone ----------
r.post('/issues/:key/clone', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'CREATE_ISSUES');
  const issue = L.createIssue({
    type: row.type, summary: `CLONE - ${row.summary}`.slice(0, 255), description: row.description, priority: row.priority,
    assigneeId: row.assignee_id, labels: JSON.parse(row.labels), dueDate: row.due_date, startDate: row.start_date,
    projectKey: row.project_key, fixVersion: row.fix_version, storyPoints: row.story_points, sprint: row.sprint, parentKey: row.parent_id ? db.prepare('SELECT key FROM issues WHERE id = ?').get(row.parent_id).key : null,
    components: JSON.parse(row.components || '[]'), teamId: row.team_id,
    afterKey: row.key,
  }, req.user.id);
  db.prepare('INSERT INTO issue_links (source_id,target_id,type,created_by,created_at) VALUES (?,?,?,?,?)').run(issue.id, row.id, 'clones', req.user.id, L.now());
  res.status(201).json(issue);
}));

// ---------- bulk ----------
r.post('/issues/bulk', L.wrap((req, res) => {
  const { keys, changes, action } = req.body || {};
  if (!Array.isArray(keys) || !keys.length) throw L.bad('No work items selected.');
  if (keys.length > 500) throw L.bad('You can change at most 500 work items at once.');
  let count = 0;
  // check every item first so a bulk change is all-or-nothing
  const rowsAll = keys.map((k) => L.getRawIssue(k)).filter((x) => x && P.can(req, x.project_key, 'BROWSE_PROJECT'));
  const needs = action === 'delete' ? ['DELETE_ISSUES'] : permsForChange(changes);
  const denied = rowsAll.filter((x) => needs.some((perm) => !P.can(req, x.project_key, perm))).map((x) => x.key);
  if (denied.length) throw L.forbidden(`You don’t have permission to change ${denied.slice(0, 5).join(', ')}${denied.length > 5 ? ` and ${denied.length - 5} more` : ''}.`);
  db.transaction(() => {
    if (action === 'delete') {
      rowsAll.forEach((x) => {
        if (!L.getRawIssue(x.key)) return; // already removed as a sub-task of another selected item
        T.moveToTrash(x, req.user.id); count++;
        P.audit(req, 'issue.deleted', { project: x.project_key, target: x.key, details: { summary: x.summary, bulk: true } });
      });
    } else {
      rowsAll.forEach(({ key: k }) => {
        const row = L.getRawIssue(k);
        if (!row) return;
        const f = L.normalizeFields(changes || {}, row);
        if (L.applyUpdate(row, f, req.user.id).length) count++;
      });
    }
  })();
  res.json({ ok: true, count });
}));

// ---------- rank (cf[10019]) ----------
r.post('/issues/:key/rank', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'EDIT_ISSUES');
  const { beforeKey, afterKey } = req.body || {};
  if (!beforeKey && !afterKey) throw L.bad('beforeKey or afterKey is required.');
  if ((beforeKey || afterKey) !== row.key) {
    db.transaction(() => {
      db.prepare('UPDATE issues SET rank = -1e15 WHERE id = ?').run(row.id);
      db.prepare('UPDATE issues SET rank = ? WHERE id = ?').run(L.computeRank({ beforeKey, afterKey }), row.id);
    })();
  }
  res.json(L.toIssue(L.getIssueRow(row.key)));
}));

// ---------- comments ----------
function mentionedUsers(body) {
  const users = db.prepare('SELECT id, name FROM users WHERE active = 1').all();
  const lower = body.toLowerCase();
  return users.filter((u) => lower.includes(`@${u.name.toLowerCase()}`) || lower.includes(`@${u.name.split(' ')[0].toLowerCase()}`)).map((u) => u.id);
}

r.post('/issues/:key/comments', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'ADD_COMMENTS');
  const body = String(req.body?.body || '').trim();
  if (!body) throw L.bad('Comment cannot be empty.');
  if (body.length > 32000) throw L.bad('Comment is too long.');
  const t = L.now();
  const id = db.transaction(() => {
    const info = db.prepare('INSERT INTO comments (issue_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?)').run(row.id, req.user.id, body, t, t);
    db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').run(t, row.id);
    L.watch(row.id, req.user.id);
    const snippet = body.length > 80 ? `${body.slice(0, 80)}…` : body;
    const mentions = mentionedUsers(body);
    if (mentions.length) L.notify({ issue: row, actorId: req.user.id, type: 'mention', message: `mentioned you on ${row.key}: “${snippet}”`, only: mentions });
    L.notify({ issue: row, actorId: req.user.id, type: 'comment', message: `commented on ${row.key}: “${snippet}”`, only: [
      ...db.prepare('SELECT user_id FROM watchers WHERE issue_id = ?').all(row.id).map((w) => w.user_id), row.assignee_id, row.reporter_id,
    ].filter((u) => !mentions.includes(u)) });
    return info.lastInsertRowid;
  })();
  require('../hooks').emit('comment_created', { key: row.key, commentId: id, body, actorId: req.user.id });
  res.status(201).json({ id, authorId: req.user.id, body, created: t, updated: t });
}));

function ownComment(req) {
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!c) throw L.notFound('Comment not found.');
  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(c.issue_id);
  issueFor(req, issue.key, c.author_id === req.user.id ? 'ADD_COMMENTS' : 'DELETE_ALL_COMMENTS');
  return c;
}
r.patch('/comments/:id', L.wrap((req, res) => {
  ownComment(req);
  const body = String(req.body?.body || '').trim();
  if (!body) throw L.bad('Comment cannot be empty.');
  db.prepare('UPDATE comments SET body = ?, updated_at = ? WHERE id = ?').run(body, L.now(), req.params.id);
  res.json(db.prepare('SELECT id, author_id AS authorId, body, created_at AS created, updated_at AS updated FROM comments WHERE id = ?').get(req.params.id));
}));
r.delete('/comments/:id', L.wrap((req, res) => {
  ownComment(req);
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ---------- watchers ----------
r.post('/issues/:key/watch', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  L.watch(row.id, req.user.id);
  res.json({ watching: true });
}));
r.delete('/issues/:key/watch', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key);
  db.prepare('DELETE FROM watchers WHERE issue_id = ? AND user_id = ?').run(row.id, req.user.id);
  res.json({ watching: false });
}));

// ---------- links ----------
r.post('/issues/:key/links', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'LINK_ISSUES');
  const { type, targetKey, direction = 'outward' } = req.body || {};
  if (!L.LINK_TYPES[type]) throw L.bad(`Link type must be one of: ${Object.keys(L.LINK_TYPES).join(', ')}.`);
  const target = L.getRawIssue(targetKey || '');
  if (!target || !P.can(req, target.project_key, 'BROWSE_PROJECT')) throw L.bad(`Work item ${targetKey} not found.`);
  if (target.id === row.id) throw L.bad('A work item cannot be linked to itself.');
  const [src, dst] = direction === 'inward' ? [target, row] : [row, target];
  if (db.prepare('SELECT 1 FROM issue_links WHERE source_id = ? AND target_id = ? AND type = ?').get(src.id, dst.id, type)) {
    throw Object.assign(new Error('These work items are already linked that way.'), { status: 409 });
  }
  const info = db.prepare('INSERT INTO issue_links (source_id,target_id,type,created_by,created_at) VALUES (?,?,?,?,?)').run(src.id, dst.id, type, req.user.id, L.now());
  L.addHistory(row.id, req.user.id, 'link', null, `${L.LINK_TYPES[type][direction]} ${target.key}`);
  L.addHistory(target.id, req.user.id, 'link', null, `${L.LINK_TYPES[type][direction === 'inward' ? 'outward' : 'inward']} ${row.key}`);
  res.status(201).json({ id: info.lastInsertRowid });
}));
r.delete('/links/:id', L.wrap((req, res) => {
  const l = db.prepare('SELECT l.*, s.key sk, t.key tk FROM issue_links l JOIN issues s ON s.id = l.source_id JOIN issues t ON t.id = l.target_id WHERE l.id = ?').get(req.params.id);
  if (!l) throw L.notFound('Link not found.');
  issueFor(req, l.sk, 'LINK_ISSUES');
  db.prepare('DELETE FROM issue_links WHERE id = ?').run(l.id);
  L.addHistory(l.source_id, req.user.id, 'link', `${L.LINK_TYPES[l.type]?.outward || l.type} ${l.tk}`, null);
  L.addHistory(l.target_id, req.user.id, 'link', `${L.LINK_TYPES[l.type]?.inward || l.type} ${l.sk}`, null);
  res.json({ ok: true });
}));

// ---------- attachments ----------
r.post('/issues/:key/attachments', express.raw({ type: () => true, limit: MAX_UPLOAD }), L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'CREATE_ATTACHMENTS');
  const filename = decodeURIComponent(req.headers['x-filename'] || '').replace(/[/\\]/g, '_').slice(0, 200);
  if (!filename) throw L.bad('X-Filename header is required.');
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw L.bad('The file is empty.');
  require('../billing').assertStorage(req.body.length);
  const stored = `${crypto.randomBytes(12).toString('hex')}${path.extname(filename).slice(0, 10)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), req.body);
  const mime = (req.headers['content-type'] || 'application/octet-stream').split(';')[0];
  const t = L.now();
  const info = db.prepare('INSERT INTO attachments (issue_id,filename,mime,size,stored_name,uploader_id,created_at) VALUES (?,?,?,?,?,?,?)').run(row.id, filename, mime, req.body.length, stored, req.user.id, t);
  db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').run(t, row.id);
  L.addHistory(row.id, req.user.id, 'attachment', null, filename, t);
  res.status(201).json({ id: info.lastInsertRowid, filename, mime, size: req.body.length, uploaderId: req.user.id, created: t });
}));
r.get('/attachments/:id', L.wrap((req, res) => {
  const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!a) throw L.notFound('Attachment not found.');
  issueFor(req, db.prepare('SELECT key FROM issues WHERE id = ?').get(a.issue_id).key);
  const file = path.join(UPLOAD_DIR, a.stored_name);
  if (!fs.existsSync(file)) throw L.notFound('The file is missing from storage.');
  const inline = req.query.inline === '1' && /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/.test(a.mime);
  res.setHeader('Content-Type', a.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
  fs.createReadStream(file).pipe(res);
}));
r.delete('/attachments/:id', L.wrap((req, res) => {
  const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!a) throw L.notFound('Attachment not found.');
  issueFor(req, db.prepare('SELECT key FROM issues WHERE id = ?').get(a.issue_id).key, a.uploader_id === req.user.id ? 'CREATE_ATTACHMENTS' : 'DELETE_ALL_ATTACHMENTS');
  db.prepare('DELETE FROM attachments WHERE id = ?').run(a.id);
  fs.rm(path.join(UPLOAD_DIR, a.stored_name), { force: true }, () => {});
  L.addHistory(a.issue_id, req.user.id, 'attachment', a.filename, null);
  res.json({ ok: true });
}));

// ---------- development info per issue ----------
r.post('/issues/:key/dev', L.wrap((req, res) => {
  const row = issueFor(req, req.params.key, 'EDIT_ISSUES');
  const { kind, repo, name, ref, status } = req.body || {};
  if (!['branch', 'commit', 'pr'].includes(kind)) throw L.bad('kind must be branch, commit or pr.');
  if (!repo || !name) throw L.bad('repo and name are required.');
  const st = kind === 'pr' ? (['open', 'merged', 'declined'].includes(status) ? status : 'open') : kind === 'branch' ? 'active' : null;
  let prRef = ref || null;
  if (kind === 'pr' && !prRef) prRef = String((db.prepare("SELECT MAX(CAST(ref AS INTEGER)) m FROM dev_items WHERE kind='pr' AND repo = ?").get(repo).m || 0) + 1);
  if (kind === 'commit' && !prRef) prRef = crypto.randomBytes(4).toString('hex').slice(0, 7);
  const info = db.prepare('INSERT INTO dev_items (issue_id,kind,repo,name,ref,status,author_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(row.id, kind, String(repo).slice(0, 100), String(name).slice(0, 255), prRef, st, req.user.id, L.now());
  res.status(201).json(db.prepare('SELECT id, kind, repo, name, ref, status, author_id AS authorId, created_at AS created FROM dev_items WHERE id = ?').get(info.lastInsertRowid));
}));

module.exports = r;
module.exports.issueDetail = issueDetail;
module.exports.issueFor = issueFor;
module.exports.assertCanCreate = assertCanCreate;
