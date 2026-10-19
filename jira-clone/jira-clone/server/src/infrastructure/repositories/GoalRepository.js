'use strict';

const { sql } = require('../database/sql');

class GoalRepository {
  constructor({ db }) {
    this.db = db;
  }

  list() {
    return this.db.many(sql`SELECT * FROM goals ORDER BY target_date NULLS LAST, id`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM goals WHERE id = ${Number(id)}`);
  }

  forIssue(issueId) {
    return this.db.many(sql`SELECT g.id, g.name, g.status FROM goal_issues gi JOIN goals g ON g.id = gi.goal_id WHERE gi.issue_id = ${issueId} ORDER BY g.name`);
  }

  issues(goalId) {
    return this.db.many(sql`SELECT i.* FROM issue_view i JOIN goal_issues gi ON gi.issue_id = i.id WHERE gi.goal_id = ${goalId} ORDER BY i.rank`);
  }

  /** Progress counts linked items plus their children. */
  progress(issueIds) {
    if (!issueIds.length) return Promise.resolve({ total: 0, done: 0 });
    return this.db.one(sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE st.category = 'done')::int AS done
        FROM issues i JOIN statuses st ON st.id = i.status_id
       WHERE i.id = ANY(${issueIds}::int[]) OR i.parent_id = ANY(${issueIds}::int[])`);
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO goals ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE goals SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM goals WHERE id = ${id}`);
  }

  link(goalId, issueId) {
    return this.db.query(sql`INSERT INTO goal_issues (goal_id, issue_id) VALUES (${goalId}, ${issueId}) ON CONFLICT DO NOTHING`);
  }

  unlink(goalId, issueId) {
    return this.db.query(sql`DELETE FROM goal_issues WHERE goal_id = ${goalId} AND issue_id = ${issueId}`);
  }
}

module.exports = { GoalRepository };
