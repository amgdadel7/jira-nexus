'use strict';

const P = require('../../domain/permissions');
const { bad, notFound } = require('../../shared/errors');

const SWIMLANES = ['none', 'assignee', 'epic', 'priority', 'type'];
const sameRoles = (a, b) => [...a].sort().join() === [...b].sort().join();

/**
 * People & roles, permission schemes, global permissions and board settings
 * (WIP limits, swimlanes) of projects.
 */
class ProjectAccessService {
  constructor({ db, access, billing, audit, catalog, projectRepo, userRepo, settingsRepo }) {
    Object.assign(this, { db, access, billing, audit, catalog, projects: projectRepo, users: userRepo, settings: settingsRepo });
  }

  /* ---------- people & roles ---------- */
  /** Everyone with access, explaining where their role comes from. */
  async members(actor, key) {
    const project = await this.access.assert(actor, key);
    const explicit = new Map((await this.projects.listMembers(project.key)).map((m) => [m.user_id, m]));
    const feature = await this.access.permissionsFeature();
    const people = [];
    for (const user of (await this.users.listDirectory()).filter((u) => u.active)) {
      const member = explicit.get(user.id);
      const effective = await this.access.roleFor(user, project);
      if (!effective) continue;
      const source = user.role === 'admin' ? 'site-admin' : project.lead_id === user.id ? 'lead' : member ? 'member' : 'access-level';
      if (source === 'access-level') continue; // listed separately as "everyone else"
      people.push({ user, role: member?.role || effective, effectiveRole: effective, source, explicit: Boolean(member), addedBy: member?.added_by || null, added: member?.added_at || null });
    }
    return {
      project: { key: project.key, name: project.name, access: project.access, leadId: project.lead_id },
      roles: P.ROLES.map((id) => ({ id, label: P.ROLE_LABEL[id] })),
      everyoneElse: project.access === 'open' || !feature ? 'member' : project.access === 'limited' ? 'viewer' : null,
      people,
      canManage: await this.access.can(actor, project.key, 'ADMINISTER_PROJECT'),
      planLocked: !feature,
    };
  }

  static cleanRole(role) {
    if (!P.ROLES.includes(role)) throw bad('Role must be admin, member or viewer.');
    return role;
  }

