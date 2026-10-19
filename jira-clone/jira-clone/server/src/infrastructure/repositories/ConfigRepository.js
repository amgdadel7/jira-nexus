'use strict';

const { sql } = require('../database/sql');

const LOOKUP_TABLES = { issue_types: 'issue_type_id', priorities: 'priority_id', resolutions: 'resolution_id', statuses: 'status_id' };

/**
 * Jira configuration: issue_types, priorities, resolutions, statuses,
 * workflows, workflow_statuses, workflow_transitions.
 */
class ConfigRepository {
  constructor({ db }) {
    this.db = db;
  }

  /* ---------- generic lookup tables ---------- */
  list(table) {
    this.assertTable(table);
    const order = table === 'statuses' ? 'id' : 'position, id';
    return this.db.many(sql`SELECT * FROM ${sql.ident(table)} ORDER BY ${sql.raw(order)}`);
  }

  find(table, id) {
    this.assertTable(table);
    return this.db.one(sql`SELECT * FROM ${sql.ident(table)} WHERE id = ${id}`);
  }

  insert(table, fields) {
    this.assertTable(table);
    return this.db.one(sql`INSERT INTO ${sql.ident(table)} ${sql.insertValues(fields)} RETURNING *`);
  }

  update(table, id, fields) {
    this.assertTable(table);
    return this.db.one(sql`UPDATE ${sql.ident(table)} SET ${sql.set(fields)} WHERE id = ${id} RETURNING *`);
  }

  delete(table, id) {
    this.assertTable(table);
    return this.db.query(sql`DELETE FROM ${sql.ident(table)} WHERE id = ${id}`);
  }

  async nextPosition(table) {
    this.assertTable(table);
    return (await this.db.value(sql`SELECT COALESCE(max(position), -1) + 1 FROM ${sql.ident(table)}`)) ?? 0;
  }

  clearDefault(table) {
    this.assertTable(table);
    return this.db.query(sql`UPDATE ${sql.ident(table)} SET is_default = false WHERE is_default`);
  }

  /** Number of work items referencing a lookup row. */
  usageCount(table, id) {
    this.assertTable(table);
    return this.db.value(sql`SELECT count(*)::int FROM issues WHERE ${sql.ident(LOOKUP_TABLES[table])} = ${id}`);
  }

  /** Moves every work item from one lookup row to another. */
  reassign(table, fromId, toId) {
    this.assertTable(table);
    const col = sql.ident(LOOKUP_TABLES[table]);
    return this.db.query(sql`UPDATE issues SET ${col} = ${toId}, updated_at = now() WHERE ${col} = ${fromId}`);
  }

  async usageCounts(table) {
    this.assertTable(table);
    const rows = await this.db.many(sql`SELECT ${sql.ident(LOOKUP_TABLES[table])} AS id, count(*)::int AS n FROM issues GROUP BY 1`);
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  assertTable(table) {
    if (!LOOKUP_TABLES[table]) throw new Error(`Unknown configuration table ${table}`);
  }

  /* ---------- workflows ---------- */
  listWorkflows() {
    return this.db.many(sql`SELECT * FROM workflows ORDER BY is_default DESC, name`);
  }

  listWorkflowStatuses() {
    return this.db.many(sql`
      SELECT ws.workflow_id, ws.status_id, ws.position, ws.is_initial, s.name, s.category, s.description
      FROM workflow_statuses ws JOIN statuses s ON s.id = ws.status_id ORDER BY ws.workflow_id, ws.position`);
  }

  listWorkflowTransitions() {
    return this.db.many(sql`SELECT * FROM workflow_transitions ORDER BY workflow_id, position, id`);
  }

  insertWorkflow(fields) {
    return this.db.one(sql`INSERT INTO workflows ${sql.insertValues(fields)} RETURNING *`);
  }

  updateWorkflow(id, fields) {
    return this.db.one(sql`UPDATE workflows SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = ${id} RETURNING *`);
  }

  deleteWorkflow(id) {
    return this.db.query(sql`DELETE FROM workflows WHERE id = ${id}`);
  }

  async replaceWorkflowDefinition(id, statuses, transitions) {
    await this.db.query(sql`DELETE FROM workflow_transitions WHERE workflow_id = ${id}`);
    await this.db.query(sql`DELETE FROM workflow_statuses WHERE workflow_id = ${id}`);
    if (statuses.length) {
      await this.db.query(sql`INSERT INTO workflow_statuses (workflow_id, status_id, position, is_initial) VALUES ${sql.join(
        statuses.map((s, i) => sql`(${id}, ${s.statusId}, ${i}, ${Boolean(s.isInitial)})`),
      )}`);
    }
    if (transitions.length) {
      await this.db.query(sql`INSERT INTO workflow_transitions (workflow_id, name, from_status_id, to_status_id, position) VALUES ${sql.join(
        transitions.map((t, i) => sql`(${id}, ${t.name}, ${t.fromStatusId ?? null}, ${t.toStatusId}, ${i})`),
      )}`);
    }
  }

  projectsUsingWorkflow(id) {
    return this.db.many(sql`SELECT key, name FROM projects WHERE workflow_id = ${id} ORDER BY key`);
  }

  /** Work items of a project whose status is not part of a workflow (needed before switching workflows). */
  issuesOutsideWorkflow(projectKey, workflowId) {
    return this.db.many(sql`
      SELECT i.status_id, s.name, count(*)::int AS n FROM issues i JOIN statuses s ON s.id = i.status_id
      WHERE i.project_key = ${projectKey}
        AND i.status_id NOT IN (SELECT status_id FROM workflow_statuses WHERE workflow_id = ${workflowId})
      GROUP BY i.status_id, s.name`);
  }

  moveProjectStatus(projectKey, fromStatusId, toStatusId) {
    return this.db.query(sql`UPDATE issues SET status_id = ${toStatusId}, updated_at = now() WHERE project_key = ${projectKey} AND status_id = ${fromStatusId}`);
  }

  async statusInAnyWorkflow(statusId) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM workflow_statuses WHERE status_id = ${statusId} LIMIT 1`));
  }
}

module.exports = { ConfigRepository };
