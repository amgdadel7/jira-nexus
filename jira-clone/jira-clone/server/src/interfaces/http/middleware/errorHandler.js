'use strict';

const { fromDatabaseError } = require('../../../shared/errors');

/** Translates thrown errors into `{ error, ...extra }` JSON responses. */
function errorHandler({ logger = console } = {}) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The upload is too large (max 10 MB).' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    const mapped = fromDatabaseError(err);
    if (mapped) return res.status(mapped.status).json({ error: mapped.message });
    logger.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  };
}

module.exports = { errorHandler };
