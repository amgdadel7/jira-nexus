'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const { sql, Sql } = require('./sql');

/**
 * Query façade used by every repository.
 *
 *   await db.many(sql`SELECT …`)      → rows
 *   await db.one(sql`SELECT …`)       → first row or null
 *   await db.value(sql`SELECT count(*) …`) → first column of the first row
 *   await db.query(sql`UPDATE …`)     → { rows, rowCount }
 *   await db.tx(async () => { … })    → runs the callback in one transaction
 *
 * The active transaction travels in AsyncLocalStorage, so services can wrap a
 * use case in db.tx() and every repository call inside joins it automatically.
 * Nested tx() calls simply join the outer transaction; db.afterCommit() defers
 * side effects until the outermost transaction has committed.
 */
class Database {
  constructor(adapter, { log = false } = {}) {
    this.adapter = adapter;
    this.kind = adapter.kind;
    this.log = log;
    this.storage = new AsyncLocalStorage();
  }

  get executor() {
    return this.storage.getStore()?.executor || this.adapter;
  }

  get inTransaction() {
    return Boolean(this.storage.getStore());
  }

  async query(statement, params) {
    const { text, values } = statement instanceof Sql ? statement.toQuery() : { text: statement, values: params || [] };
    const started = this.log ? Date.now() : 0;
    try {
      return await this.serialize((executor) => executor.query(text, values));
    } catch (err) {
      err.sql = text;
      throw err;
    } finally {
      if (this.log) console.log(`[sql ${Date.now() - started}ms] ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
    }
  }

  async many(statement, params) {
    return (await this.query(statement, params)).rows;
  }

  async one(statement, params) {
    return (await this.query(statement, params)).rows[0] || null;
  }

  async value(statement, params) {
    const row = await this.one(statement, params);
    return row ? Object.values(row)[0] : null;
  }

  /** Runs raw multi-statement SQL (migrations). */
  exec(text) {
    return this.serialize((executor) => executor.exec(text));
  }

  /**
   * A transaction owns a single connection, which can run one statement at a
   * time; statements issued concurrently (Promise.all) inside a transaction are
   * queued. Outside a transaction the pool runs them in parallel.
   */
  serialize(run) {
    const context = this.storage.getStore();
    if (!context) return run(this.adapter);
    const next = context.queue.then(() => run(context.executor));
    context.queue = next.catch(() => {});
    return next;
  }

  async tx(fn) {
    if (this.inTransaction) return fn();
    const context = { executor: null, afterCommit: [], queue: Promise.resolve() };
    const result = await this.adapter.transaction((executor) => {
      context.executor = executor;
      return this.storage.run(context, fn);
    });
    // Side effects (domain events, automation, webhooks) only see committed data.
    for (const callback of context.afterCommit) await callback();
    return result;
  }

  /**
   * Runs `callback` once the surrounding transaction has committed (dropped on
   * rollback). Outside a transaction it runs immediately.
   */
  afterCommit(callback) {
    const context = this.storage.getStore();
    if (context) {
      context.afterCommit.push(callback);
      return Promise.resolve();
    }
    return Promise.resolve().then(callback);
  }

  close() {
    return this.adapter.close();
  }
}

module.exports = { Database, sql };
