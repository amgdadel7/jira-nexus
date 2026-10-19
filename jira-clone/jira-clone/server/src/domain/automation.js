'use strict';

/**
 * Project automation ("When … If … Then …"), modelled on Jira Automation – pure catalogue and rules.
 * Rules run as the "Automation for Masar" bot; changes by the bot never trigger rules (no loops).
 */

/** User id of the "Automation for Masar" bot (seeded by migration 008). */
const BOT_ID = 'automation';

const TRIGGERS = {
  issue_created: { label: 'Work item created' },
  issue_transitioned: { label: 'Work item transitioned', params: ['from', 'to'] },
  issue_assigned: { label: 'Work item assigned' },
  field_changed: { label: 'Field value changed', params: ['field'] },
  comment_added: { label: 'Comment added' },
};

/** Watchable field (as written in rules) → internal field key used in issue_updated events. */
const WATCHABLE_FIELDS = {
  priority: 'priority', summary: 'summary', description: 'description', labels: 'labels', duedate: 'due_date',
  storypoints: 'story_points', sprint: 'sprint', fixversion: 'fix_version', components: 'components', type: 'type',
};

const ACTIONS = {
  assign: { label: 'Assign work item', params: ['to'] },
  transition: { label: 'Transition work item', params: ['status'] },
  set_priority: { label: 'Edit priority', params: ['priority'] },
  add_label: { label: 'Add label', params: ['label'] },
  comment: { label: 'Comment on work item', params: ['body'] },
  add_watcher: { label: 'Add watcher', params: ['userId'] },
  set_story_points: { label: 'Edit story points', params: ['value'] },
};

const RUN_STATUSES = { success: 'Success', some_errors: 'Some errors', failure: 'Failure', no_actions: 'No actions performed', throttled: 'Throttled' };
/** Executions that count against the monthly plan limit (only ones that did something, like Jira). */
const BILLABLE_STATUSES = ['success', 'some_errors', 'failure'];

const ASSIGN_TARGETS = ['unassigned', 'reporter', 'initiator', 'lead', 'balanced'];
const WATCHER_TARGETS = ['reporter', 'initiator', 'assignee'];

const TEMPLATES = [
  { id: 'assign-reporter', name: 'When a work item is created, assign it to the reporter', trigger: { type: 'issue_created' }, condition: 'assignee IS EMPTY', actions: [{ type: 'assign', to: 'reporter' }] },
  { id: 'balanced', name: 'Assign new bugs using balanced workload', trigger: { type: 'issue_created' }, condition: 'type = Bug', actions: [{ type: 'assign', to: 'balanced' }, { type: 'comment', body: 'Assigned to {{issue.assignee.displayName}} automatically.' }] },
  { id: 'done-comment', name: 'When work is done, thank the assignee', trigger: { type: 'issue_transitioned', to: 'Done' }, condition: '', actions: [{ type: 'comment', body: 'Nice work {{issue.assignee.displayName}}! {{issue.key}} is done.' }] },
  { id: 'start-assign', name: 'When work starts, assign it to the person who moved it', trigger: { type: 'issue_transitioned', to: 'In Progress' }, condition: 'assignee IS EMPTY', actions: [{ type: 'assign', to: 'initiator' }] },
  { id: 'highest-watch', name: 'When priority becomes Highest, label it and add the project lead as a watcher', trigger: { type: 'field_changed', field: 'priority' }, condition: 'priority = Highest', actions: [{ type: 'add_label', label: 'urgent' }] },
  { id: 'comment-reopen', name: 'When a comment is added to a done item, reopen it', trigger: { type: 'comment_added' }, condition: 'status = Done', actions: [{ type: 'transition', status: 'To Do' }] },
];

/**
 * Does a trigger fire for an event?
 * event: issue_created | issue_updated | comment_created
 * data.changed: internal field keys; data.before / data.after: issue snapshots with status names.
 */
function triggerMatches(trigger, event, data) {
  switch (trigger.type) {
    case 'issue_created': return event === 'issue_created';
    case 'comment_added': return event === 'comment_created';
    case 'issue_transitioned':
      if (event !== 'issue_updated' || !data.changed.includes('status')) return false;
      return (!trigger.from || trigger.from === data.before.status) && (!trigger.to || trigger.to === data.after?.status);
    case 'issue_assigned': return event === 'issue_updated' && data.changed.includes('assignee_id');
    case 'field_changed': return event === 'issue_updated' && data.changed.includes(WATCHABLE_FIELDS[trigger.field]);
    default: return false;
  }
}

/** Smart values: {{issue.key}}, {{issue.assignee.displayName}}, {{initiator.displayName}}, {{now}} … */
function renderSmartValues(text, { issue, names = {}, initiatorName = '', now = new Date() }) {
  const values = {
    'issue.key': issue.key, 'issue.summary': issue.summary, 'issue.status': issue.status, 'issue.priority': issue.priority,
    'issue.type': issue.type, 'issue.issuetype.name': issue.type, 'issue.status.name': issue.status, 'issue.priority.name': issue.priority,
    'issue.assignee': names.assignee || '', 'issue.assignee.displayName': names.assignee || '',
    'issue.reporter': names.reporter || '', 'issue.reporter.displayName': names.reporter || '',
    'issue.project.key': issue.project_key, 'issue.duedate': issue.due_date || '',
    initiator: initiatorName, 'initiator.displayName': initiatorName,
    now: now.toISOString().slice(0, 10),
  };
  return String(text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (k in values ? values[k] ?? '' : ''));
}

/** Outcome of a run from per-action results. */
function runStatus(results) {
  const failed = results.filter((r) => !r.ok).length;
  if (failed === 0) return 'success';
  return failed === results.length ? 'failure' : 'some_errors';
}

const runMessage = (results) => results.map((r) => `${ACTIONS[r.type].label}: ${r.detail}`).join(' · ');

function monthStart(now = new Date()) {
  const d = new Date(now.getTime());
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

module.exports = {
  BOT_ID, TRIGGERS, WATCHABLE_FIELDS, ACTIONS, RUN_STATUSES, BILLABLE_STATUSES, ASSIGN_TARGETS, WATCHER_TARGETS, TEMPLATES,
  triggerMatches, renderSmartValues, runStatus, runMessage, monthStart,
};
