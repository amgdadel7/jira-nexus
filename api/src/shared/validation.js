'use strict';

const { ValidationError } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

const isEmail = (value) => EMAIL_RE.test(String(value || ''));
const isHexColor = (value) => HEX_COLOR_RE.test(String(value || ''));

/** Trimmed non-empty string or a ValidationError with `message`. */
function requiredText(value, message, max = 255) {
  const s = String(value ?? '').trim();
  if (!s) throw new ValidationError(message);
  return s.slice(0, max);
}

const optionalText = (value, max = 2000) => String(value ?? '').slice(0, max);

/** Positive integer id from a route parameter (or a ValidationError). */
function toId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new ValidationError(`Invalid ${label}.`);
  return n;
}

/** Integer query parameter clamped to [min, max]. */
function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  return Math.min(max, Math.max(min, Number.isNaN(n) ? fallback : n));
}

const has = (obj, key) => obj !== null && obj !== undefined && Object.prototype.hasOwnProperty.call(obj, key);

module.exports = { EMAIL_RE, isEmail, isHexColor, requiredText, optionalText, toId, clampInt, has };
