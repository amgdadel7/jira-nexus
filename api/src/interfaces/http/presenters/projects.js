'use strict';

const today = () => new Date().toISOString().slice(0, 10);

const projectBase = (p) => ({
  key: p.key, name: p.name, type: p.type, description: p.description, leadId: p.lead_id, color: p.color,
  category: p.category, created: p.created_at, access: p.access, workflowId: p.workflow_id,
});

const project = (v) => ({
  ...projectBase(v.project), myRole: v.myRole, members: v.members, starred: v.starred,
  stats: { total: v.stats.total, done: v.stats.done, open: v.stats.open, lastActivity: v.stats.last },
});

const sprint = ({ sprint: s, stats }) => ({
  id: s.id, name: s.name, goal: s.goal, state: s.state, startDate: s.start_date, endDate: s.end_date,
  completedAt: s.completed_at, position: s.position, created: s.created_at, projectKey: s.project_key,
  committed: s.committed_points === null ? null : { points: s.committed_points, count: s.committed_count },
  completed: s.completed_points === null ? null : { points: s.completed_points, count: s.completed_count },
  stats: { total: stats.total, done: stats.done, inProgress: stats.in_progress, todo: stats.total - stats.done - stats.in_progress, points: stats.points, donePoints: stats.done_points },
});

const version = ({ version: v, stats }) => ({
  id: v.id, projectKey: v.project_key, name: v.name, description: v.description, status: v.status,
  startDate: v.start_date, releaseDate: v.release_date, releasedAt: v.released_at, position: v.position, created: v.created_at,
  overdue: v.status === 'unreleased' && Boolean(v.release_date) && v.release_date < today(),
  stats: { total: stats.total, done: stats.done, inProgress: stats.in_progress, todo: stats.total - stats.done - stats.in_progress, points: stats.points },
});

const component = ({ component: c, stats }) => ({
  id: c.id, projectKey: c.project_key, name: c.name, description: c.description, leadId: c.lead_id,
  defaultAssignee: c.default_assignee, created: c.created_at, issueCount: stats.total, openCount: stats.open,
});

const team = ({ team: t, members, stats, canEdit }, full = false) => ({
  id: t.id, name: t.name, description: t.description, color: t.color, createdBy: t.created_by, created: t.created_at,
  members, issueCount: stats.total, openCount: stats.open, ...(full ? { memberCount: members.length } : {}), canEdit,
});

function trashEntry(e, retentionDays) {
  const snap = e.snapshot || {};
  return {
    id: e.id, projectKey: e.project_key, key: e.issue_key, summary: e.summary, type: e.type, deletedBy: e.deleted_by, deleted: e.deleted_at,
    purgeOn: new Date(new Date(e.deleted_at).getTime() + retentionDays * 864e5).toISOString(),
    subtasks: (snap.issues || []).length - 1, comments: (snap.comments || []).length, attachments: (snap.attachments || []).length,
    status: snap.meta?.status ?? null, assigneeId: snap.meta?.assigneeId ?? snap.issues?.[0]?.assignee_id ?? null,
  };
}

const audit = (a) => ({ id: a.id, actorId: a.actor_id, action: a.action, project: a.project_key, target: a.target, details: a.details || {}, created: a.created_at });

module.exports = { projectBase, project, sprint, version, component, team, trashEntry, audit };
