'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const { authenticate, requireAuth, requireAdmin, requireSudo } = require('./middleware/auth');
const { broadcaster } = require('./middleware/broadcaster');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');

/** Controllers that guard their own routes (public endpoints live here). */
const PUBLIC_CONTROLLERS = ['auth', 'signup', 'billing'];
/** Controllers mounted behind requireAuth. */
const PROTECTED_CONTROLLERS = ['issues', 'workspace', 'planning', 'projects', 'customFields', 'configuration', 'reports', 'productivity', 'admin', 'organizations'];

function loadController(name) {
  const file = path.join(__dirname, 'controllers', `${name}.controller.js`);
  return fs.existsSync(file) ? require(file) : null;
}

function noStore(req, res, next) {
  // API responses depend on who is asking: never store them (a cached 401 could be replayed after login).
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', 'Authorization, Cookie, X-JC-Auth');
  next();
}

/**
 * Express application: security headers → no-store → JSON body → authenticate →
 * live-update broadcaster → infrastructure routes → controllers → API 404 →
 * static client → error handler.
 */
function createApp(container, { serveClient = true } = {}) {
  const { config, services, live, access } = container;
  const guards = {
    requireAuth: requireAuth(),
    requireAdmin: requireAdmin(),
    requireAuthQuiet: requireAuth({ quiet: true }),
    requireSudo: requireSudo(),
  };
  const ctx = { ...container, services, guards };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.set('etag', false);
  app.use(requestLogger({ isTest: config.isTest }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-JC-Auth, X-Requested-With, Cache-Control, Pragma');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  const api = express.Router();
  api.use(noStore);
  api.use(express.json({ limit: '1mb' }));
  api.use(authenticate({ authService: services.auth, orgRepo: container.orgRepo }));
  api.use(broadcaster({ live, access }));

  api.get('/health', async (req, res) => {
    try {
      await container.db.value('SELECT 1');
      res.status(200).json({ ok: true, status: 'healthy', database: container.db.adapter?.kind || 'postgres', time: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ ok: false, status: 'unhealthy', database: 'disconnected', error: err.message });
    }
  });

  api.get(['/ready', '/readiness'], async (req, res) => {
    try {
      await container.db.value('SELECT 1');
      res.status(200).json({ status: 'ready', database: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'not_ready', database: 'disconnected', error: err.message });
    }
  });
  api.get('/events', guards.requireAuth, (req, res) => live.connect(req, res, req.user));
  // public: <img> tags can't send bearer tokens; file names are unguessable
  api.get('/avatars/:file', (req, res) => {
    const file = services.profile.avatarPath(req.params.file);
    if (!file) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(file);
  });
  if (container.openapi) {
    api.get('/openapi.json', (req, res) => res.json(container.openapi.spec()));
    api.get('/docs', (req, res) => res.type('html').send(container.openapi.docsHtml()));
  }

  for (const name of PUBLIC_CONTROLLERS) loadController(name)?.(api, ctx);
  const secured = express.Router();
  for (const name of PROTECTED_CONTROLLERS) loadController(name)?.(secured, ctx);
  api.use(guards.requireAuth, secured);
  api.use((req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.path}` }));

  app.use('/api', api);

  if (serveClient && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    // index.html must never be cached, otherwise a rebuilt client keeps loading stale bundles
    app.get(/^(?!\/api).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  } else if (serveClient) {
    app.get('/', (req, res) => res.send('Client not built. Run `npm run build` in the project root.'));
  }

  app.use(errorHandler({ logger: container.logger }));
  return app;
}

module.exports = { createApp };
