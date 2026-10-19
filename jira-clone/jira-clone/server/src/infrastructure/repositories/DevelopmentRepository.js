'use strict';

const { sql } = require('../database/sql');

/** Development panel items (branches, commits, pull requests). */
class DevelopmentRepository {
  constructor({ db }) {
    this.db = db;
  }

  list(issueId) {
    return this.db.many(sql`SELECT * FROM dev_items WHERE issue_id = ${issueId} ORDER BY created_at DESC, id DESC`);
  }

  async nextPullRequestNumber(repo) {
    const max = await this.db.value(sql`SELECT max(ref::int) FROM dev_items WHERE kind = 'pr' AND repo = ${repo} AND ref ~ '^[0-9]+$'`);
    return String((max || 0) + 1);
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO dev_items ${sql.insertValues(fields)} RETURNING *`);
  }

  /** All items (code page) with their work item, optionally filtered. */
  listAll({ kind = null, repo = null, status = null } = {}) {
    return this.db.many(sql`
      SELECT d.*, i.key, i.project_key, i.summary, i.type AS issue_type, i.status AS issue_status
        FROM dev_items d LEFT JOIN issue_view i ON i.id = d.issue_id
      ${sql.where([kind && sql`d.kind = ${kind}`, repo && sql`d.repo = ${repo}`, status && sql`d.status = ${status}`])}
      ORDER BY d.created_at DESC, d.id DESC`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`
      SELECT d.*, i.key, i.project_key, i.summary, i.type AS issue_type, i.status AS issue_status
        FROM dev_items d LEFT JOIN issue_view i ON i.id = d.issue_id WHERE d.id = ${Number(id)}`);
  }

  setStatus(id, status) {
    return this.db.query(sql`UPDATE dev_items SET status = ${status} WHERE id = ${id}`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM dev_items WHERE id = ${id}`);
  }
}

module.exports = { DevelopmentRepository };
