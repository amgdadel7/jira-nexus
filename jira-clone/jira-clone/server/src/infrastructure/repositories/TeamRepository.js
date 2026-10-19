'use strict';

const { sql } = require('../database/sql');

class TeamRepository {
  constructor({ db }) {
    this.db = db;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM teams WHERE id = ${Number(id)}`);
  }

  list() {
    return this.db.many(sql`SELECT * FROM teams ORDER BY lower(name)`);
  }

  async nameTaken(name, exceptId = 0) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM teams WHERE lower(name) = lower(${name}) AND id <> ${exceptId}`));
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO teams ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE teams SET ${sql.set(fields)} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM teams WHERE id = ${id}`);
  }

  /** Map team id → [user ids]. */
  async members(teamIds) {
    if (!teamIds.length) return new Map();
    const rows = await this.db.many(sql`SELECT team_id, user_id FROM team_members WHERE team_id = ANY(${teamIds}::int[]) ORDER BY user_id`);
    const map = new Map(teamIds.map((id) => [id, []]));
    rows.forEach((r) => map.get(r.team_id).push(r.user_id));
    return map;
  }

  async isMember(teamId, userId) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM team_members WHERE team_id = ${teamId} AND user_id = ${userId}`));
  }

  async replaceMembers(teamId, userIds) {
    await this.db.query(sql`DELETE FROM team_members WHERE team_id = ${teamId}`);
    for (const userId of userIds) {
      await this.db.query(sql`INSERT INTO team_members (team_id, user_id) VALUES (${teamId}, ${userId}) ON CONFLICT DO NOTHING`);
    }
  }

  async stats(teamIds) {
    if (!teamIds.length) return new Map();
    const rows = await this.db.many(sql`
      SELECT i.team_id, count(*)::int AS total, count(*) FILTER (WHERE st.category <> 'done')::int AS open
        FROM issues i JOIN statuses st ON st.id = i.status_id
       WHERE i.team_id = ANY(${teamIds}::int[]) GROUP BY i.team_id`);
    return new Map(rows.map((r) => [r.team_id, r]));
  }
}

module.exports = { TeamRepository };
