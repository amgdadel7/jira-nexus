'use strict';

const P = require('../../domain/permissions');
const { notFound, forbidden } = require('../../shared/errors');

/**
 * Answers "may this actor do X in project Y?" using project roles, access
 * levels, the project's permission scheme, global permissions and the plan.
 * Results are cached on the Actor for the lifetime of a request.
 */
class AccessControl {
  constructor({ projectRepo, settingsRepo, billing }) {
    Object.assign(this, { projects: projectRepo, settings: settingsRepo, billing });
  }

  async permissionsFeature() {
    return this.billing.hasFeature('permissions');
  }

  /* ---------- global ---------- */
  async globalScheme() {
    if (!(await this.permissionsFeature())) return { ...P.GLOBAL_DEFAULT };
    return P.buildGlobalScheme(await this.settings.get('global_permissions', {}));
  }

  async canGlobal(actor, key) {
    const user = actor?.user;
    if (!user) return false;
    if (user.role === 'admin') return true;
    return ((await this.globalScheme())[key] || []).includes(user.role || 'member');
  }

  async assertGlobal(actor, key) {
    if (!(await this.canGlobal(actor, key))) {
      throw forbidden(`You don’t have the “${P.GLOBAL_PERMISSIONS.find((p) => p.key === key)?.name || key}” permission.`);
    }
  }

  /* ---------- organization & workspace permissions (deny-by-default) ---------- */
  canOrg(actor, permission) {
    if (!actor?.user) return false;
    if (actor.user.role === 'admin') return true;
    const role = actor.orgRole || 'guest';
    const allowed = P.ORG_PERMISSIONS[permission] || [];
    return allowed.includes(role);
  }

  assertOrg(actor, permission) {
    if (!this.canOrg(actor, permission)) {
      throw forbidden(`You don’t have permission to perform this organization action.`);
    }
  }

  canWorkspace(actor, workspaceRole, permission) {
    if (!actor?.user) return false;
    if (actor.user.role === 'admin' || actor.orgRole === 'owner') return true;
    const role = workspaceRole || 'guest';
    const allowed = P.WORKSPACE_PERMISSIONS[permission] || [];
    return allowed.includes(role);
  }

  /* ---------- project ---------- */
  /** Effective scheme; `stored` ignores the plan (used by the settings page to show saved values). */
  async schemeFor(project, { stored = false } = {}) {
    if (!stored && !(await this.permissionsFeature())) return P.defaultScheme();
    if (!project.custom_permissions) return P.buildScheme(null);
    const entries = await this.projects.permissionEntries(project.key);
    const overrides = Object.fromEntries(P.PERM_KEYS.map((k) => [k, []]));
    for (const e of entries) if (overrides[e.permission]) overrides[e.permission].push(e.role);
    return P.buildScheme(overrides);
  }

  async roleFor(user, project, orgRole = null) {
    if (!user || !project) return null;
    const memberRole = user.role === 'admin' || project.lead_id === user.id ? null : await this.projects.memberRole(project.key, user.id);
    return P.effectiveRole({ user, project, memberRole, permissionsFeature: await this.permissionsFeature(), orgRole });
  }

  async projectAccess(actor, projectKey) {
    const key = String(projectKey || '').toUpperCase();
    const cacheKey = `project:${key}`;
    if (actor.cache.has(cacheKey)) return actor.cache.get(cacheKey);
    const project = await this.projects.findByKey(key);
    let result = { project, role: null, set: new Set() };
    if (project) {
      // Tenant Isolation: Projects belonging to another organization are invisible
      if (project.org_id && actor.organizationId && project.org_id !== actor.organizationId) {
        actor.cache.set(cacheKey, result);
        return result;
      }
      const role = await this.roleFor(actor.user, project, actor.orgRole);
      result = { project, role, set: P.permissionSet({ user: actor.user, role, scheme: await this.schemeFor(project) }) };
    }
    actor.cache.set(cacheKey, result);
    return result;
  }

  async can(actor, projectKey, permission) {
    return (await this.projectAccess(actor, projectKey)).set.has(permission);
  }

  /** 404 when the actor cannot browse the project (never leak private projects), 403 when a permission is missing. */
  async assert(actor, projectKey, permission) {
    const { project, set } = await this.projectAccess(actor, projectKey);
    if (!project) throw notFound(`Project '${projectKey}' does not exist.`);
    if (!set.has('BROWSE_PROJECT')) throw notFound(`Project '${project.key}' does not exist or you don’t have access to it.`);
    if (permission && !set.has(permission)) throw forbidden(P.MESSAGES[permission] || 'You don’t have permission to do that.');
    return project;
  }

  async browsableKeys(actor) {
    if (actor.cache.has('browsable')) return actor.cache.get('browsable');
    const keys = [];
    const allKeys = actor.organizationId ? await this.projects.listKeys(actor.organizationId) : await this.projects.listKeys();
    for (const key of allKeys) {
      if (await this.can(actor, key, 'BROWSE_PROJECT')) keys.push(key);
    }
    actor.cache.set('browsable', keys);
    return keys;
  }

  async describe(actor, projectKey) {
    const { project, role, set } = await this.projectAccess(actor, projectKey);
    return { role, roleLabel: role ? P.ROLE_LABEL[role] : null, permissions: [...set], access: project?.access };
  }
}

module.exports = { AccessControl };
