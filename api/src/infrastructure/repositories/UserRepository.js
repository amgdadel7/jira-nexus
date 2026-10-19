'use strict';

const { sql } = require('../database/sql');

/** users + user_preferences. */
class UserRepository {
  constructor({ db }) {
    this.db = db;
  }

  findById(id) {
    return this.db.one(sql`SELECT * FROM users WHERE id = ${String(id ?? '')}`);
  }

  findByEmail(email) {
    return this.db.one(sql`SELECT * FROM users WHERE lower(email) = lower(${String(email ?? '')})`);
  }

  async isActive(id) {
    if (!id) return false;
    return Boolean(await this.db.one(sql`SELECT 1 FROM users WHERE id = ${String(id)} AND active`));
  }

  async emailTaken(email, exceptId = null) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM users WHERE lower(email) = lower(${email}) AND id IS DISTINCT FROM ${exceptId}`));
  }

  /** Directory listing: people (no bots) with open work count and last login. */
  listDirectory() {
    return this.db.many(sql`
      SELECT u.*,
        (SELECT count(*) FROM issues i JOIN statuses s ON s.id = i.status_id WHERE i.assignee_id = u.id AND s.category <> 'done')::int AS open_count,
        (SELECT max(created_at) FROM sessions WHERE user_id = u.id) AS last_login
      FROM users u WHERE NOT u.bot ORDER BY u.active DESC, u.name`);
  }

  /** Everyone incl. inactive users and bots (history and avatars need their names). */
  listAll() {
    return this.db.many(sql`SELECT * FROM users ORDER BY name`);
  }

  activeNames() {
    return this.db.many(sql`SELECT id, name FROM users WHERE active`);
  }

  async namesByIds(ids) {
    const list = [...new Set(ids.filter(Boolean))];
    if (!list.length) return {};
    const rows = await this.db.many(sql`SELECT id, name FROM users WHERE id = ANY(${list}::text[])`);
    return Object.fromEntries(rows.map((r) => [r.id, r.name]));
  }

  async nameOf(id) {
    if (!id) return null;
    return this.db.value(sql`SELECT name FROM users WHERE id = ${id}`);
  }

  countActive() {
    return this.db.value(sql`SELECT count(*)::int FROM users WHERE active AND NOT bot`);
  }

  countAll() {
    return this.db.value(sql`SELECT count(*)::int FROM users`);
  }

  async insert(user) {
    return this.db.one(sql`INSERT INTO users ${sql.insertValues(user)} RETURNING *`);
  }

  async update(id, fields) {
    if (!Object.keys(fields).length) return this.findById(id);
    return this.db.one(sql`UPDATE users SET ${sql.set(fields)} WHERE id = ${id} RETURNING *`);
  }

  /* ---------- preferences ---------- */
  getPreferences(userId) {
    return this.db.one(sql`SELECT * FROM user_preferences WHERE user_id = ${userId}`);
  }

  async savePreferences(userId, { theme, reduceMotion, weekStart, notify }) {
    return this.db.one(sql`
      INSERT INTO user_preferences (user_id, theme, reduce_motion, week_start, notify, updated_at)
      VALUES (${userId}, ${theme}, ${reduceMotion}, ${weekStart}, ${JSON.stringify(notify)}::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, reduce_motion = EXCLUDED.reduce_motion,
        week_start = EXCLUDED.week_start, notify = EXCLUDED.notify, updated_at = now()
      RETURNING *`);
  }

  /** Recipients that want a notification type (active humans, not opted out). */
  async notifiableIds(ids, type) {
    const list = [...new Set(ids.filter(Boolean))];
    if (!list.length) return [];
    const rows = await this.db.many(sql`
      SELECT u.id FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE u.id = ANY(${list}::text[]) AND u.active AND NOT u.bot
        AND COALESCE((p.notify ->> ${type})::boolean, true)`);
    return rows.map((r) => r.id);
  }
}

module.exports = { UserRepository };
