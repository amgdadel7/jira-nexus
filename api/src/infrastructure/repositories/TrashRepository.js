'use strict';

const { sql } = require('../database/sql');

/** Tables whose rows hang off a work item and travel with it into the recycle bin. */
const CHILD_TABLES = ['comments', 'history', 'watchers', 'votes', 'attachments', 'worklogs', 'dev_items',
  'goal_issues', 'issue_labels', 'issue_components', 'custom_field_values'];

/**
 * Recycle bin. A trash entry holds a raw snapshot of the issue rows (with
 * sub-tasks) and all child rows, so restore puts back exactly what was deleted.
 */
class TrashRepository {
  constructor({ db }) {
    this.db = db;
    this.childTables = CHILD_TABLES;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM trash WHERE id = ${Number(id)}`);
  }

  list(projectKey) {
    return this.db.many(sql`SELECT * FROM trash WHERE project_key = ${projectKey} ORDER BY deleted_at DESC, id DESC`);
  }

  olderThan(cutoffIso) {
    return this.db.many(sql`SELECT * FROM trash WHERE deleted_at < ${cutoffIso}`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM trash WHERE id = ${id}`);
  }

  /** Raw rows needed to rebuild `issueIds` later. */
  async snapshot(issueIds) {
    const ids = sql`${issueIds}::int[]`;
    const snap = { issues: await this.db.many(sql`SELECT * FROM issues WHERE id = ANY(${ids}) ORDER BY id`) };
    for (const table of CHILD_TABLES) {
      snap[table] = await this.db.many(sql`SELECT * FROM ${sql.ident(table)} WHERE issue_id = ANY(${ids})`);
    }
    snap.issue_links = await this.db.many(sql`SELECT * FROM issue_links WHERE source_id = ANY(${ids}) OR target_id = ANY(${ids})`);
    snap.orphaned = (await this.db.many(sql`SELECT id FROM issues WHERE parent_id = ANY(${ids}) AND NOT (id = ANY(${ids}))`)).map((r) => r.id);
    return snap;
  }

  insert({ projectKey, issueKey, summary, type, snapshot, files, deletedBy }) {
    return this.db.value(sql`
      INSERT INTO trash (project_key, issue_key, summary, type, snapshot, files, deleted_by)
      VALUES (${projectKey}, ${issueKey}, ${summary}, ${type}, ${JSON.stringify(snapshot)}::jsonb, ${JSON.stringify(files)}::jsonb, ${deletedBy})
      RETURNING id`);
  }

  /** INSERT … ON CONFLICT DO NOTHING of a snapshot row. Returns true when inserted. */
  async insertRow(table, row) {
    const result = await this.db.query(sql`INSERT INTO ${sql.ident(table)} ${sql.insertValues(jsonSafe(table, row))} ON CONFLICT DO NOTHING`);
    return result.rowCount > 0;
  }

  async exists(table, column, value) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM ${sql.ident(table)} WHERE ${sql.ident(column)} = ${value}`));
  }

  /** Children that lost their parent when it was deleted get it back on restore. */
  reparent(issueId, parentId) {
    return this.db.query(sql`UPDATE issues SET parent_id = ${parentId} WHERE id = ${issueId} AND parent_id IS NULL`);
  }

  /** Identity columns keep working after rows were re-inserted with explicit ids. */
  async syncIdentity(table) {
    await this.db.query(sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), GREATEST((SELECT max(id) FROM ${sql.ident(table)}), 1))`);
  }
}

/** jsonb columns come back as objects/arrays; send them back as JSON text. */
function jsonSafe(table, row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const alwaysJson = table === 'custom_field_values' && k === 'value'; // a jsonb scalar such as "text"
    out[k] = alwaysJson || (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
  }
  return out;
}

module.exports = { TrashRepository, CHILD_TABLES };
