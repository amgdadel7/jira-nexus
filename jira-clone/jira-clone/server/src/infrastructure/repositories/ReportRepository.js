'use strict';

const { sql } = require('../database/sql');

/** Read models for agile reports and the timesheet. */
class ReportRepository {
  constructor({ db }) {
    this.db = db;
  }

  closedSprints(projectKey, limit) {
    return this.db.many(sql`
      SELECT * FROM (SELECT * FROM sprints WHERE project_key = ${projectKey} AND state = 'closed' ORDER BY completed_at DESC LIMIT ${limit}) s
      ORDER BY completed_at ASC`);
  }

  /** Items currently in the sprint (no epics). */
  sprintItems(sprintId) {
    return this.db.many(sql`SELECT * FROM issue_view WHERE sprint_id = ${sprintId} AND hierarchy_level < 1 ORDER BY rank`);
  }

  /** Items that left the sprint (from the sprint history) and are not in it any more. */
  movedOutOf(sprint) {
    return this.db.many(sql`
      SELECT DISTINCT ON (i.id) i.*, h.to_value AS moved_to, h.created_at AS moved_at
        FROM history h JOIN issue_view i ON i.id = h.issue_id
       WHERE h.field = 'sprint' AND h.from_value = ${sprint.name} AND i.hierarchy_level < 1
         AND i.sprint_id IS DISTINCT FROM ${sprint.id}
       ORDER BY i.id, h.created_at DESC`);
  }

  flowItems(projectKey) {
    return this.db.many(sql`SELECT id, status, created_at FROM issue_view WHERE project_key = ${projectKey} AND hierarchy_level < 1`);
  }

  statusChanges(projectKey) {
    return this.db.many(sql`
      SELECT h.issue_id, h.from_value, h.to_value, h.created_at
        FROM history h JOIN issues i ON i.id = h.issue_id
       WHERE i.project_key = ${projectKey} AND h.field = 'status'
       ORDER BY h.created_at, h.id`);
  }

  timesheet(projectKey, { from, to, userId = null }) {
    return this.db.many(sql`
      SELECT w.author_id, to_char(w.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, w.time_spent,
             i.key, i.summary, i.type, i.status
        FROM worklogs w JOIN issue_view i ON i.id = w.issue_id
       WHERE i.project_key = ${projectKey}
         AND (w.started_at AT TIME ZONE 'UTC')::date BETWEEN ${from}::date AND ${to}::date
         ${userId ? sql`AND w.author_id = ${userId}` : sql.empty}`);
  }

  estimateTotals(projectKey) {
    return this.db.one(sql`
      SELECT coalesce(sum(original_estimate), 0)::int AS original, coalesce(sum(remaining_estimate), 0)::int AS remaining,
             coalesce(sum(time_spent), 0)::int AS spent, count(original_estimate)::int AS estimated, count(*)::int AS items
        FROM issue_view WHERE project_key = ${projectKey} AND hierarchy_level < 1`);
  }
}

module.exports = { ReportRepository };
