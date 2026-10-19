'use strict';

/**
 * Who is performing a use case. Built once per request by the HTTP layer
 * (or for the automation bot / background jobs) and passed to services.
 * Holds a small per-request cache so permission checks for long lists stay cheap.
 */
class Actor {
  constructor(user, { sessionToken = null, apiTokenId = null } = {}) {
    this.user = user || null;
    this.sessionToken = sessionToken;
    this.apiTokenId = apiTokenId;
    this.cache = new Map();
  }

  get id() {
    return this.user ? this.user.id : null;
  }

  get isSiteAdmin() {
    return this.user?.role === 'admin';
  }

  get viaApiToken() {
    return Boolean(this.apiTokenId);
  }
}

module.exports = { Actor };
