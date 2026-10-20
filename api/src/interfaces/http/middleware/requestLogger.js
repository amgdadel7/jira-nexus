'use strict';

const crypto = require('crypto');

/**
 * Structured request logging and Request-ID propagation.
 * Ensures no sensitive fields (passwords, tokens, cookies) are ever logged.
 */
function requestLogger({ logger = console, isTest = false } = {}) {
  return (req, res, next) => {
    const rawId = req.headers['x-request-id'];
    const requestId = (typeof rawId === 'string' && rawId.trim())
      ? rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : crypto.randomUUID();

    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();

    res.on('finish', () => {
      // Skip noisy logs during test suite runs unless explicitly enabled
      if (isTest && !process.env.VERBOSE_LOGS) return;

      const durationMs = Date.now() - start;
      const logEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.originalUrl?.split('?')[0] || req.path,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']?.slice(0, 100) || undefined,
      };

      if (res.statusCode >= 500) {
        logger.error('[http]', JSON.stringify(logEntry));
      } else if (res.statusCode >= 400) {
        logger.warn('[http]', JSON.stringify(logEntry));
      } else {
        logger.log('[http]', JSON.stringify(logEntry));
      }
    });

    next();
  };
}

module.exports = { requestLogger };
