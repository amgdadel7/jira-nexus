// Project automation ("When … If … Then …" rules), modelled on Jira Automation.
//
// A rule has one trigger, an optional JQL condition, and a list of actions. Rules run synchronously
// when the trigger event is emitted (see hooks.js), as the "Automation for Masar" bot user, so their
// changes show up in history like Jira's "Automation for Jira". Changes made by the bot never trigger
// other rules (prevents loops). Every execution is recorded in automation_runs (the rule's audit log).
const db = require('./db');
const hooks = require('./hooks');
const { compile, STATUS_ORDER, PRIORITY_ORDER } = require('./jql');

const BOT = db.BOT_ID;

const TRIGGERS = {
  issue_created: { label: 'Work item created' },
  issue_transitioned: { label: 'Work item transitioned', params: ['from', 'to'] },
  issue_assigned: { label: 'Work item assigned' },
  field_changed: { label: 'Field value changed', params: ['field'] },
  comment_added: { label: 'Comment added' },
};
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
const STATUSES = { success: 'Success', some_errors: 'Some errors', failure: 'Failure', no_actions: 'No actions performed', throttled: 'Throttled' };

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

/** Validates a rule body from the API. Returns columns to store. */
function validate(body, projectKey, partial = false) {
  const out = {};
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim();
    if (!name) throw bad('Give the rule a name.');
    if (name.length > 255) throw bad('Rule names must be less than 255 characters.');
    out.name = name;
  }
  if ('description' in body) out.description = String(body.description || '').slice(0, 2000);
  if ('enabled' in body) out.enabled = body.enabled ? 1 : 0;
  if (!partial || 'trigger' in body) {
    const t = body.trigger || {};
    if (!TRIGGERS[t.type]) throw bad('Choose a trigger for the rule.');
    const trig = { type: t.type };
    if (t.type === 'issue_transitioned') {
      for (const k of ['from', 'to']) if (t[k]) { if (!STATUS_ORDER.includes(t[k])) throw bad(`Unknown status '${t[k]}'.`); trig[k] = t[k]; }
    }
    if (t.type === 'field_changed') {
      const f = String(t.field || '').toLowerCase().replace(/\s+/g, '');
      if (!WATCHABLE_FIELDS[f]) throw bad('Choose which field to watch.');
      trig.field = f;
    }
    out.trigger = JSON.stringify(trig);
  }
  if ('condition' in body) {
    const cond = String(body.condition || '').trim();
    if (cond) {
      if (/\border\s+by\b/i.test(cond)) throw bad('Conditions cannot contain ORDER BY.');
      try { compile(cond, { currentUserId: 'u1' }); } catch (e) { throw bad(`Condition: ${e.message}`); }
    }
    out.condition = cond;
  }
  if (!partial || 'actions' in body) {
    const list = Array.isArray(body.actions) ? body.actions : [];
    if (!list.length) throw bad('Add at least one action.');
    if (list.length > 10) throw bad('A rule can have at most 10 actions.');
    const clean = list.map((a, i) => {
      if (!a || !ACTIONS[a.type]) throw bad(`Action ${i + 1}: unknown action.`);
      const c = { type: a.type };
      switch (a.type) {
        case 'assign': {
          const to = String(a.to || '');
          if (!['unassigned', 'reporter', 'initiator', 'lead', 'balanced'].includes(to) && !db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(to)) throw bad(`Action ${i + 1}: choose who to assign.`);
          c.to = to; break;
        }
        case 'transition': if (!STATUS_ORDER.includes(a.status)) throw bad(`Action ${i + 1}: choose a status.`); c.status = a.status; break;
        case 'set_priority': if (!PRIORITY_ORDER.includes(a.priority)) throw bad(`Action ${i + 1}: choose a priority.`); c.priority = a.priority; break;
        case 'add_label': {
          const l = String(a.label || '').trim().replace(/\s+/g, '_').slice(0, 60);
          if (!l) throw bad(`Action ${i + 1}: enter a label.`); c.label = l; break;
        }
        case 'comment': {
          const b = String(a.body || '').trim();
          if (!b) throw bad(`Action ${i + 1}: enter the comment.`); c.body = b.slice(0, 32000); break;
        }
        case 'add_watcher': {
          const u = String(a.userId || '');
          if (!['reporter', 'initiator', 'assignee'].includes(u) && !db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(u)) throw bad(`Action ${i + 1}: choose a watcher.`);
          c.userId = u; break;
        }
        case 'set_story_points': {
          const n = a.value === '' || a.value === null || a.value === undefined ? null : Number(a.value);
          if (n !== null && (Number.isNaN(n) || n < 0 || n > 1000)) throw bad(`Action ${i + 1}: story points must be between 0 and 1000.`);
          c.value = n; break;
        }
        default: break;
      }
      return c;
    });
    out.actions = JSON.stringify(clean);
  }
  return out;
}

