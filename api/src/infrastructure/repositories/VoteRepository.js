'use strict';

const { sql } = require('../database/sql');

class VoteRepository {
  constructor({ db }) {
    this.db = db;
  }

  async voterIds(issueId) {
    return (await this.db.many(sql`SELECT user_id FROM votes WHERE issue_id = ${issueId} ORDER BY created_at`)).map((r) => r.user_id);
  }

  voters(issueId) {
    return this.db.many(sql`SELECT user_id, created_at FROM votes WHERE issue_id = ${issueId} ORDER BY created_at`);
  }

  vote(issueId, userId) {
    return this.db.query(sql`INSERT INTO votes (issue_id, user_id) VALUES (${issueId}, ${userId}) ON CONFLICT DO NOTHING`);
  }

  unvote(issueId, userId) {
    return this.db.query(sql`DELETE FROM votes WHERE issue_id = ${issueId} AND user_id = ${userId}`);
  }
}

module.exports = { VoteRepository };
