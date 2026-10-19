'use strict';

const { sql } = require('../database/sql');

class VersionRepository {
  constructor({ db }) {
    this.db = db;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM versions WHERE id = ${Number(id)}`);
  }

  findByName(projectKey, name) {
    return this.db.one(sql`SELECT * FROM versions WHERE project_key = ${projectKey} AND lower(name) = lower(${String(name)})`);
  }

  list(projectKey, statuses = []) {
    return this.db.many(sql`
      SELECT * FROM versions WHERE project_key = ${projectKey}
        ${statuses.length ? sql`AND status = ANY(${statuses}::text[])` : sql.empty}
      ORDER BY CASE status WHEN 'unreleased' THEN 0 WHEN 'released' THEN 1 ELSE 2 END, position, id`);
  }

  async nameTaken(projectKey, name, exceptId = 0) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM versions WHERE project_key = ${projectKey} AND lower(name) = lower(${name}) AND id <> ${exceptId}`));
  }

  async nextPosition(projectKey) {
    return ((await this.db.value(sql`SELECT max(position) FROM versions WHERE project_key = ${projectKey}`)) ?? -1) + 1;
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO versions ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE versions SET ${sql.set(fields)} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM versions WHERE id = ${id}`);
  }

  async stats(versionIds) {
    if (!versionIds.length) return new Map();
    const rows = await this.db.many(sql`
      SELECT i.fix_version_id,
             count(*)::int AS total,
             count(*) FILTER (WHERE st.category = 'done')::int AS done,
             count(*) FILTER (WHERE st.category = 'in_progress')::int AS in_progress,
             COALESCE(sum(i.story_points), 0) AS points
        FROM issues i JOIN statuses st ON st.id = i.status_id
       WHERE i.fix_version_id = ANY(${versionIds}::int[])
       GROUP BY i.fix_version_id`);
    return new Map(rows.map((r) => [r.fix_version_id, r]));
  }
}

module.exports = { VersionRepository };
