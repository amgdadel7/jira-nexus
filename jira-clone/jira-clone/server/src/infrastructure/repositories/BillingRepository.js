'use strict';

const { sql } = require('../database/sql');

/** subscription (single row), payment_methods, invoices and usage counters. */
class BillingRepository {
  constructor({ db }) {
    this.db = db;
  }

  async getSubscription() {
    let row = await this.db.one(sql`SELECT * FROM subscription WHERE id = 1`);
    if (!row) row = await this.db.one(sql`INSERT INTO subscription (id) VALUES (1) RETURNING *`);
    return row;
  }

  updateSubscription(fields) {
    return this.db.one(sql`UPDATE subscription SET ${sql.set({ ...fields, updated_at: new Date().toISOString() })} WHERE id = 1 RETURNING *`);
  }

  /* ---------- cards ---------- */
  defaultCard() {
    return this.db.one(sql`SELECT * FROM payment_methods WHERE is_default ORDER BY id DESC LIMIT 1`);
  }

  async saveCard(card) {
    await this.db.query(sql`UPDATE payment_methods SET is_default = false`);
    return this.db.one(sql`INSERT INTO payment_methods ${sql.insertValues({ ...card, is_default: true })} RETURNING *`);
  }

  /* ---------- invoices ---------- */
  countInvoices() {
    return this.db.value(sql`SELECT count(*)::int FROM invoices`);
  }

  insertInvoice(invoice) {
    return this.db.one(sql`INSERT INTO invoices ${sql.insertValues({ ...invoice, lines: JSON.stringify(invoice.lines) })} RETURNING *`);
  }

  listInvoices() {
    return this.db.many(sql`SELECT * FROM invoices ORDER BY created_at DESC, id DESC`);
  }

  findInvoice(idOrNumber) {
    return this.db.one(sql`SELECT * FROM invoices WHERE id = ${Number(idOrNumber) || -1} OR number = ${String(idOrNumber)}`);
  }

  lastPaidInvoiceFor(periodStart, plan) {
    return this.db.one(sql`
      SELECT * FROM invoices WHERE period_start = ${periodStart} AND plan = ${plan} AND status = 'paid' ORDER BY id DESC LIMIT 1`);
  }

  /* ---------- usage ---------- */
  usage() {
    return this.db.one(sql`
      SELECT (SELECT count(*) FROM users WHERE active)::int AS users,
             (SELECT COALESCE(sum(size), 0) FROM attachments)::bigint AS "storageBytes",
             (SELECT count(*) FROM projects)::int AS projects,
             (SELECT count(*) FROM issues)::int AS issues`);
  }
}

module.exports = { BillingRepository };
