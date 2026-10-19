'use strict';

const { sql } = require('../database/sql');

const KEEP_DELIVERIES = 200;

/** webhooks + webhook_deliveries. */
class WebhookRepository {
  constructor({ db }) {
    this.db = db;
  }

  list() {
    return this.db.many(sql`SELECT * FROM webhooks ORDER BY id`);
  }

  enabledFor(event) {
    return this.db.many(sql`SELECT * FROM webhooks WHERE enabled AND ${event} = ANY(events) ORDER BY id`);
  }

  find(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM webhooks WHERE id = ${Number(id)}`);
  }

  insert(fields) {
    return this.db.one(sql`INSERT INTO webhooks ${sql.insertValues(fields)} RETURNING *`);
  }

  update(id, fields) {
    return this.db.one(sql`UPDATE webhooks SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = ${id} RETURNING *`);
  }

  delete(id) {
    return this.db.query(sql`DELETE FROM webhooks WHERE id = ${id}`);
  }

  /** Map(webhookId → {total, ok, last_ok, last_status, last_at}). */
  async stats(ids) {
    if (!ids.length) return new Map();
    const rows = await this.db.many(sql`
      SELECT webhook_id, count(*)::int AS total, count(*) FILTER (WHERE ok)::int AS ok,
             (array_agg(ok ORDER BY id DESC))[1] AS last_ok,
             (array_agg(status_code ORDER BY id DESC))[1] AS last_status,
             max(created_at) AS last_at
        FROM webhook_deliveries WHERE webhook_id = ANY(${ids}::int[]) GROUP BY webhook_id`);
    return new Map(rows.map((r) => [r.webhook_id, r]));
  }

  async recordDelivery(d) {
    const exists = await this.db.value(sql`SELECT 1 FROM webhooks WHERE id = ${d.webhookId}`);
    if (!exists) return null; // deleted meanwhile
    const row = await this.db.one(sql`
      INSERT INTO webhook_deliveries (webhook_id, uuid, event, payload, status_code, ok, duration_ms, error, response, attempt)
      VALUES (${d.webhookId}, ${d.uuid}, ${d.event}, ${d.body}::jsonb, ${d.status}, ${d.ok}, ${d.durationMs}, ${d.error}, ${d.response}, ${d.attempt})
      RETURNING *`);
    await this.db.query(sql`
      DELETE FROM webhook_deliveries WHERE webhook_id = ${d.webhookId}
         AND id NOT IN (SELECT id FROM webhook_deliveries WHERE webhook_id = ${d.webhookId} ORDER BY id DESC LIMIT ${KEEP_DELIVERIES})`);
    return row;
  }

  deliveries(webhookId, limit) {
    return this.db.many(sql`SELECT * FROM webhook_deliveries WHERE webhook_id = ${webhookId} ORDER BY id DESC LIMIT ${limit}`);
  }

  findDelivery(id) {
    if (!/^\d+$/.test(String(id ?? ''))) return Promise.resolve(null);
    return this.db.one(sql`SELECT * FROM webhook_deliveries WHERE id = ${Number(id)}`);
  }

  lastAttempt(uuid) {
    return this.db.value(sql`SELECT max(attempt) FROM webhook_deliveries WHERE uuid = ${uuid}`);
  }
}

module.exports = { WebhookRepository };
