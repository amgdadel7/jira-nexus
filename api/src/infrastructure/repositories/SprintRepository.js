'use strict';

const { sql } = require('../database/sql');

/** Work below epic level counts towards sprint totals (epics span sprints). */
const SPRINT_WORK = sql.raw('it.hierarchy_level < 1');

class SprintRepository {
  constructor({ db }) {
    this.db = db;
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM sprints WHERE id = ${Number(id)}`);
  }

  findByName(name) {
    return this.db.one(sql`SELECT * FROM sprints WHERE lower(name) = lower(${String(name)})`);
  }

  list({ projectKey = null, projectKeys = null, states = [] } = {}) {
    return this.db.many(sql`
      SELECT * FROM sprints
      ${sql.where([
        projectKey && sql`project_key = ${projectKey}`,
        projectKeys && sql`project_key = ANY(${projectKeys}::text[])`,
        states.length && sql`state = ANY(${states}::text[])`,
      ])}
      ORDER BY CASE state WHEN 'active' THEN 0 WHEN 'future' THEN 1 ELSE 2 END,
               CASE WHEN state = 'closed' THEN completed_at END DESC NULLS LAST, position, id`);
  }

  active(projectKey) {
    return this.db.one(sql`SELECT * FROM sprints WHERE project_key = ${projectKey} AND state = 'active'`);
  }

  async nameTaken(name, exceptId = 0) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM sprints WHERE lower(name) = lower(${name}) AND id <> ${exceptId}`));
  }

  /** "KAN Sprint 5" – one more than the highest number used so far. */
  async nextName(projectKey) {
    const prefix = `${projectKey} Sprint `;
    const rows = await this.db.many(sql`SELECT name FROM sprints WHERE name LIKE ${`${prefix}%`}`);
    const numbers = rows.map((r) => parseInt(r.name.slice(prefix.length), 10)).filter((n) => !Number.isNaN(n));
    return `${prefix}${numbers.length ? Math.max(...numbers) + 1 : 1}`;
  }

  async nextPosition() {
    return ((await this.db.value(sql`SELECT max(position) FROM sprints`)) ?? -1) + 1;
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO sprints ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE sprints SET ${sql.set(fields)} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM sprints WHERE id = ${id}`);
  }

  /** { count, points } of sprint work, optionally only done / only open items. */
  async totals(sprintId, { category = null, notCategory = null } = {}) {
    return this.db.one(sql`
      SELECT count(*)::int AS count, COALESCE(sum(i.story_points), 0) AS points
        FROM issues i JOIN issue_types it ON it.id = i.issue_type_id JOIN statuses st ON st.id = i.status_id
       WHERE i.sprint_id = ${sprintId} AND ${SPRINT_WORK}
         ${category ? sql`AND st.category = ${category}` : sql.empty}
         ${notCategory ? sql`AND st.category <> ${notCategory}` : sql.empty}`);
  }

  /** Progress per sprint id: total/done/inProgress/points/donePoints. */
  async stats(sprintIds) {
    if (!sprintIds.length) return new Map();
    const rows = await this.db.many(sql`
      SELECT i.sprint_id,
             count(*)::int AS total,
             count(*) FILTER (WHERE st.category = 'done')::int AS done,
             count(*) FILTER (WHERE st.category = 'in_progress')::int AS in_progress,
             COALESCE(sum(i.story_points), 0) AS points,
             COALESCE(sum(i.story_points) FILTER (WHERE st.category = 'done'), 0) AS done_points
        FROM issues i JOIN issue_types it ON it.id = i.issue_type_id JOIN statuses st ON st.id = i.status_id
       WHERE i.sprint_id = ANY(${sprintIds}::int[]) AND ${SPRINT_WORK}
       GROUP BY i.sprint_id`);
    return new Map(rows.map((r) => [r.sprint_id, r]));
  }
}

module.exports = { SprintRepository };