  async addMembers(actor, key, { userIds, userId, role = 'member' } = {}) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    const ids = Array.isArray(userIds) ? userIds : [userId].filter(Boolean);
    ProjectAccessService.cleanRole(role);
    if (!ids.length) throw bad('Choose at least one person.');
    await this.db.tx(async () => {
      for (const id of ids) {
        const user = await this.users.findById(id);
        if (!user || !user.active) throw bad('Unknown or inactive user.');
        await this.projects.upsertMember(project.key, id, role, actor.id);
        await this.audit.record(actor, 'member.added', { project: project.key, target: user.name, details: { userId: id, role } });
      }
    });
    actor.cache.clear();
    return this.members(actor, project.key);
  }

  async changeRole(actor, key, userId, role) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    ProjectAccessService.cleanRole(role);
    const user = await this.users.findById(userId);
    if (!user) throw notFound('User not found.');
    if (project.lead_id === user.id && role !== 'admin') throw bad(`${user.name} is the project lead and is always an administrator. Change the lead first.`);
    if (user.id === actor.id && role !== 'admin' && !actor.isSiteAdmin) throw bad('You can’t remove your own administrator role. Ask another administrator.');
    const before = await this.projects.memberRole(project.key, user.id);
    await this.db.tx(async () => {
      await this.projects.upsertMember(project.key, user.id, role, actor.id);
      await this.audit.record(actor, 'member.role_changed', { project: project.key, target: user.name, details: { userId: user.id, from: before, to: role } });
    });
    actor.cache.clear();
    return this.members(actor, project.key);
  }

  async removeMember(actor, key, userId) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    const user = await this.users.findById(userId);
    if (!user) throw notFound('User not found.');
    if (project.lead_id === user.id) throw bad(`${user.name} is the project lead. Choose a different lead before removing them.`);
    if (user.id === actor.id && !actor.isSiteAdmin) throw bad('You can’t remove yourself. Ask another administrator.');
    await this.db.tx(async () => {
      if (!(await this.projects.removeMember(project.key, user.id))) throw notFound(`${user.name} isn’t a member of this project.`);
      await this.audit.record(actor, 'member.removed', { project: project.key, target: user.name, details: { userId: user.id } });
    });
    actor.cache.clear();
    return this.members(actor, project.key);
  }

  /* ---------- permission scheme ---------- */
  async scheme(actor, key) {
    const project = await this.access.assert(actor, key);
    const scheme = await this.access.schemeFor(project);
    const defaults = P.buildScheme(null);
    return {
      project: project.key,
      roles: P.ROLES.map((id) => ({ id, label: P.ROLE_LABEL[id] })),
      permissions: P.PERMISSIONS,
      scheme, defaults: P.DEFAULT_SCHEME, locked: P.LOCKED,
      isDefault: P.PERM_KEYS.every((k) => sameRoles(scheme[k], defaults[k])),
      mine: await this.access.describe(actor, project.key),
      canManage: await this.access.can(actor, project.key, 'ADMINISTER_PROJECT'),
      planLocked: !(await this.access.permissionsFeature()),
    };
  }

  async updateScheme(actor, key, input) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    await this.billing.assertFeature('permissions');
    if (!input || typeof input !== 'object') throw bad('scheme is required: { PERMISSION: [roles] }.');
    const before = await this.access.schemeFor(project);
    const next = {};
    for (const k of P.PERM_KEYS) {
      const roles = Array.isArray(input[k]) ? input[k] : before[k];
      const unknown = roles.filter((r) => !P.ROLES.includes(r));
      if (unknown.length) throw bad(`Unknown role: ${unknown.join(', ')}.`);
      for (const must of P.LOCKED[k] || []) {
        if (!roles.includes(must)) throw bad(`Administrators must always have “${P.PERMISSIONS.find((x) => x.key === k).name}”.`);
      }
      next[k] = [...new Set(roles)];
    }
    const changes = P.PERM_KEYS.filter((k) => !sameRoles(before[k], next[k])).map((k) => ({ permission: k, from: before[k], to: next[k] }));
    await this.db.tx(async () => {
      await this.projects.replacePermissionScheme(project.key, next);
      if (changes.length) await this.audit.record(actor, 'permissions.changed', { project: project.key, target: project.key, details: { changes } });
    });
    actor.cache.clear();
    return this.scheme(actor, project.key);
  }

  async resetScheme(actor, key) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    await this.db.tx(async () => {
      await this.projects.resetPermissionScheme(project.key);
      await this.audit.record(actor, 'permissions.reset', { project: project.key, target: project.key });
    });
    actor.cache.clear();
    return this.scheme(actor, project.key);
  }

  async myGlobalPermissions(actor) {
    const out = [];
    for (const g of P.GLOBAL_PERMISSIONS) if (await this.access.canGlobal(actor, g.key)) out.push(g.key);
    return out;
  }

  async myPermissions(actor, key) {
    const project = await this.access.assert(actor, key || 'KAN');
    return { project: project.key, ...(await this.access.describe(actor, project.key)), global: await this.myGlobalPermissions(actor) };
  }

  /* ---------- global permissions ---------- */
  async globalPermissions(actor) {
    return {
      permissions: P.GLOBAL_PERMISSIONS,
      roles: [{ id: 'admin', label: 'Site administrators' }, { id: 'member', label: 'All users' }],
      scheme: await this.access.globalScheme(),
      defaults: P.GLOBAL_DEFAULT,
      mine: await this.myGlobalPermissions(actor),
      canManage: actor.isSiteAdmin,
      planLocked: !(await this.access.permissionsFeature()),
    };
  }

  async updateGlobalPermissions(actor, input = {}) {
    await this.billing.assertFeature('permissions');
    const before = await this.access.globalScheme();
    const next = {};
    for (const g of P.GLOBAL_PERMISSIONS) {
      const roles = Array.isArray(input[g.key]) ? input[g.key] : before[g.key];
      next[g.key] = [...new Set(['admin', ...roles.filter((r) => r === 'member')])];
    }
    const changes = Object.keys(next).filter((k) => before[k].join() !== next[k].join()).map((k) => ({ permission: k, from: before[k], to: next[k] }));
    await this.db.tx(async () => {
      await this.settings.set('global_permissions', next);
      if (changes.length) await this.audit.record(actor, 'global_permissions.changed', { details: { changes } });
    });
    return { scheme: await this.access.globalScheme() };
  }

  /* ---------- board settings ---------- */
  async board(project) {
    return { wip: await this.projects.columnLimits(project.key), swimlanes: project.board_swimlanes || 'none' };
  }

  /** PATCH /projects/:key/board { wip: { "In Progress": 3 }, swimlanes } */
  async updateBoard(actor, key, body = {}) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    const workflow = await this.catalog.workflowForProject(project);
    await this.db.tx(async () => {
      if (body.wip !== undefined) {
        if (typeof body.wip !== 'object' || !body.wip) throw bad('wip must be an object of { status: limit }.');
        const byStatusId = {};
        for (const [name, n] of Object.entries(body.wip)) {
          const status = workflow.statuses.find((s) => s.name.toLowerCase() === name.toLowerCase());
          if (!status) throw bad(`Unknown status '${name}'.`);
          if (n === null || n === '' || n === 0) continue;
          const limit = Number(n);
          if (!Number.isInteger(limit) || limit < 1 || limit > 999) throw bad('WIP limits must be whole numbers between 1 and 999.');
          byStatusId[status.id] = limit;
        }
        await this.projects.replaceColumnLimits(project.key, byStatusId);
      }
      if (body.swimlanes !== undefined) {
        if (!SWIMLANES.includes(body.swimlanes)) throw bad(`swimlanes must be one of ${SWIMLANES.join(', ')}.`);
        await this.projects.update(project.key, { board_swimlanes: body.swimlanes });
      }
    });
    const result = await this.board(await this.projects.findByKey(project.key));
    await this.audit.record(actor, 'board.updated', { project: project.key, target: project.key, details: result });
    return result;
  }
}

module.exports = { ProjectAccessService, SWIMLANES };
