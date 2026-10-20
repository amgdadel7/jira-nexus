'use strict';

const { loadConfig } = require('./config');
const { connectDatabase, migrate } = require('./infrastructure/database');
const { createContainer } = require('./container');
const { createApp } = require('./interfaces/http/app');
const { seedDemo } = require('./infrastructure/database/seeds/demoSeed');

/** First boot on an empty database loads the demo data (set SEED_ON_BOOT=false to skip). */
const seedIfEmpty = (container) => seedDemo(container, { force: false });

/** Boots the API: config → database → migrations → (seed) → container → HTTP server. */
async function bootstrap({ env = process.env, seed = env.SEED_ON_BOOT === 'false' ? null : seedIfEmpty, listen = true, serveClient = true } = {}) {
  const config = loadConfig(env);
  const db = await connectDatabase(config.database);
  await migrate(db, { logger: config.isTest ? { info() {}, warn: console.warn } : console });
  const container = createContainer({ db, config });
  if (seed) await seed(container);
  await container.trash.purgeExpired?.().catch((err) => console.warn('trash purge failed', err.message));
  const app = createApp(container, { serveClient });
  if (!listen) return { app, container };
  const server = await new Promise((resolve) => {
    const s = app.listen(config.port, config.host, () => resolve(s));
  });
  console.log(`Masar running on http://${config.host}:${config.port} (${db.adapter?.kind || 'postgres'})`);
  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Initiating graceful shutdown...`);
    try {
      container.live.closeAll();
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      await db.close();
      console.log('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return { app, container, server };
}

module.exports = { bootstrap };

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
