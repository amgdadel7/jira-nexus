'use strict';

const { sql } = require('../database/sql');

class FilterRepository {
  constructor({ db }) {
    this.db = db;
  }

  list() {
    return this.db.many(sql`SELECT * FROM filters ORDER BY starred DESC, lower(name)`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM filters WHERE id = ${Number(id)}`);
  }

  search(text, limit = 4) {
    return this.db.many(sql`SELECT id, name, jql FROM filters WHERE name ILIKE ${`%${text}%`} ORDER BY lower(name) LIMIT ${limit}`);
  }

  async nameTaken(ownerId, name, exceptId = 0) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM filters WHERE owner_id = ${ownerId} AND lower(name) = lower(${name}) AND id <> ${exceptId}`));
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO filters ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE filters SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM filters WHERE id = ${id}`);
  }
}

module.exports = { FilterRepository };
