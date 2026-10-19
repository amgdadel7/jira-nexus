'use strict';

const { sql } = require('../database/sql');

/** audit_log */
class AuditRepository {
  constructor({ db }) {
    this.db = db;
  }

  insert({ actorId, action, projectKey, target, details }) {
    return this.db.query(sql`
      INSERT INTO audit_log (actor_id, action, project_key, target, details)
      VALUES (${actorId}, ${action}, ${projectKey}, ${target}, ${JSON.stringify(details || {})}::jsonb)`);
  }

  list({ projectKey, actionPrefix, actorId, limit }) {
    const conditions = [
      projectKey && sql`project_key = ${projectKey}`,
      actionPrefix && sql`action LIKE ${`${actionPrefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}`,
      actorId && sql`actor_id = ${actorId}`,
    ];
    return this.db.many(sql`SELECT * FROM audit_log ${sql.where(conditions)} ORDER BY created_at DESC, id DESC LIMIT ${limit}`);
  }
}

module.exports = { AuditRepository };
