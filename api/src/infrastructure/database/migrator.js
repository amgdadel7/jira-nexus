'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const FILE_PATTERN = /^(\d{3,})_([a-z0-9_]+)\.sql$/;

function listMigrations(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir)
    .filter((f) => FILE_PATTERN.test(f))
    .sort()
    .map((file) => {
      const [, version, name] = file.match(FILE_PATTERN);
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      return { version, name, file, text, checksum: crypto.createHash('sha256').update(text).digest('hex') };
    });
}

/**
 * Applies pending numbered migrations in order, each inside its own
 * transaction, and records them in schema_migrations. An already-applied
 * migration whose file changed is reported (never silently re-run).
 */
async function migrate(db, { dir = MIGRATIONS_DIR, logger = console } = {}) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      name       text NOT NULL,
      checksum   text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    COMMENT ON TABLE schema_migrations IS 'Numbered SQL migrations that have been applied to this database.';
  `);
  const applied = new Map((await db.many('SELECT version, checksum FROM schema_migrations')).map((r) => [r.version, r.checksum]));
  const done = [];
  for (const m of listMigrations(dir)) {
    if (applied.has(m.version)) {
      if (applied.get(m.version) !== m.checksum) logger.warn(`[migrate] ${m.file} changed after it was applied – create a new migration instead.`);
      continue;
    }
    await db.tx(async () => {
      await db.exec(m.text);
      await db.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
    });
    done.push(m.file);
  }
  if (done.length && logger.info) logger.info(`[migrate] applied ${done.join(', ')}`);
  return done;
}

/** Drops everything (tests and `npm run db:reset`). */
async function resetSchema(db) {
  await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

module.exports = { migrate, resetSchema, listMigrations, MIGRATIONS_DIR };
