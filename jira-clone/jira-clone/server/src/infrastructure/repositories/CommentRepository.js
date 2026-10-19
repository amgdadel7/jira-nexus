'use strict';

const { sql } = require('../database/sql');

class CommentRepository {
  constructor({ db }) {
    this.db = db;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM comments WHERE id = ${Number(id)}`);
  }

  list(issueId) {
    return this.db.many(sql`SELECT * FROM comments WHERE issue_id = ${issueId} ORDER BY created_at DESC, id DESC`);
  }

  insert({ issueId, authorId, body }) {
    return this.db.one(sql`INSERT INTO comments (issue_id, author_id, body) VALUES (${issueId}, ${authorId}, ${body}) RETURNING *`);
  }

  update(id, body) {
    return this.db.one(sql`UPDATE comments SET body = ${body}, updated_at = now() WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM comments WHERE id = ${id}`);
  }
}

module.exports = { CommentRepository };
