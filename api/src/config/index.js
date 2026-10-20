'use strict';

const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Reads configuration from the environment once. Everything else receives the
 * resulting plain object, so no module has to touch process.env directly.
 *
 *   DATABASE_URL      postgres://user:pass@host:5432/db  → external PostgreSQL (recommended)
 *   PGLITE_DIR        data directory of the embedded PostgreSQL used when DATABASE_URL is unset
 *                     ("memory://" for a throw-away in-memory database)
 *   UPLOAD_DIR        attachment + avatar storage
 *   PORT, HOST        HTTP listener
 *   PUBLIC_URL        external base URL (OAuth redirect URIs, webhook links)
 *   SHOW_RESET_LINKS  return reset links / sign-up codes in API responses (defaults to true outside production)
 *   DEMO_PASSWORD     password for the seeded demo users
 */
function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const dataDir = env.DATA_DIR || path.join(SERVER_ROOT, 'data');
  const flag = (value, fallback) => (value === undefined || value === '' ? fallback : value === 'true' || value === '1');
  return Object.freeze({
    env: nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
    database: Object.freeze({
      url: env.DATABASE_URL || '',
      pgliteDir: env.PGLITE_DIR || path.join(dataDir, 'pgdata'),
      poolSize: Number(env.PG_POOL_SIZE) || 10,
      log: flag(env.DB_LOG, false),
    }),
    uploadDir: env.UPLOAD_DIR || path.join(dataDir, 'uploads'),
    showDevSecrets: flag(env.SHOW_RESET_LINKS, nodeEnv !== 'production'),
    allowOAuthEndpointOverrides: nodeEnv !== 'production',
    /** Social-login credentials from the environment (Settings → Authentication overrides them). */
    oauthEnv: Object.freeze({
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      microsoft: { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET, tenant: env.MICROSOFT_TENANT },
      slack: { clientId: env.SLACK_CLIENT_ID, clientSecret: env.SLACK_CLIENT_SECRET },
      apple: { clientId: env.APPLE_CLIENT_ID, teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_KEY_ID, privateKey: env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') },
    }),
    demoPassword: env.DEMO_PASSWORD || 'password',
    webhookRetryDelays: nodeEnv === 'test' ? [50, 100] : [2000, 8000],
    clientDist: (() => {
      const fs = require('fs');
      const webDist = path.join(SERVER_ROOT, '..', 'web', 'dist');
      const clientDist = path.join(SERVER_ROOT, '..', 'client', 'dist');
      return fs.existsSync(webDist) ? webDist : clientDist;
    })(),
  });
}

module.exports = { loadConfig, SERVER_ROOT };
