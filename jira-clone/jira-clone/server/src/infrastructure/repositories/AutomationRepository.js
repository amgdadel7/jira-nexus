'use strict';

const { sql } = require('../database/sql');

/** automation_rules + automation_runs. */
class AutomationRepository {
  constructor({ db }) {
    this.db = db;
  }

  listRules(projectKey) {
    return this.db.many(sql`SELECT * FROM automation_rules WHERE project_key = ${projectKey} ORDER BY id`);
  }

  enabledRules(projectKey) {
    return this.db.many(sql`SELECT * FROM automation_rules WHERE project_key = ${projectKey} AND enabled ORDER BY id`);
  }

  findRule(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM automation_rules WHERE id = ${Number(id)}`);
  }

  insertRule(fields) {
    return this.db.one(sql`INSERT INTO automation_rules ${sql.insertValues(this.encode(fields))} RETURNING *`);
  }

  updateRule(id, fields) {
    return this.db.one(sql`UPDATE automation_rules SET ${sql.set({ ...this.encode(fields), updated_at: new Date().toISOString() })} WHERE id = ${id} RETURNING *`);
  }

  deleteRule(id) {
    return this.db.query(sql`DELETE FROM automation_rules WHERE id = ${id}`);
  }

  encode(fields) {
    const out = { ...fields };
    if (out.trigger !== undefined) out.trigger = JSON.stringify(out.trigger);
    if (out.actions !== undefined) out.actions = JSON.stringify(out.actions);
    return out;
  }

  /** Run statistics per rule id: Map(id → {total, ok, failed, last, lastStatus}). */
  async stats(ruleIds) {
    if (!ruleIds.length) return new Map();
    const rows = await this.db.many(sql`
      SELECT rule_id,
             count(*)::int AS total,
             count(*) FILTER (WHERE status = 'success')::int AS ok,
             count(*) FILTER (WHERE status IN ('failure', 'some_errors'))::int AS failed,
             max(created_at) AS last,
             (array_agg(status ORDER BY id DESC))[1] AS last_status
        FROM automation_runs WHERE rule_id = ANY(${ruleIds}::int[]) GROUP BY rule_id`);
    return new Map(rows.map((r) => [r.rule_id, r]));
  }

  recordRun({ ruleId, issueKey, status, message, actions, durationMs }) {
    return this.db.one(sql`
      INSERT INTO automation_runs (rule_id, issue_key, status, message, actions, duration_ms)
      VALUES (${ruleId}, ${issueKey}, ${status}, ${message}, ${JSON.stringify(actions)}::jsonb, ${durationMs}) RETURNING *`);
  }

  runs(ruleId, limit) {
    return this.db.many(sql`
      SELECT x.*, r.name AS rule_name FROM automation_runs x JOIN automation_rules r ON r.id = x.rule_id
       WHERE x.rule_id = ${ruleId} ORDER BY x.id DESC LIMIT ${limit}`);
  }

  projectRuns(projectKey, { status = null, limit }) {
    return this.db.many(sql`
      SELECT x.*, r.name AS rule_name FROM automation_runs x JOIN automation_rules r ON r.id = x.rule_id
       WHERE r.project_key = ${projectKey} ${status ? sql`AND x.status = ${status}` : sql.empty}
       ORDER BY x.id DESC LIMIT ${limit}`);
  }

  countRunsSince(since, statuses) {
    return this.db.value(sql`SELECT count(*)::int FROM automation_runs WHERE created_at >= ${since} AND status = ANY(${statuses}::text[])`);
  }

  /** Active project member or lead with the fewest open items ("balanced workload"). */
  balancedAssignee(projectKey) {
    return this.db.value(sql`
      SELECT u.id FROM users u
       WHERE u.active AND NOT u.bot
         AND (u.id IN (SELECT user_id FROM project_members WHERE project_key = ${projectKey} AND role IN ('admin', 'member'))
              OR u.id = (SELECT lead_id FROM projects WHERE key = ${projectKey}))
       ORDER BY (SELECT count(*) FROM issue_view i WHERE i.assignee_id = u.id AND i.project_key = ${projectKey} AND i.status_category <> 'done'), u.name
       LIMIT 1`);
  }
}

module.exports = { AutomationRepository };