function ruleOut(r) {
  if (!r) return null;
  const stats = db.prepare(`SELECT COUNT(*) total, MAX(created_at) last,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) ok,
      SUM(CASE WHEN status IN ('failure','some_errors') THEN 1 ELSE 0 END) failed
    FROM automation_runs WHERE rule_id = ?`).get(r.id);
  const lastRun = db.prepare('SELECT status FROM automation_runs WHERE rule_id = ? ORDER BY id DESC LIMIT 1').get(r.id);
  return {
    id: r.id, project: r.project_key, name: r.name, description: r.description, enabled: !!r.enabled,
    trigger: JSON.parse(r.trigger), condition: r.condition, actions: JSON.parse(r.actions),
    createdBy: r.created_by, created: r.created_at, updated: r.updated_at,
    runs: stats.total, succeeded: stats.ok || 0, failed: stats.failed || 0, lastRun: stats.last, lastStatus: lastRun?.status || null,
  };
}

// ---------- monthly usage (only executions that did something count, like Jira) ----------
function monthStart() { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); }
function usage() {
  const B = require('./billing');
  const plan = B.PLANS[B.getSubscription().plan] || B.PLANS.free;
  const used = db.prepare("SELECT COUNT(*) c FROM automation_runs WHERE created_at >= ? AND status IN ('success','some_errors','failure')").get(monthStart()).c;
  const reset = new Date(monthStart()); reset.setUTCMonth(reset.getUTCMonth() + 1);
  return { used, limit: plan.automationRuns ?? null, plan: plan.key, resetsAt: reset.toISOString() };
}

// ---------- smart values: {{issue.key}}, {{issue.summary}}, {{initiator.displayName}} … ----------
function smart(text, row, initiatorId) {
  const name = (id) => (id ? db.prepare('SELECT name FROM users WHERE id = ?').get(id)?.name || '' : '');
  const vals = {
    'issue.key': row.key, 'issue.summary': row.summary, 'issue.status': row.status, 'issue.priority': row.priority,
    'issue.type': row.type, 'issue.issuetype.name': row.type, 'issue.status.name': row.status, 'issue.priority.name': row.priority,
    'issue.assignee': name(row.assignee_id), 'issue.assignee.displayName': name(row.assignee_id),
    'issue.reporter': name(row.reporter_id), 'issue.reporter.displayName': name(row.reporter_id),
    'issue.project.key': row.project_key, 'issue.duedate': row.due_date || '',
    'initiator': name(initiatorId), 'initiator.displayName': name(initiatorId),
    'now': new Date().toISOString().slice(0, 10),
  };
  return String(text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (k in vals ? vals[k] : ''));
}

function balancedAssignee(projectKey) {
  // the member/admin of the project with the fewest open work items (Jira's "balanced workload")
  const people = db.prepare(`SELECT u.id, (SELECT COUNT(*) FROM issues i WHERE i.assignee_id = u.id AND i.status != 'Done' AND i.project_key = @p) AS open
    FROM users u WHERE u.active = 1 AND u.bot = 0 AND (u.id IN (SELECT user_id FROM project_members WHERE project_key = @p AND role IN ('admin','member'))
      OR u.id = (SELECT lead_id FROM projects WHERE key = @p))
    ORDER BY open ASC, u.name ASC`).all({ p: projectKey });
  return people[0]?.id || null;
}

