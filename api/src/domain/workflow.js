'use strict';

/**
 * Workflow rules (pure). A workflow is an ordered list of statuses plus
 * transitions. A transition with from = null is global ("from any status").
 *
 *   workflow = { statuses: [{ id, name, category, position, isInitial }],
 *                transitions: [{ id, name, fromStatusId, toStatusId }] }
 */
const { ValidationError } = require('../shared/errors');

const initialStatus = (wf) => wf.statuses.find((s) => s.isInitial) || wf.statuses[0] || null;

const statusByName = (wf, name) => wf.statuses.find((s) => s.name.toLowerCase() === String(name || '').toLowerCase()) || null;

/** Transitions available from a status (excluding staying in place). */
function availableTransitions(wf, fromStatusId) {
  return wf.transitions
    .filter((t) => (t.fromStatusId === null || t.fromStatusId === fromStatusId) && t.toStatusId !== fromStatusId)
    .filter((t, i, list) => list.findIndex((x) => x.toStatusId === t.toStatusId) === i);
}

const canTransition = (wf, fromStatusId, toStatusId) => fromStatusId === toStatusId
  || availableTransitions(wf, fromStatusId).some((t) => t.toStatusId === toStatusId);

/** Validates a workflow definition coming from the editor. */
function validateDefinition({ name, statuses, transitions }) {
  if (!String(name || '').trim()) throw new ValidationError('Give the workflow a name.');
  if (!Array.isArray(statuses) || !statuses.length) throw new ValidationError('A workflow needs at least one status.');
  const ids = new Set(statuses.map((s) => Number(s.statusId)));
  if (ids.size !== statuses.length) throw new ValidationError('A status can appear only once in a workflow.');
  if (statuses.filter((s) => s.isInitial).length > 1) throw new ValidationError('Only one status can be the initial status.');
  for (const t of transitions || []) {
    if (!ids.has(Number(t.toStatusId))) throw new ValidationError('Transitions must point to a status in the workflow.');
    if (t.fromStatusId !== null && t.fromStatusId !== undefined && !ids.has(Number(t.fromStatusId))) throw new ValidationError('Transitions must start from a status in the workflow.');
  }
}

module.exports = { initialStatus, statusByName, availableTransitions, canTransition, validateDefinition };
