'use strict';

const { sql } = require('../database/sql');

class WorklogRepository {
  constructor({ db }) {
    this.db = db;
  }

  list(issueId) {
    return this.db.many(sql`SELECT * FROM worklogs WHERE issue_id = ${issueId} ORDER BY started_at DESC, id DESC`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT w.*, i.key AS issue_key FROM worklogs w JOIN issues i ON i.id = w.issue_id WHERE w.id = ${Number(id)}`);
  }

  insert({ issueId, authorId, startedAt, timeSpent, comment }) {
    return this.db.one(sql`
      INSERT INTO worklogs (issue_id, author_id, started_at, time_spent, comment)
      VALUES (${issueId}, ${authorId}, ${startedAt}, ${timeSpent}, ${comment}) RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE worklogs SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM worklogs WHERE id = ${id}`);
  }

  /** Recomputes issues.time_spent from the worklogs. Returns the new total. */
  syncTimeSpent(issueId) {
    return this.db.value(sql`
      UPDATE issues SET time_spent = (SELECT COALESCE(sum(time_spent), 0) FROM worklogs WHERE issue_id = ${issueId})
       WHERE id = ${issueId} RETURNING time_spent`);
  }

  /** Worklogs between two dates (timesheet), restricted to visible projects. */
  between({ from, to, projectKeys, authorId = null }) {
    return this.db.many(sql`
      SELECT w.*, i.key AS issue_key, i.summary AS issue_summary, i.project_key, it.name AS issue_type
        FROM worklogs w JOIN issues i ON i.id = w.issue_id JOIN issue_types it ON it.id = i.issue_type_id
       WHERE w.started_at >= ${from} AND w.started_at < ${to}
         AND i.project_key = ANY(${projectKeys}::text[])
         ${authorId ? sql`AND w.author_id = ${authorId}` : sql.empty}
       ORDER BY w.started_at, w.id`);
  }
}

module.exports = { WorklogRepository };
