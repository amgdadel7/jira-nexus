'use strict';

const { sql } = require('../database/sql');

class LinkRepository {
  constructor({ db }) {
    this.db = db;
  }

  /** Links of an issue in both directions, with the other item's display fields. */
  forIssue(issueId) {
    return this.db.many(sql`
      SELECT l.id, l.type, 'outward' AS direction, t.key, t.project_key, t.summary, t.status, t.status_category, t.type AS issue_type, t.priority, t.assignee_id
        FROM issue_links l JOIN issue_view t ON t.id = l.target_id WHERE l.source_id = ${issueId}
      UNION ALL
      SELECT l.id, l.type, 'inward' AS direction, s.key, s.project_key, s.summary, s.status, s.status_category, s.type AS issue_type, s.priority, s.assignee_id
        FROM issue_links l JOIN issue_view s ON s.id = l.source_id WHERE l.target_id = ${issueId}
      ORDER BY id`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`
      SELECT l.*, s.key AS source_key, s.project_key AS source_project, t.key AS target_key
        FROM issue_links l JOIN issues s ON s.id = l.source_id JOIN issues t ON t.id = l.target_id
       WHERE l.id = ${Number(id)}`);
  }

  async exists(sourceId, targetId, type) {
    return Boolean(await this.db.one(sql`SELECT 1 FROM issue_links WHERE source_id = ${sourceId} AND target_id = ${targetId} AND type = ${type}`));
  }

  insert({ sourceId, targetId, type, createdBy }) {
    return this.db.value(sql`
      INSERT INTO issue_links (source_id, target_id, type, created_by)
      VALUES (${sourceId}, ${targetId}, ${type}, ${createdBy}) RETURNING id`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM issue_links WHERE id = ${id}`);
  }
}

module.exports = { LinkRepository };
