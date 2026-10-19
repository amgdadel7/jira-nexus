'use strict';

const { createAdapter } = require('./adapters');
const { Database } = require('./database');
const { sql } = require('./sql');
const { migrate, resetSchema } = require('./migrator');

/** Connects (external PostgreSQL or embedded PGlite) and returns a Database. */
async function connectDatabase(dbConfig) {
  const adapter = await createAdapter(dbConfig);
  return new Database(adapter, { log: dbConfig.log });
}

module.exports = { connectDatabase, Database, sql, migrate, resetSchema };
