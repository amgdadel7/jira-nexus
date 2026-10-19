'use strict';

const { LINK_TYPES, GOAL_STATUSES } = require('../../domain/issue');
const { clampInt } = require('../../shared/validation');

/** Workspace bootstrap (/meta), quick search, activity stream and "worked on". */
class WorkspaceService {
  constructor(deps) {
    const { access, billing, catalog, projectAccess, customFields, projectRepo, userRepo, componentRepo, teamRepo, sprintRepo, versionRepo, filterRepo, activityRepo } = deps;
    Object.assign(this, {
      access, billing, catalog, projectAccess, customFields,
      projects: projectRepo, users: userRepo, components: componentRepo, teams: teamRepo,
      sprints: sprintRepo, versions: versionRepo, filters: filterRepo, activity: activityRepo,
    });
  }

  async plan() {
    const s = await this.billing.summary();
    return {
      key: s.plan, name: s.planName, status: s.status, features: s.features, trialEndsAt: s.trialEndsAt,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd, currentPeriodEnd: s.currentPeriodEnd, limits: s.limits, usage: await this.billing.usage(),
    };
  }

  /** Everything the client needs to render a project: lookups, permissions, sprints, versions, board settings… */
  async meta(actor, wantedKey) {
    const [all, visibleKeys, starredKeys, users, globalPermissions, plan, snapshot] = await Promise.all([
      this.projects.listAll(), this.access.browsableKeys(actor), this.projects.starredKeys(actor.id), this.users.listAll(),
      this.projectAccess.myGlobalPermissions(actor), this.plan(), this.catalog.snapshot(),
    ]);
    const visible = new Set(visibleKeys);
    const starred = new Set(starredKeys);
    const projects = [];
    for (const row of all.filter((p) => visible.has(p.key))) {
      const describe = await this.access.describe(actor, row.key);
      projects.push({ row, starred: starred.has(row.key), myRole: describe.role, canCreate: describe.permissions.includes('CREATE_ISSUES'), permissions: describe.permissions });
    }
    const wanted = String(wantedKey || '').toUpperCase();
    const denied = wanted && !visible.has(wanted) ? wanted : null; // private and unknown look the same
    const current = projects.find((p) => p.row.key === wanted) || projects.find((p) => p.starred) || projects.find((p) => p.row.key === 'KAN') || projects[0];
    const base = { projects, users, currentUser: actor.user, globalPermissions, plan };
    if (!current) return { ...base, project: null, projects: [], noAccess: true };

    const key = current.row.key;
    const workflow = await this.catalog.workflowForProject(current.row);
    const [board, describe, components, teams, labels, sprints, versions, repos, fields] = await Promise.all([
      this.projectAccess.board(current.row), this.access.describe(actor, key), this.components.list(key), this.teams.list(),
      this.activity.projectLabels(key), this.sprints.list({ projectKey: key, states: ['active', 'future'] }),
      this.versions.list(key, ['unreleased', 'released']), this.activity.repos(), this.customFields.projectFields(actor, key),
    ]);
    return {
      ...base,
      project: { ...current, board },
      denied,
      myRole: describe.role, myRoleLabel: describe.roleLabel, permissions: describe.permissions,
      components, teams, labels, repos,
      sprints: sprints.map((s) => s.name),
      activeSprint: sprints.find((s) => s.state === 'active') || null,
      versions,
      workflow: { id: workflow.id, name: workflow.name, statuses: workflow.statuses, transitions: workflow.transitions },
      statuses: workflow.statuses.map((s) => s.name),
      priorities: snapshot.priorities.map((p) => p.name),
      types: snapshot.types.map((t) => t.name),
      typeDetails: snapshot.types,
      priorityDetails: snapshot.priorities,
      resolutions: snapshot.resolutions,
      customFields: fields.fields,
      linkTypes: Object.entries(LINK_TYPES).map(([id, v]) => ({ id, ...v })),
      goalStatuses: GOAL_STATUSES,
    };
  }

  /** Top-bar search: matching work items, filters and people. */
  async quickSearch(actor, text) {
    const q = String(text || '').trim();
    if (!q) return { issues: [], filters: [], users: [] };
    const projectKeys = await this.access.browsableKeys(actor);
    const [issues, filters, users] = await Promise.all([
      this.activity.quickSearchIssues({ text: q, projectKeys }), this.filters.search(q), this.activity.quickSearchUsers(q),
    ]);
    return { issues, filters, users };
  }

  async feed(actor, { project, limit } = {}) {
    const max = clampInt(limit, 30, 1, 100);
    let projectKeys = await this.access.browsableKeys(actor);
    if (project) projectKeys = projectKeys.filter((k) => k === String(project).toUpperCase());
    return this.activity.feed({ projectKeys, limit: max });
  }

  async workedOn(actor) {
    return this.activity.workedOn({ userId: actor.id, projectKeys: await this.access.browsableKeys(actor) });
  }
}

module.exports = { WorkspaceService };
