'use strict';

const { sql } = require('../database/sql');
const rank = require('../../domain/rank');

/**
 * Work items. Reads come from issue_view (names resolved, labels/components as
 * arrays); writes go to issues + issue_labels + issue_components.
 */
class IssueRepository {
  constructor({ db }) {
    this.db = db;
  }

  /* ---------- reads ---------- */
  findByKey(key) {
    return this.db.one(sql`SELECT * FROM issue_view i WHERE i.key = upper(${String(key ?? '')})`);
  }

  findById(id) {
    return this.db.one(sql`SELECT * FROM issue_view i WHERE i.id = ${id}`);
  }

  async keyOf(id) {
    if (!id) return null;
    return this.db.value(sql`SELECT key FROM issues WHERE id = ${id}`);
  }

  async keysByIds(ids) {
    const list = [...new Set(ids.filter(Boolean))];
    if (!list.length) return {};
    const rows = await this.db.many(sql`SELECT id, key FROM issues WHERE id = ANY(${list}::int[])`);
    return Object.fromEntries(rows.map((r) => [r.id, r.key]));
  }

  projectKeyOf(key) {
    return this.db.value(sql`SELECT project_key FROM issues WHERE key = upper(${String(key ?? '')})`);
  }

  children(parentId) {
    return this.db.many(sql`SELECT * FROM issue_view i WHERE i.parent_id = ${parentId} ORDER BY i.rank`);
  }

  childIds(parentId) {
    return this.db.many(sql`SELECT id, key FROM issues WHERE parent_id = ${parentId}`);
  }

  /** JQL search restricted to visible projects. `where`/`orderBy` are compiled Sql fragments over issue_view i. */
  async search({ where, orderBy, projectKeys, limit, offset }) {
    const filter = sql`(${where}) AND i.project_key = ANY(${projectKeys}::text[])`;
    const [total, rows] = await Promise.all([
      this.db.value(sql`SELECT count(*)::int FROM issue_view i WHERE ${filter}`),
      this.db.many(sql`SELECT * FROM issue_view i WHERE ${filter} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`),
    ]);
    return { total, rows };
  }

