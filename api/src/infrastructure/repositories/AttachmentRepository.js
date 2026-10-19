'use strict';

const { sql } = require('../database/sql');

class AttachmentRepository {
  constructor({ db }) {
    this.db = db;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT a.*, i.key AS issue_key FROM attachments a JOIN issues i ON i.id = a.issue_id WHERE a.id = ${Number(id)}`);
  }

  list(issueId) {
    return this.db.many(sql`SELECT * FROM attachments WHERE issue_id = ${issueId} ORDER BY created_at DESC, id DESC`);
  }

  insert({ issueId, filename, mime, size, storedName, uploaderId }) {
    return this.db.one(sql`
      INSERT INTO attachments (issue_id, filename, mime, size, stored_name, uploader_id)
      VALUES (${issueId}, ${filename}, ${mime}, ${size}, ${storedName}, ${uploaderId}) RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM attachments WHERE id = ${id}`);
  }
}

module.exports = { AttachmentRepository };
