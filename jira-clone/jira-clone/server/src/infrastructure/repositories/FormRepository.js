'use strict';

const { sql } = require('../database/sql');

const SELECT = sql.raw('SELECT f.*, it.name AS issue_type FROM forms f JOIN issue_types it ON it.id = f.issue_type_id');

class FormRepository {
  constructor({ db }) {
    this.db = db;
  }

  list(projectKey = null) {
    return this.db.many(sql`${SELECT} ${projectKey ? sql`WHERE f.project_key = ${projectKey}` : sql.empty} ORDER BY f.active DESC, lower(f.name)`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`${SELECT} WHERE f.id = ${Number(id)}`);
  }

  insert(fields) {
    return this.db.value(sql`INSERT INTO forms ${sql.insertValues(fields)} RETURNING id`);
  }

  update(id, fields) {
    return this.db.query(sql`UPDATE forms SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = ${id}`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM forms WHERE id = ${id}`);
  }

  countSubmission(id) {
    return this.db.query(sql`UPDATE forms SET submissions = submissions + 1 WHERE id = ${id}`);
  }
}

module.exports = { FormRepository };
