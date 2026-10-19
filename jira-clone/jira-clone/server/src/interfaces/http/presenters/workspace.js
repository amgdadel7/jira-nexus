'use strict';

const { publicUser } = require('./users');
const { issue } = require('./issues');
const { projectBase } = require('./projects');

const workflow = (w) => ({
  id: w.id, name: w.name,
  statuses: w.statuses.map((s) => ({ id: s.id, name: s.name, category: s.category, isInitial: s.isInitial })),
  transitions: w.transitions,
});

const customField = (f) => ({
  id: f.id, key: `cf[${f.id}]`, name: f.name, description: f.description, type: f.type,
  options: f.options || [], required: f.required ?? undefined, usage: f.usage_count, projects: f.projects, created: f.created_at,
});

function meta(m) {
  const projects = m.projects.map((p) => ({ ...projectBase(p.row), starred: p.starred, myRole: p.myRole, canCreate: p.canCreate, permissions: p.permissions }));
  const common = { users: m.users.map(publicUser), currentUserId: m.currentUser.id, currentUser: publicUser(m.currentUser), globalPermissions: m.globalPermissions, plan: m.plan };
  if (!m.project) return { project: null, projects: [], noAccess: true, ...common };
  const current = projects.find((p) => p.key === m.project.row.key);
  return {
    ...common,
    project: { ...current, board: m.project.board },
    projects, denied: m.denied,
    myRole: m.myRole, myRoleLabel: m.myRoleLabel, permissions: m.permissions,
    components: m.components.map((c) => ({ id: c.id, name: c.name, leadId: c.lead_id })),
    teams: m.teams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    versions: m.versions.map((v) => ({ id: v.id, name: v.name, status: v.status, releaseDate: v.release_date })),
    activeSprint: m.activeSprint && { id: m.activeSprint.id, name: m.activeSprint.name, goal: m.activeSprint.goal, startDate: m.activeSprint.start_date, endDate: m.activeSprint.end_date },
    sprints: m.sprints, labels: m.labels, repos: m.repos,
    statuses: m.statuses, priorities: m.priorities, types: m.types,
    workflow: workflow(m.workflow),
    typeDetails: m.typeDetails.map((t) => ({ id: t.id, name: t.name, icon: t.icon, color: t.color, hierarchyLevel: t.hierarchy_level })),
    priorityDetails: m.priorityDetails.map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon, isDefault: p.is_default })),
    resolutions: m.resolutions.map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default })),
    customFields: m.customFields.map(customField),
    linkTypes: m.linkTypes, goalStatuses: m.goalStatuses,
  };
}

const goal = ({ goal: g, issues, progress }) => ({
  id: g.id, name: g.name, description: g.description, status: g.status, ownerId: g.owner_id, targetDate: g.target_date,
  created: g.created_at, updated: g.updated_at, issues: issues.map((i) => issue(i)), progress,
});

const filter = (f) => ({ id: f.id, name: f.name, description: f.description, jql: f.jql, ownerId: f.owner_id, starred: Boolean(f.starred), created: f.created_at, updated: f.updated_at });

const form = (f) => ({
  id: f.id, name: f.name, description: f.description, issueType: f.issue_type, fields: f.fields || [], defaultLabels: f.default_labels || [],
  defaultAssigneeId: f.default_assignee_id, active: Boolean(f.active), projectKey: f.project_key, submissions: f.submissions,
  createdBy: f.created_by, created: f.created_at, updated: f.updated_at,
});

const notification = (n) => ({
  id: n.id, actorId: n.actor_id, type: n.type, message: n.message, read: Boolean(n.read), created: n.created_at,
  key: n.issue_key || null, summary: n.issue_summary || null, issueType: n.issue_type || null,
});

const activity = (a) => ({
  kind: a.kind, id: a.id, authorId: a.author_id, field: a.field, from: a.from_value, to: a.to_value, body: a.body,
  created: a.created_at, key: a.key, summary: a.summary, type: a.type, status: a.status,
});

module.exports = { meta, goal, filter, form, notification, activity, workflow, customField };
