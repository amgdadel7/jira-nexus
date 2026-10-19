'use strict';

/**
 * Wraps an async controller action. A returned value is sent as JSON; errors
 * go to the error middleware. Use `created(res, body)` for 201 responses.
 */
const handle = (action) => async (req, res, next) => {
  try {
    const result = await action(req, res);
    if (result !== undefined && !res.headersSent) res.json(result);
  } catch (err) {
    next(err);
  }
};

const created = (res, body) => {
  res.status(201);
  return body;
};

module.exports = { handle, created };
