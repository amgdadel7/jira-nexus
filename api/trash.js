// Recycle bin: deleting a work item stores a full snapshot (the item, its sub-tasks, comments, history,
// watchers, links, attachments, development info and goal links) so it can be restored exactly.
// Attachment files stay on disk until the item is permanently deleted. Items are purged after the plan's retention period (Free 7, Standard 30, Premium 90 days).
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { UPLOAD_DIR } = require('./db');

const retentionDays = () => require('./billing').retentionDays();
const CHILD_TABLES = ['comments', 'history', 'watchers', 'attachments', 'goal_issues', 'dev_items', 'worklogs', 'votes'];

const ph = (arr) => arr.map(() => '?').join(',');

/** Moves one work item (and its sub-tasks) to the recycle bin. Returns the trash entry id. */
function moveToTrash(row, actorId) {
  return db.transaction(() => {
    const subtasks = db.prepare("SELECT * FROM issues WHERE parent_id = ? AND type = 'Subtask'").all(row.id);
    const issues = [row, ...subtasks];
    const ids = issues.map((i) => i.id);
    const snap = { issues, orphaned: [] };
    for (const t of CHILD_TABLES) snap[t] = db.prepare(`SELECT * FROM ${t} WHERE issue_id IN (${ph(ids)})`).all(...ids);
    snap.issue_links = db.prepare(`SELECT * FROM issue_links WHERE source_id IN (${ph(ids)}) OR target_id IN (${ph(ids)})`).all(...ids, ...ids);
    // non-sub-task children (e.g. stories under an epic) are kept but lose their parent; remember them
    snap.orphaned = db.prepare(`SELECT id FROM issues WHERE parent_id IN (${ph(ids)}) AND id NOT IN (${ph(ids)})`).all(...ids, ...ids).map((x) => x.id);
    const files = snap.attachments.map((a) => a.stored_name);
    const info = db.prepare('INSERT INTO trash (project_key,issue_key,summary,type,snapshot,files,deleted_by,deleted_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(row.project_key, row.key, row.summary, row.type, JSON.stringify(snap), JSON.stringify(files), actorId, new Date().toISOString());
    db.prepare(`DELETE FROM issues WHERE id IN (${ph(ids)})`).run(...ids);
    return { id: info.lastInsertRowid, count: ids.length };
  })();
}

function insertRow(table, row) {
  const cols = Object.keys(row);
  return db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`).run(row).changes;
}

/** Restores a recycle-bin entry. Returns the restored work item key. */
function restore(entry) {
  const snap = JSON.parse(entry.snapshot);
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM projects WHERE key = ?').get(entry.project_key)) throw Object.assign(new Error('The project no longer exists.'), { status: 409 });
    for (const i of snap.issues) {
      if (db.prepare('SELECT 1 FROM issues WHERE key = ?').get(i.key)) throw Object.assign(new Error(`${i.key} already exists.`), { status: 409 });
    }
    const ids = new Set(snap.issues.map((i) => i.id));
    const exists = db.prepare('SELECT 1 FROM issues WHERE id = ?');
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?');
    for (const i of snap.issues) {
      const row = { ...i };
      if (row.parent_id && !ids.has(row.parent_id) && !exists.get(row.parent_id)) row.parent_id = null;
      if (row.assignee_id && !userExists.get(row.assignee_id)) row.assignee_id = null;
      if (row.reporter_id && !userExists.get(row.reporter_id)) row.reporter_id = null;
      insertRow('issues', row);
    }
    for (const t of CHILD_TABLES) for (const r of snap[t] || []) {
      if (t === 'goal_issues' && !db.prepare('SELECT 1 FROM goals WHERE id = ?').get(r.goal_id)) continue;
      if ((t === 'watchers' || t === 'votes') && !userExists.get(r.user_id)) continue;
      insertRow(t, r);
    }
    for (const l of snap.issue_links || []) if (exists.get(l.source_id) && exists.get(l.target_id)) insertRow('issue_links', l);
    const reparent = db.prepare('UPDATE issues SET parent_id = ? WHERE id = ? AND parent_id IS NULL');
    for (const id of snap.orphaned || []) reparent.run(snap.issues[0].id, id);
    db.prepare('INSERT INTO history (issue_id,author_id,field,from_value,to_value,created_at) VALUES (?,?,?,?,?,?)')
      .run(snap.issues[0].id, null, 'restored', null, 'from recycle bin', new Date().toISOString());
    db.prepare('DELETE FROM trash WHERE id = ?').run(entry.id);
    return snap.issues[0].key;
  })();
}

function purge(entry) {
  for (const f of JSON.parse(entry.files || '[]')) fs.rm(path.join(UPLOAD_DIR, f), { force: true }, () => {});
  db.prepare('DELETE FROM trash WHERE id = ?').run(entry.id);
}

function purgeExpired() {
  const cutoff = new Date(Date.now() - retentionDays() * 864e5).toISOString();
  const old = db.prepare('SELECT * FROM trash WHERE deleted_at < ?').all(cutoff);
  old.forEach(purge);
  return old.length;
}

const entryOut = (e) => {
  const snap = JSON.parse(e.snapshot);
  return {
    id: e.id, projectKey: e.project_key, key: e.issue_key, summary: e.summary, type: e.type,
    deletedBy: e.deleted_by, deleted: e.deleted_at,
    purgeOn: new Date(new Date(e.deleted_at).getTime() + retentionDays() * 864e5).toISOString(),
    subtasks: snap.issues.length - 1, comments: (snap.comments || []).length, attachments: (snap.attachments || []).length,
    status: snap.issues[0].status, assigneeId: snap.issues[0].assignee_id,
  };
};

module.exports = { moveToTrash, restore, purge, purgeExpired, entryOut, retentionDays };
