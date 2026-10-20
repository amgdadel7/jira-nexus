'use strict';

const { loadConfig } = require('./config');
const { connectDatabase, migrate } = require('./infrastructure/database');
const { createContainer } = require('./container');
const { createApp } = require('./interfaces/http/app');
const { seedDemo } = require('./infrastructure/database/seeds/demoSeed');

const { sql } = require('./infrastructure/database/sql');
const { hashPassword } = require('./shared/crypto');

/** First boot on an empty database loads the demo data (set SEED_ON_BOOT=false to skip). */
const seedIfEmpty = (container) => seedDemo(container, { force: false });

async function ensureAdminAccount(container) {
  try {
    const { db, userRepo } = container;
    const adminEmail = 'amgdadel7@gmail.com';
    let user = await userRepo.findByEmail(adminEmail);
    const passHash = hashPassword('777080877');
    if (!user) {
      await db.query(sql`
        INSERT INTO users (id, name, email, color, role, title, password_hash, signup_source, email_verified, active, created_at)
        VALUES ('u0', 'Amjad Alhakimi', ${adminEmail}, '#0C66E4', 'admin', 'Site Administrator', ${passHash}, 'system', true, true, now())
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'admin', active = true
      `);
      user = await userRepo.findByEmail(adminEmail);
    }
    if (user) {
      await db.query(sql`
        INSERT INTO organization_members (org_id, user_id, role)
        VALUES ('default-org', ${user.id}, 'owner')
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner'
      `).catch(() => {});
      await db.query(sql`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ('default-ws', ${user.id}, 'admin')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin'
      `).catch(() => {});
      for (const p of ['KAN', 'PAY', 'FIN']) {
        await db.query(sql`
          INSERT INTO project_members (project_key, user_id, role, added_by, added_at)
          VALUES (${p}, ${user.id}, 'admin', 'u1', now())
          ON CONFLICT (project_key, user_id) DO UPDATE SET role = 'admin'
        `).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('ensureAdminAccount warning:', err.message);
  }
}

/** Boots the API: config → database → migrations → (seed) → container → HTTP server. */
async function bootstrap({ env = process.env, seed = env.SEED_ON_BOOT === 'false' ? null : seedIfEmpty, listen = true, serveClient = true } = {}) {
  const config = loadConfig(env);
  const db = await connectDatabase(config.database);
  await migrate(db, { logger: config.isTest ? { info() {}, warn: console.warn } : console });
  const container = createContainer({ db, config });
  if (seed) await seed(container);
  if (!config.isTest) await ensureAdminAccount(container);
  await container.trash.purgeExpired?.().catch((err) => console.warn('trash purge failed', err.message));
  if (typeof global.gc === 'function') global.gc();
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
