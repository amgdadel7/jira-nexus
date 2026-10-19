#!/usr/bin/env node
'use strict';

/**
 * Database command line:
 *   node src/cli/db.js migrate          apply pending migrations
 *   node src/cli/db.js status           list applied / pending migrations
 *   node src/cli/db.js seed [--force]   load the demo data (--force replaces existing data)
 *   node src/cli/db.js reset            drop everything, migrate, seed
 * Uses DATABASE_URL (PostgreSQL) or, when unset, the embedded PGlite database in data/pgdata.
 */
const { loadConfig } = require('../config');
const { connectDatabase, migrate, resetSchema, sql } = require('../infrastructure/database');
const { listMigrations } = require('../infrastructure/database/migrator');
const { createContainer } = require('../container');
const { seedDemo } = require('../infrastructure/database/seeds/demoSeed');

async function seed(db, config, force) {
  const container = createContainer({ db, config });
  const done = await seedDemo(container, { force });
  console.log(done === false ? 'The database already has data (use --force to replace it).' : 'Demo data loaded.');
}

const COMMANDS = {
  async migrate(db) {
    await migrate(db);
  },
  async status(db) {
    const applied = new Set(await db.value(sql`SELECT to_regclass('public.schema_migrations') IS NOT NULL`)
      ? (await db.many(sql`SELECT version FROM schema_migrations`)).map((r) => String(r.version))
      : []);
    for (const m of listMigrations()) console.log(`${applied.has(String(m.version)) ? '✔ applied' : '· pending'}  ${m.file}`);
  },
  async seed(db, config, args) {
    await migrate(db);
    await seed(db, config, args.includes('--force'));
  },
  async reset(db, config) {
    await resetSchema(db);
    await migrate(db);
    await seed(db, config, true);
  },
};

async function main([command = 'status', ...args]) {
  const run = COMMANDS[command];
  if (!run) {
    console.error(`Unknown command “${command}”. Use one of: ${Object.keys(COMMANDS).join(', ')}.`);
    process.exit(2);
  }
  const config = loadConfig();
  const db = await connectDatabase(config.database);
  try {
    await run(db, config, args);
  } finally {
    await db.close();
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