function performAction(a, key, initiatorId) {
  const L = require('./lib');
  const row = L.getRawIssue(key);
  if (!row) throw new Error('The work item no longer exists.');
  const apply = (body) => {
    const f = L.normalizeFields(body, row);
    const changed = L.applyUpdate(row, f, BOT);
    return changed.length ? 'changed' : 'unchanged';
  };
  switch (a.type) {
    case 'assign': {
      let to = a.to;
      if (to === 'unassigned') to = null;
      else if (to === 'reporter') to = row.reporter_id;
      else if (to === 'initiator') to = initiatorId === BOT ? null : initiatorId;
      else if (to === 'lead') to = db.prepare('SELECT lead_id FROM projects WHERE key = ?').get(row.project_key)?.lead_id || null;
      else if (to === 'balanced') to = balancedAssignee(row.project_key);
      if (to && !db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1').get(to)) throw new Error('That person is no longer active.');
      const r = apply({ assigneeId: to });
      return `${r === 'changed' ? 'Assigned to' : 'Already assigned to'} ${to ? db.prepare('SELECT name FROM users WHERE id = ?').get(to).name : 'nobody'}`;
    }
    case 'transition': return apply({ status: a.status }) === 'changed' ? `Transitioned to ${a.status}` : `Already in ${a.status}`;
    case 'set_priority': return apply({ priority: a.priority }) === 'changed' ? `Priority set to ${a.priority}` : `Priority already ${a.priority}`;
    case 'set_story_points': return apply({ storyPoints: a.value }) === 'changed' ? `Story points set to ${a.value ?? 'none'}` : 'Story points unchanged';
    case 'add_label': {
      const labels = JSON.parse(row.labels || '[]');
      if (labels.includes(a.label)) return `Label ${a.label} already present`;
      apply({ labels: [...labels, a.label] });
      return `Added label ${a.label}`;
    }
    case 'add_watcher': {
      const uid = a.userId === 'reporter' ? row.reporter_id : a.userId === 'assignee' ? row.assignee_id : a.userId === 'initiator' ? initiatorId : a.userId;
      if (!uid || uid === BOT) return 'Nobody to add';
      L.watch(row.id, uid);
      return `Added ${db.prepare('SELECT name FROM users WHERE id = ?').get(uid)?.name || uid} as a watcher`;
    }
    case 'comment': {
      const body = smart(a.body, L.getRawIssue(key), initiatorId);
      const t = L.now();
      const info = db.prepare('INSERT INTO comments (issue_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?)').run(row.id, BOT, body, t, t);
      db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').run(t, row.id);
      L.notify({ issue: row, actorId: BOT, type: 'comment', message: `commented on ${row.key}: “${body.length > 80 ? `${body.slice(0, 80)}…` : body}”` });
      hooks.emit('comment_created', { key: row.key, commentId: info.lastInsertRowid, body, actorId: BOT });
      return 'Comment added';
    }
    default: throw new Error('Unknown action.');
  }
}

function conditionMatches(rule, key, initiatorId) {
  if (!rule.condition) return true;
  const c = compile(rule.condition, { currentUserId: initiatorId });
  return !!db.prepare(`SELECT 1 FROM issues i WHERE i.key = ? AND (${c.where})`).get(key, ...c.params);
}

/** Executes one rule for one work item and records the run. Never throws. */
function execute(rule, key, initiatorId) {
  const t0 = Date.now();
  const record = (status, message, results = []) => {
    db.prepare('INSERT INTO automation_runs (rule_id,issue_key,status,message,actions,duration_ms,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(rule.id, key, status, message, JSON.stringify(results), Date.now() - t0, new Date().toISOString());
    return { status, message, results };
  };
  try {
    if (!conditionMatches(rule, key, initiatorId)) return record('no_actions', 'The work item didn’t match the rule’s condition.');
  } catch (e) { return record('failure', `Condition error: ${e.message}`); }
  const u = usage();
  if (u.limit !== null && u.used >= u.limit) return record('throttled', `Monthly limit of ${u.limit} rule runs reached on the ${u.plan} plan.`);
  const results = [];
  for (const a of JSON.parse(rule.actions)) {
    try {
      const detail = db.transaction(() => performAction(a, key, initiatorId))();
      results.push({ type: a.type, ok: true, detail });
    } catch (e) {
      results.push({ type: a.type, ok: false, detail: e.message });
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  const status = failed === 0 ? 'success' : failed === results.length ? 'failure' : 'some_errors';
  return record(status, results.map((r) => `${ACTIONS[r.type].label}: ${r.detail}`).join(' · '), results);
}

function triggerMatches(trig, event, data) {
  switch (trig.type) {
    case 'issue_created': return event === 'issue_created';
    case 'comment_added': return event === 'comment_created';
    case 'issue_transitioned':
      if (event !== 'issue_updated' || !data.changed.includes('status')) return false;
      { const after = db.prepare('SELECT status FROM issues WHERE key = ?').get(data.key)?.status;
        return (!trig.from || trig.from === data.before.status) && (!trig.to || trig.to === after); }
    case 'issue_assigned': return event === 'issue_updated' && data.changed.includes('assignee_id');
    case 'field_changed': return event === 'issue_updated' && data.changed.includes(WATCHABLE_FIELDS[trig.field]);
    default: return false;
  }
}

hooks.on((event, data) => {
  if (!['issue_created', 'issue_updated', 'comment_created'].includes(event)) return;
  if (data.actorId === BOT) return; // automation never triggers automation
  const row = db.prepare('SELECT project_key FROM issues WHERE key = ?').get(data.key);
  if (!row) return;
  const rules = db.prepare('SELECT * FROM automation_rules WHERE project_key = ? AND enabled = 1 ORDER BY id').all(row.project_key);
  for (const rule of rules) {
    let trig; try { trig = JSON.parse(rule.trigger); } catch { continue; }
    if (triggerMatches(trig, event, data)) execute(rule, data.key, data.actorId);
  }
});

const TEMPLATES = [
  { id: 'assign-reporter', name: 'When a work item is created, assign it to the reporter', trigger: { type: 'issue_created' }, condition: 'assignee IS EMPTY', actions: [{ type: 'assign', to: 'reporter' }] },
  { id: 'balanced', name: 'Assign new bugs using balanced workload', trigger: { type: 'issue_created' }, condition: 'type = Bug', actions: [{ type: 'assign', to: 'balanced' }, { type: 'comment', body: 'Assigned to {{issue.assignee.displayName}} automatically.' }] },
  { id: 'done-comment', name: 'When work is done, thank the assignee', trigger: { type: 'issue_transitioned', to: 'Done' }, condition: '', actions: [{ type: 'comment', body: 'Nice work {{issue.assignee.displayName}}! {{issue.key}} is done.' }] },
  { id: 'start-assign', name: 'When work starts, assign it to the person who moved it', trigger: { type: 'issue_transitioned', to: 'In Progress' }, condition: 'assignee IS EMPTY', actions: [{ type: 'assign', to: 'initiator' }] },
  { id: 'highest-watch', name: 'When priority becomes Highest, label it and add the project lead as a watcher', trigger: { type: 'field_changed', field: 'priority' }, condition: 'priority = Highest', actions: [{ type: 'add_label', label: 'urgent' }] },
  { id: 'comment-reopen', name: 'When a comment is added to a done item, reopen it', trigger: { type: 'comment_added' }, condition: 'status = Done', actions: [{ type: 'transition', status: 'To Do' }] },
];

module.exports = { TRIGGERS, ACTIONS, STATUSES, WATCHABLE_FIELDS, TEMPLATES, validate, ruleOut, usage, execute, smart };
