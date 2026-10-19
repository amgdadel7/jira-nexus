'use strict';

const { sql } = require('../database/sql');

class ComponentRepository {
  constructor({ db }) {
    this.db = db;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM components WHERE id = ${Number(id)}`);
  }

  list(projectKey) {
    return this.db.many(sql`SELECT * FROM components WHERE project_key = ${projectKey} ORDER BY lower(name)`);
  }

  /** Components of a project by (case-insensitive) name. */
  findByNames(projectKey, names) {
    if (!names.length) return Promise.resolve([]);
    return this.db.many(sql`SELECT * FROM components WHERE project_key = ${projectKey} AND lower(name) = ANY(${names.map((n) => n.toLowerCase())}::text[])`);
  }

  async nameTaken(projectKey, name, exceptId = 0) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM components WHERE project_key = ${projectKey} AND lower(name) = lower(${name}) AND id <> ${exceptId}`));
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO components ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE components SET ${sql.set(fields)} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM components WHERE id = ${id}`);
  }

  /** Moves every issue_components row of `fromId` to `toId` (keeping existing ones). Returns affected item count. */
  async reassign(fromId, toId) {
    const affected = await this.db.value(sql`SELECT count(*)::int FROM issue_components WHERE component_id = ${fromId}`);
    if (toId) {
      await this.db.query(sql`
        INSERT INTO issue_components (issue_id, component_id, position)
        SELECT issue_id, ${toId}, 999 FROM issue_components WHERE component_id = ${fromId}
        ON CONFLICT DO NOTHING`);
    }
    await this.db.query(sql`DELETE FROM issue_components WHERE component_id = ${fromId}`);
    return affected;
  }

  async stats(componentIds) {
    if (!componentIds.length) return new Map();
    const rows = await this.db.many(sql`
      SELECT ic.component_id, count(*)::int AS total, count(*) FILTER (WHERE st.category <> 'done')::int AS open
        FROM issue_components ic JOIN issues i ON i.id = ic.issue_id JOIN statuses st ON st.id = i.status_id
       WHERE ic.component_id = ANY(${componentIds}::int[]) GROUP BY ic.component_id`);
    return new Map(rows.map((r) => [r.component_id, r]));
  }
}

module.exports = { ComponentRepository };
