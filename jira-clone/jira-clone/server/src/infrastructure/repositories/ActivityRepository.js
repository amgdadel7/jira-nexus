'use strict';

const { sql } = require('../database/sql');

/** Cross-cutting read models: activity stream, "worked on", quick search, lookup lists for the workspace bootstrap. */
class ActivityRepository {
  constructor({ db }) {
    this.db = db;
  }

  feed({ projectKeys, limit }) {
    return this.db.many(sql`
      SELECT * FROM (
        SELECT 'history' AS kind, h.id, h.author_id, h.field, h.from_value, h.to_value, NULL AS body, h.created_at,
               i.key, i.summary, i.type, i.status, i.project_key
          FROM history h JOIN issue_view i ON i.id = h.issue_id WHERE i.project_key = ANY(${projectKeys}::text[])
        UNION ALL
        SELECT 'comment', c.id, c.author_id, NULL, NULL, NULL, c.body, c.created_at, i.key, i.summary, i.type, i.status, i.project_key
          FROM comments c JOIN issue_view i ON i.id = c.issue_id WHERE i.project_key = ANY(${projectKeys}::text[])
      ) feed ORDER BY created_at DESC, id DESC LIMIT ${limit}`);
  }

  workedOn({ userId, projectKeys, limit = 50 }) {
    return this.db.many(sql`
      SELECT i.*, x.last AS last_activity FROM (
        SELECT issue_id, max(t) AS last FROM (
          SELECT issue_id, created_at AS t FROM history WHERE author_id = ${userId}
          UNION ALL SELECT issue_id, created_at FROM comments WHERE author_id = ${userId}
          UNION ALL SELECT issue_id, created_at FROM worklogs WHERE author_id = ${userId}
        ) a GROUP BY issue_id
      ) x JOIN issue_view i ON i.id = x.issue_id
      WHERE i.project_key = ANY(${projectKeys}::text[])
      ORDER BY x.last DESC LIMIT ${limit}`);
  }

  quickSearchIssues({ text, projectKeys, limit = 8 }) {
    const like = `%${text}%`;
    return this.db.many(sql`
      SELECT * FROM issue_view i
       WHERE (i.key = upper(${text}) OR i.summary ILIKE ${like} OR i.description ILIKE ${like})
         AND i.project_key = ANY(${projectKeys}::text[])
       ORDER BY CASE WHEN i.key = upper(${text}) THEN 0 WHEN i.summary ILIKE ${`${text}%`} THEN 1 ELSE 2 END, i.updated_at DESC
       LIMIT ${limit}`);
  }

  quickSearchUsers(text, limit = 4) {
    const like = `%${text}%`;
    return this.db.many(sql`SELECT * FROM users WHERE active AND NOT bot AND (name ILIKE ${like} OR email ILIKE ${like}) ORDER BY name LIMIT ${limit}`);
  }

  /** Labels used in a project (for pickers). */
  async projectLabels(projectKey) {
    const rows = await this.db.many(sql`
      SELECT DISTINCT l.name FROM labels l JOIN issue_labels il ON il.label_id = l.id JOIN issues i ON i.id = il.issue_id
       WHERE i.project_key = ${projectKey} ORDER BY l.name`);
    return rows.map((r) => r.name);
  }

  async repos() {
    return (await this.db.many(sql`SELECT DISTINCT repo FROM dev_items ORDER BY repo`)).map((r) => r.repo);
  }
}

module.exports = { ActivityRepository };
