'use strict';

const { Actor } = require('../../../application/Actor');
const { readCredentials } = require('../authTransport');

/** Resolves req.user / req.actor from any of the supported credential transports with verified tenant scoping. */
function authenticate({ authService, orgRepo }) {
  return async (req, res, next) => {
    try {
      const creds = readCredentials(req);
      req.authSeen = creds.seen;
      const result = await authService.authenticate(creds);
      req.user = result.user || null;
      req.sessionToken = result.sessionToken || null;
      req.apiTokenId = result.apiTokenId || null;
      req.authFailure = result.failure || null;

      let activeOrg = { id: 'default-org', member_role: req.user?.role === 'admin' ? 'owner' : 'member' };
      let userOrgs = [];
      if (orgRepo && req.user) {
        try {
          userOrgs = await orgRepo.listByUserId(req.user.id);
          const requestedOrg = req.headers['x-organization-id'] || req.query.org;
          if (requestedOrg) {
            const matched = userOrgs.find((o) => o.id === requestedOrg || o.slug === requestedOrg);
            if (matched) {
              activeOrg = matched;
            } else if (userOrgs.length > 0) {
              // Never trust unverified client header: fallback to verified primary membership
              activeOrg = userOrgs[0];
            }
          } else if (userOrgs.length > 0) {
            activeOrg = userOrgs[0];
          }
        } catch {
          // safe fallback during test setup or before migrations
        }
      }

      req.actor = new Actor(req.user, {
        sessionToken: req.sessionToken,
        apiTokenId: req.apiTokenId,
        organizationId: activeOrg.id,
        orgRole: activeOrg.member_role,
        organizations: userOrgs,
      });
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
