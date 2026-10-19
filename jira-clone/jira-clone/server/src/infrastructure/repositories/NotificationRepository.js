'use strict';

const { sql } = require('../database/sql');

class NotificationRepository {
  constructor({ db }) {
    this.db = db;
  }

  async insertMany(rows) {
    for (const r of rows) {
      await this.db.query(sql`
        INSERT INTO notifications (user_id, actor_id, issue_id, type, message)
        VALUES (${r.userId}, ${r.actorId}, ${r.issueId}, ${r.type}, ${r.message})`);
    }
  }

  list(userId, limit = 50) {
    return this.db.many(sql`
      SELECT n.*, i.key AS issue_key, i.summary AS issue_summary, i.type AS issue_type, i.project_key
        FROM notifications n LEFT JOIN issue_view i ON i.id = n.issue_id
       WHERE n.user_id = ${userId} ORDER BY n.created_at DESC, n.id DESC LIMIT ${limit}`);
  }

  unreadCount(userId) {
    return this.db.value(sql`SELECT count(*)::int FROM notifications WHERE user_id = ${userId} AND NOT read`);
  }

  markRead(userId, id = null) {
    return this.db.query(sql`UPDATE notifications SET read = true WHERE user_id = ${userId} ${id ? sql`AND id = ${id}` : sql.empty}`);
  }
}

module.exports = { NotificationRepository };
