'use strict';

const { sql } = require('../database/sql');

/** projects, project_members, permission_scheme_entries, project_stars, board_column_limits. */
class ProjectRepository {
  constructor({ db }) {
    this.db = db;
  }

  findByKey(key) {
    return this.db.one(sql`SELECT * FROM projects WHERE key = upper(${String(key ?? '')})`);
  }

  listAll() {
    return this.db.many(sql`SELECT * FROM projects ORDER BY name`);
  }

  async listKeys() {
    return (await this.db.many(sql`SELECT key FROM projects ORDER BY key`)).map((r) => r.key);
  }

  count() {
    return this.db.value(sql`SELECT count(*)::int FROM projects`);
  }

  async nameTaken(name, exceptKey = '') {
    return Boolean(await this.db.one(sql`SELECT 1 FROM projects WHERE lower(name) = lower(${name}) AND key <> ${exceptKey}`));
  }

  insert(project) {
    return this.db.one(sql`INSERT INTO projects ${sql.insertValues(project)} RETURNING *`);
  }

  update(key, fields) {
    return this.db.one(sql`UPDATE projects SET ${sql.set(fields)} WHERE key = ${key} RETURNING *`);
  }

  /** Removes the project and everything in it. Returns the number of work items removed. */
  async deleteCascade(key) {
    const removed = (await this.db.query(sql`DELETE FROM issues WHERE project_key = ${key}`)).rowCount;
    await this.db.query(sql`DELETE FROM trash WHERE project_key = ${key}`);
    await this.db.query(sql`DELETE FROM projects WHERE key = ${key}`);
    return removed;
  }

  /** Allocates the next work item number (row lock keeps keys unique under concurrency). */
  async takeNextNumber(key) {
    return this.db.value(sql`UPDATE projects SET next_num = next_num + 1 WHERE key = ${key} RETURNING next_num - 1`);
  }

  stats(key) {
    return this.db.one(sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE s.category = 'done')::int AS done,
             count(*) FILTER (WHERE s.category <> 'done')::int AS open,
             max(i.updated_at) AS last
      FROM issues i JOIN statuses s ON s.id = i.status_id WHERE i.project_key = ${key}`);
  }

  /** Statuses currently used by the project's work items. */
  usedStatuses(key) {
    return this.db.many(sql`SELECT DISTINCT s.id, s.name FROM issues i JOIN statuses s ON s.id = i.status_id WHERE i.project_key = ${key}`);
  }

  /* ---------- members ---------- */
  memberCount(key) {
    return this.db.value(sql`SELECT count(*)::int FROM project_members WHERE project_key = ${key}`);
  }

  memberRole(key, userId) {
    return this.db.value(sql`SELECT role FROM project_members WHERE project_key = ${key} AND user_id = ${userId}`);
  }

  listMembers(key) {
    return this.db.many(sql`
      SELECT m.user_id, m.role, m.added_by, m.added_at FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_key = ${key} ORDER BY u.name`);
  }

  upsertMember(key, userId, role, addedBy) {
    return this.db.query(sql`
      INSERT INTO project_members (project_key, user_id, role, added_by) VALUES (${key}, ${userId}, ${role}, ${addedBy})
      ON CONFLICT (project_key, user_id) DO UPDATE SET role = EXCLUDED.role`);
  }

  addMemberIfMissing(key, userId, role, addedBy) {
    return this.db.query(sql`
      INSERT INTO project_members (project_key, user_id, role, added_by) VALUES (${key}, ${userId}, ${role}, ${addedBy})
      ON CONFLICT DO NOTHING`);
  }

  async removeMember(key, userId) {
    return (await this.db.query(sql`DELETE FROM project_members WHERE project_key = ${key} AND user_id = ${userId}`)).rowCount;
  }

  /** People who can be assigned work: members/admins and the lead. */
  assignableUserIds(key) {
    return this.db.many(sql`
      SELECT u.id, u.name FROM users u WHERE u.active AND NOT u.bot AND (
        u.id IN (SELECT user_id FROM project_members WHERE project_key = ${key} AND role IN ('admin', 'member'))
        OR u.id = (SELECT lead_id FROM projects WHERE key = ${key}))`);
  }

  /* ---------- permission scheme ---------- */
  permissionEntries(key) {
    return this.db.many(sql`SELECT permission, role FROM permission_scheme_entries WHERE project_key = ${key}`);
  }

  async replacePermissionScheme(key, scheme) {
    await this.db.query(sql`DELETE FROM permission_scheme_entries WHERE project_key = ${key}`);
    const rows = Object.entries(scheme).flatMap(([permission, roles]) => roles.map((role) => sql`(${key}, ${permission}, ${role})`));
    if (rows.length) await this.db.query(sql`INSERT INTO permission_scheme_entries (project_key, permission, role) VALUES ${sql.join(rows)}`);
    await this.db.query(sql`UPDATE projects SET custom_permissions = true WHERE key = ${key}`);
  }

  async resetPermissionScheme(key) {
    await this.db.query(sql`DELETE FROM permission_scheme_entries WHERE project_key = ${key}`);
    await this.db.query(sql`UPDATE projects SET custom_permissions = false WHERE key = ${key}`);
  }

  /* ---------- stars ---------- */
  async isStarred(userId, key) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM project_stars WHERE user_id = ${userId} AND project_key = ${key}`));
  }

  star(userId, key) {
    return this.db.query(sql`INSERT INTO project_stars (user_id, project_key) VALUES (${userId}, ${key}) ON CONFLICT DO NOTHING`);
  }

  unstar(userId, key) {
    return this.db.query(sql`DELETE FROM project_stars WHERE user_id = ${userId} AND project_key = ${key}`);
  }

  async starredKeys(userId) {
    return (await this.db.many(sql`SELECT project_key FROM project_stars WHERE user_id = ${userId}`)).map((r) => r.project_key);
  }

  /* ---------- board ---------- */
  async columnLimits(key) {
    const rows = await this.db.many(sql`
      SELECT s.name, b.wip_limit FROM board_column_limits b JOIN statuses s ON s.id = b.status_id WHERE b.project_key = ${key}`);
    return Object.fromEntries(rows.map((r) => [r.name, r.wip_limit]));
  }

  async replaceColumnLimits(key, limitsByStatusId) {
    await this.db.query(sql`DELETE FROM board_column_limits WHERE project_key = ${key}`);
    const rows = Object.entries(limitsByStatusId).map(([statusId, n]) => sql`(${key}, ${Number(statusId)}, ${n})`);
    if (rows.length) await this.db.query(sql`INSERT INTO board_column_limits (project_key, status_id, wip_limit) VALUES ${sql.join(rows)}`);
  }
}

module.exports = { ProjectRepository };
