// تهيئة مِرآة لمراقبة الأخطاء في أول سطر قبل أي شيء
const mirat = require('./mirat-node');
const DEFAULT_MIRAT_DSN = process.env.NODE_ENV === 'production'
  ? 'https://mirat-monitor.onrender.com/api/events/RgL_RlWnFwK3hv8s71BZu_89R2IOUpIO'
  : 'http://localhost:8500/api/events/r4FaLEGhlRCF-gf4acwyZXnulssXHvTc';

mirat.init(process.env.MIRAT_DSN || DEFAULT_MIRAT_DSN, {
  environment: process.env.NODE_ENV || 'development',
  release: '1.0.0'
});

const path = require('path');
const fs = require('fs');
const express = require('express');
const seed = require('./seed');
const { authenticate, requireAuth } = require('./auth');
const events = require('./events');
const openapi = require('./openapi');


function createApp({ serveClient = true } = {}) {
  seed();
  try { require('./trash').purgeExpired(); } catch (e) { console.warn('trash purge failed', e.message); }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true); // correct req.ip / req.secure behind preview proxies and load balancers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.set('etag', false); // no conditional caching of JSON responses
  // API responses depend on who is asking, so they must never be stored by the browser or by a
  // proxy/CDN in front of the preview. Otherwise a cached 401 could be replayed after a successful login.
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Vary', 'Authorization, Cookie, X-JC-Auth');
    next();
  });
  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', authenticate);

  app.use('/api', events.broadcaster);                   // live updates for other open browsers

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.get('/api/test-db', async (req, res) => {
    if (!process.env.DATABASE_URL) return res.status(400).json({ ok: false, error: 'DATABASE_URL is not set' });
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000
    });
    try {
      const r = await pool.query("SELECT current_database(), (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count");
      const users = await pool.query('SELECT count(*) as user_count FROM users').catch(e => ({ rows: [{ user_count: 'table not found: ' + e.message }] }));
      await pool.end();
      res.json({ ok: true, info: r.rows[0], users: users.rows[0] });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
  app.get('/api/openapi.json', (req, res) => res.json(openapi.spec()));
  app.get('/api/docs', (req, res) => { res.type('html').send(openapi.docsHtml()); });
  app.get('/api/events', requireAuth, events.handler);
  app.get('/api/avatars/:file', require('./routes/phase7').serveAvatar); // public: <img> can't send bearer tokens
  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/signup'));          // sign-up, OAuth, /auth/config (public) + admin auth settings
  app.use('/api', require('./routes/billing'));         // /plans is public; /billing/* guard themselves            // /auth/login is public; others guard themselves
  app.use('/api', requireAuth, require('./routes/issues'));
  app.use('/api', requireAuth, require('./routes/workspace'));
  app.use('/api', requireAuth, require('./routes/sprints'));
  app.use('/api', requireAuth, require('./routes/projects'));
  app.use('/api', requireAuth, require('./routes/versions'));
  app.use('/api', requireAuth, require('./routes/reports'));
  app.use('/api', requireAuth, require('./routes/access'));
  app.use('/api', requireAuth, require('./routes/phase7'));  // time tracking, votes, preferences, automation, webhooks, import
  app.use('/api', (req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.path}` }));

  const dist = path.join(__dirname, '..', 'client', 'dist');
  if (serveClient && fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    // index.html must never be cached, otherwise a rebuilt client keeps loading stale bundles
    app.get(/^(?!\/api).*/, (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
  } else if (serveClient) {
    app.get('/', (req, res) => res.send('Client not built. Run `npm run build` in the project root.'));
  }
  // JSON body parse errors etc.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The upload is too large (max 10 MB).' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    console.error(err);
    mirat.captureException(err, { path: req.path, method: req.method, ip: req.ip });
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

module.exports = createApp;
