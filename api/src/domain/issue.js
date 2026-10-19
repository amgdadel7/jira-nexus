'use strict';

/** Work item rules and vocabulary (pure). */

const { ValidationError } = require('../shared/errors');

const LINK_TYPES = {
  blocks: { outward: 'blocks', inward: 'is blocked by' },
  relates: { outward: 'relates to', inward: 'relates to' },
  duplicates: { outward: 'duplicates', inward: 'is duplicated by' },
  clones: { outward: 'clones', inward: 'is cloned by' },
};

const GOAL_STATUSES = ['pending', 'on_track', 'at_risk', 'off_track', 'done', 'cancelled'];
const STATUS_CATEGORIES = ['todo', 'in_progress', 'done'];
const STATUS_CATEGORY_LABEL = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const NOTIFY_TYPES = ['assigned', 'status', 'comment', 'mention'];

/** Field key → label used in the history ("changed the due date"). */
const HISTORY_LABEL = {
  original_estimate: 'original estimate', remaining_estimate: 'remaining estimate', time_spent: 'time spent',
  team_id: 'team', fix_version: 'fix version', assignee_id: 'assignee', reporter_id: 'reporter', parent_id: 'parent',
  due_date: 'due date', start_date: 'start date', story_points: 'story points',
};

const MAX_SUMMARY = 255;
const MAX_DESCRIPTION = 32000;
const MAX_ESTIMATE = 10 * 365 * 24 * 3600;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanSummary(value) {
  const s = String(value || '').trim();
  if (!s) throw new ValidationError('Summary is required.');
  if (s.length > MAX_SUMMARY) throw new ValidationError('Summary must be less than 255 characters.');
  return s;
}

const cleanDescription = (value) => String(value ?? '').slice(0, MAX_DESCRIPTION);

/** Labels have no spaces (spaces become underscores), max 60 chars, de-duplicated. */
const cleanLabel = (l) => String(l).trim().replace(/\s+/g, '_').slice(0, 60);
function cleanLabels(value) {
  if (!Array.isArray(value)) throw new ValidationError('Labels must be an array.');
  return [...new Set(value.map(cleanLabel).filter(Boolean))];
}

function cleanDate(value) {
  if (!value) return null;
  if (!DATE_RE.test(value)) throw new ValidationError('Dates must be yyyy-MM-dd.');
  return value;
}

function cleanStoryPoints(value) {
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 1000) throw new ValidationError('Story points must be a number between 0 and 1000.');
  return n;
}

/** Ids of the people mentioned as "@Full Name" or "@First" in a comment body. */
function mentionedUserIds(body, users) {
  const lower = String(body).toLowerCase();
  return users
    .filter((u) => lower.includes(`@${u.name.toLowerCase()}`) || lower.includes(`@${u.name.split(' ')[0].toLowerCase()}`))
    .map((u) => u.id);
}

const isDoneCategory = (category) => category === 'done';

/** Display value for history entries. `lookup` resolves ids to names. */
function historyValue(field, value, { formatDuration, names = {} } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  if (field === 'assignee_id' || field === 'reporter_id' || field === 'parent_id' || field === 'team_id') return names[field] ?? String(value);
  if (field === 'original_estimate' || field === 'remaining_estimate' || field === 'time_spent') return formatDuration(Number(value));
  if (field === 'description') return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  return String(value);
}

/** Order-insensitive equality used to detect changed fields. */
function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || []);
  return String(a ?? '') === String(b ?? '');
}

module.exports = {
  LINK_TYPES, GOAL_STATUSES, STATUS_CATEGORIES, STATUS_CATEGORY_LABEL, NOTIFY_TYPES, HISTORY_LABEL,
  MAX_SUMMARY, MAX_DESCRIPTION, MAX_ESTIMATE, DATE_RE,
  cleanSummary, cleanDescription, cleanLabel, cleanLabels, cleanDate, cleanStoryPoints, mentionedUserIds, isDoneCategory,
  historyValue, sameValue,
};