  /** Does an issue match a compiled JQL condition? */
  async matches(issueId, where) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM issue_view i WHERE i.id = ${issueId} AND (${where})`));
  }

  listWhere(where, orderBy = sql.raw('i.rank')) {
    return this.db.many(sql`SELECT * FROM issue_view i WHERE ${where} ORDER BY ${orderBy}`);
  }

  /** Work items in a sprint; `open` = not done, `belowEpic` = excludes epics (sprint work). */
  inSprint(sprintId, { open = false, belowEpic = false } = {}) {
    return this.db.many(sql`
      SELECT * FROM issue_view i WHERE i.sprint_id = ${sprintId}
        ${open ? sql`AND i.status_category <> 'done'` : sql.empty}
        ${belowEpic ? sql`AND i.hierarchy_level < 1` : sql.empty}
      ORDER BY i.rank`);
  }

  withFixVersion(versionId, { open = false } = {}) {
    return this.db.many(sql`
      SELECT * FROM issue_view i WHERE i.fix_version_id = ${versionId}
        ${open ? sql`AND i.status_category <> 'done'` : sql.empty}
      ORDER BY i.rank`);
  }

  openAssignedTo(userId) {
    return this.db.many(sql`SELECT * FROM issue_view i WHERE i.assignee_id = ${userId} AND i.status_category <> 'done'`);
  }

  /* ---------- writes ---------- */
  async insert(columns) {
    return this.db.value(sql`INSERT INTO issues ${sql.insertValues(columns)} RETURNING id`);
  }

  update(id, columns) {
    return this.db.query(sql`UPDATE issues SET ${sql.set({ ...columns, updated_at: new Date().toISOString() })} WHERE id = ${id}`);
  }

  touch(id) {
    return this.db.query(sql`UPDATE issues SET updated_at = now() WHERE id = ${id}`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM issues WHERE id = ${id}`);
  }

  /** Replaces the labels of an issue (creating missing labels in the dictionary). */
  async setLabels(issueId, names) {
    await this.db.query(sql`DELETE FROM issue_labels WHERE issue_id = ${issueId}`);
    for (const [position, name] of names.entries()) {
      const labelId = await this.ensureLabel(name);
      await this.db.query(sql`INSERT INTO issue_labels (issue_id, label_id, position) VALUES (${issueId}, ${labelId}, ${position}) ON CONFLICT DO NOTHING`);
    }
  }

  async ensureLabel(name) {
    const existing = await this.db.value(sql`SELECT id FROM labels WHERE lower(name) = lower(${name})`);
    if (existing) return existing;
    return this.db.value(sql`INSERT INTO labels (name) VALUES (${name}) ON CONFLICT ((lower(name))) DO UPDATE SET name = labels.name RETURNING id`);
  }

  async setComponents(issueId, componentIds) {
    await this.db.query(sql`DELETE FROM issue_components WHERE issue_id = ${issueId}`);
    for (const [position, componentId] of componentIds.entries()) {
      await this.db.query(sql`INSERT INTO issue_components (issue_id, component_id, position) VALUES (${issueId}, ${componentId}, ${position}) ON CONFLICT DO NOTHING`);
    }
  }

  /* ---------- rank ---------- */
  async nextRank() {
    return rank.nextRank(await this.db.value(sql`SELECT max(rank) FROM issues`));
  }

  rankOf(key) {
    return this.db.one(sql`SELECT id, rank FROM issues WHERE key = upper(${String(key ?? '')})`);
  }

  /** Closest rank below/above `value`, ignoring the item being moved. */
  neighbourBelow(value, exceptId = 0) {
    return this.db.value(sql`SELECT max(rank) FROM issues WHERE rank < ${value} AND id <> ${exceptId}`);
  }

  neighbourAbove(value, exceptId = 0) {
    return this.db.value(sql`SELECT min(rank) FROM issues WHERE rank > ${value} AND id <> ${exceptId}`);
  }

  deleteMany(ids) {
    return this.db.query(sql`DELETE FROM issues WHERE id = ANY(${ids}::int[])`);
  }

  /** Sub-task level children (they travel with their parent into the recycle bin). */
  async subtaskIds(parentId) {
    const rows = await this.db.many(sql`
      SELECT i.id FROM issues i JOIN issue_types it ON it.id = i.issue_type_id
       WHERE i.parent_id = ${parentId} AND it.hierarchy_level < 0`);
    return rows.map((r) => r.id);
  }

  setRank(id, value) {
    return this.db.query(sql`UPDATE issues SET rank = ${value} WHERE id = ${id}`);
  }

  /** Renumbers all ranks 1024, 2048, … keeping the current order. */
  rebalanceRanks() {
    return this.db.query(sql`
      UPDATE issues SET rank = r.n * ${rank.STEP}
      FROM (SELECT id, row_number() OVER (ORDER BY rank, id) AS n FROM issues) r WHERE r.id = issues.id`);
  }

  /* ---------- watchers ---------- */
  watch(issueId, userId) {
    if (!userId) return Promise.resolve();
    return this.db.query(sql`INSERT INTO watchers (issue_id, user_id) VALUES (${issueId}, ${userId}) ON CONFLICT DO NOTHING`);
  }

  unwatch(issueId, userId) {
    return this.db.query(sql`DELETE FROM watchers WHERE issue_id = ${issueId} AND user_id = ${userId}`);
  }

  async watcherIds(issueId) {
    return (await this.db.many(sql`SELECT user_id FROM watchers WHERE issue_id = ${issueId}`)).map((r) => r.user_id);
  }

  /* ---------- history ---------- */
  addHistory({ issueId, authorId, field, from = null, to = null, at }) {
    return this.db.query(sql`
      INSERT INTO history (issue_id, author_id, field, from_value, to_value, created_at)
      VALUES (${issueId}, ${authorId}, ${field}, ${from}, ${to}, ${at || new Date().toISOString()})`);
  }

  history(issueId) {
    return this.db.many(sql`SELECT * FROM history WHERE issue_id = ${issueId} ORDER BY created_at DESC, id DESC`);
  }
}

module.exports = { IssueRepository };
