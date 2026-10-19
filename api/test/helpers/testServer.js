'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootstrap } = require('../../src/main');
const { sql } = require('../../src/infrastructure/database');
const { seedDemo } = require('../../src/infrastructure/database/seeds/demoSeed');

/**
 * Boots the real API on a random port with freshly seeded demo data.
 * Uses TEST_DATABASE_URL (PostgreSQL) when set, otherwise an in-memory PGlite database,
 * so `npm test` works with or without a PostgreSQL server.
 */
async function startTestServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'masar-test-'));
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL || '',
    PGLITE_DIR: 'memory://',
    UPLOAD_DIR: path.join(tmp, 'uploads'),
    PUBLIC_URL: '',
  };
  const silent = { info() {}, warn: console.warn, error: console.error };
  const { app, container } = await bootstrap({ env, listen: false, serveClient: false, seed: (c) => seedDemo(c, { force: true, logger: silent }) });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return {
    base,
    container,
    db: container.db,
    sql,
    /** Re-seed while the server keeps running (logins and API tokens survive). */
    reseed: () => seedDemo(container, { force: true, logger: silent }),
    async close() {
      container.live.closeAll();
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      await container.db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

module.exports = { startTestServer };
