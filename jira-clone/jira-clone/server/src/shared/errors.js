'use strict';

/**
 * Application errors. Every error that should reach the client carries an HTTP
 * status and a user-facing message; anything else is treated as a 500.
 * `extra` is merged into the JSON body ({ error, ...extra }).
 */
class AppError extends Error {
  constructor(message, status = 400, extra = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    if (extra) this.extra = extra;
  }
}

class ValidationError extends AppError {
  constructor(message, extra) { super(message, 400, extra); }
}

class UnauthorizedError extends AppError {
  constructor(message = 'You need to log in.', extra) { super(message, 401, extra); }
}

class ForbiddenError extends AppError {
  constructor(message = 'You don’t have permission to do that.', extra) { super(message, 403, extra); }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found.', extra) { super(message, 404, extra); }
}

class ConflictError extends AppError {
  constructor(message = 'That already exists.', extra) { super(message, 409, extra); }
}

/** Subscription limit reached (HTTP 402, body carries code: 'plan_limit'). */
class PlanLimitError extends AppError {
  constructor(message, extra = {}) { super(message, 402, { code: 'plan_limit', ...extra }); }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many attempts. Try again later.', extra) { super(message, 429, extra); }
}

/** Short factories keep services readable: `throw bad('Summary is required.')`. */
const bad = (message, extra) => new ValidationError(message, extra);
const notFound = (message, extra) => new NotFoundError(message, extra);
const forbidden = (message, extra) => new ForbiddenError(message, extra);
const conflict = (message, extra) => new ConflictError(message, extra);
const unauthorized = (message, extra) => new UnauthorizedError(message, extra);

/** Maps PostgreSQL constraint violations to client errors. */
function fromDatabaseError(err) {
  switch (err && err.code) {
    case '23505': return new ConflictError('That already exists.');
    case '23503': return new ValidationError('A referenced record does not exist.');
    case '23514': return new ValidationError('A value is out of the allowed range.');
    case '22P02': return new ValidationError('A value has the wrong format.');
    case '22001': return new ValidationError('A value is too long.');
    default: return null;
  }
}

module.exports = {
  AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, PlanLimitError,
  RateLimitError, bad, notFound, forbidden, conflict, unauthorized, fromDatabaseError,
};
