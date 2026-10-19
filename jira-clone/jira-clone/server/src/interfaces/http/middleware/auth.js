'use strict';

const { Actor } = require('../../../application/Actor');
const { readCredentials } = require('../authTransport');

/** Resolves req.user / req.actor from any of the supported credential transports. */
function authenticate({ authService }) {
  return async (req, res, next) => {
    try {
      const creds = readCredentials(req);
      req.authSeen = creds.seen;
      const result = await authService.authenticate(creds);
      req.user = result.user || null;
      req.sessionToken = result.sessionToken || null;
      req.apiTokenId = result.apiTokenId || null;
      req.authFailure = result.failure || null;
      req.actor = new Actor(req.user, { sessionToken: req.sessionToken, apiTokenId: req.apiTokenId });
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** 401 with a machine-readable reason so the client can tell "expired" from "token never arrived". */
function unauthorized(req, res, { quiet }) {
  const reason = req.authFailure || 'no_credentials';
  if (!quiet) console.warn(`[auth] 401 ${req.method} ${req.originalUrl.split('?')[0]} reason=${reason} seen=${JSON.stringify(req.authSeen || {})}`);
  const error = reason === 'no_credentials' ? 'You are not logged in.' : 'Your session has expired. Please log in again.';
  return res.status(401).json({ error, code: 'unauthenticated', reason, seen: req.authSeen || {} });
}

function requireAuth({ quiet = false } = {}) {
  return (req, res, next) => (req.user ? next() : unauthorized(req, res, { quiet }));
}

function requireAdmin({ quiet = false } = {}) {
  return (req, res, next) => {
    if (!req.user) return unauthorized(req, res, { quiet });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only administrators can do that.' });
    return next();
  };
}

module.exports = { authenticate, requireAuth, requireAdmin };
