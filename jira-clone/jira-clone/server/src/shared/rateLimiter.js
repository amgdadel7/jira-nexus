'use strict';

const { RateLimitError } = require('./errors');

/**
 * Tiny in-memory limiter: after `maxFailures` failures a key is blocked for `blockMs`.
 * Good enough for a single process; swap for Redis when running several instances.
 */
class RateLimiter {
  constructor({ maxFailures = 5, blockMs = 60_000, maxKeys = 5000 } = {}) {
    Object.assign(this, { maxFailures, blockMs, maxKeys });
    this.entries = new Map();
  }

  check(key) {
    const entry = this.entries.get(key);
    if (entry && entry.until > Date.now()) {
      const secs = Math.ceil((entry.until - Date.now()) / 1000);
      throw new RateLimitError(`Too many failed attempts. Try again in ${secs} second${secs === 1 ? '' : 's'}.`);
    }
  }

  fail(key) {
    const n = (this.entries.get(key)?.n || 0) + 1;
    this.entries.set(key, { n, until: n >= this.maxFailures ? Date.now() + this.blockMs : 0 });
    if (this.entries.size > this.maxKeys) this.entries.clear();
  }

  reset(key) {
    this.entries.delete(key);
  }
}

/** Sliding window: at most `max` hits per key within `windowMs` (counts every request, not only failures). */
class WindowLimiter {
  constructor({ maxKeys = 5000 } = {}) {
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  hit(key, max, windowMs) {
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) throw new RateLimitError('Too many attempts. Please wait a minute and try again.');
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.hits.clear();
  }
}

module.exports = { RateLimiter, WindowLimiter };
