'use strict';

const { ACCESS } = require('../../domain/permissions');
const { bad, forbidden, notFound } = require('../../shared/errors');
const { isHexColor } = require('../../shared/validation');

const TYPES = ['software', 'business', 'service'];
const COLORS = ['#FFAB00', '#0C66E4', '#22A06B', '#E2483D', '#6E5DC6', '#1D7AFC', '#D97008', '#943D73'];
const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;

/** Project directory, create / edit / delete and per-user stars. */
class ProjectService {
  constructor({ db, access, billing, audit, catalog, projectRepo, userRepo, sprintRepo }) {
    Object.assign(this, { db, access, billing, audit, catalog, projects: projectRepo, users: userRepo, sprints: sprintRepo });
  }

  /** Row + stats + the actor's relation to it (presenter input). */
  async view(actor, project) {
    const [stats, starred, members, describe] = await Promise.all([
      this.projects.stats(project.key), this.projects.isStarred(actor.id, project.key),
      this.projects.memberCount(project.key), this.access.describe(actor, project.key),
    ]);
    return { project, stats, starred, members, myRole: describe.role };
  }

  async list(actor, query = '') {
    const q = String(query || '').trim().toLowerCase();
    const out = [];
    for (const project of await this.projects.listAll(actor?.organizationId || null)) {
      if (q && !project.name.toLowerCase().includes(q) && !project.key.toLowerCase().includes(q)) continue;
      if (await this.access.can(actor, project.key, 'BROWSE_PROJECT')) out.push(await this.view(actor, project));
    }
    return out;
  }

  async get(actor, key) {
    return this.view(actor, await this.access.assert(actor, key));
  }

  async fields(body, existing = null) {
    const out = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Project name is required.');
      if (name.length > 80) throw bad('Project name must be 80 characters or less.');
      if (await this.projects.nameTaken(name, existing?.key || '')) throw bad('A project with that name already exists.');
      out.name = name;
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 2000);
    if (body.type !== undefined) {
      if (!TYPES.includes(body.type)) throw bad('Invalid project type.');
      out.type = body.type;
    }
    if (body.category !== undefined) out.category = String(body.category || '').trim().slice(0, 60);
    if (body.color !== undefined) {
      if (!isHexColor(body.color)) throw bad('Color must be a hex value like #0C66E4.');
      out.color = body.color;
    }
    if (body.access !== undefined) {
      if (!ACCESS.includes(body.access)) throw bad('Access must be open, limited or private.');
      if (body.access !== 'open' && body.access !== existing?.access) await this.billing.assertFeature('permissions');
      out.access = body.access;
    }
    if (body.leadId !== undefined) {
      if (body.leadId) {
        const lead = await this.users.findById(body.leadId);
        if (!lead || !lead.active) throw bad('Unknown or inactive user.');
      }
      out.lead_id = body.leadId || null;
    }
    if (body.workflowId !== undefined) {
      const workflow = (await this.catalog.snapshot()).workflows.get(Number(body.workflowId));
      if (!workflow) throw bad('Unknown workflow.');
      out.workflow_id = workflow.id;
    }
    return out;
  }

  async create(actor, body = {}) {
    await this.access.assertGlobal(actor, 'CREATE_PROJECTS');
    const key = String(body.key || '').trim().toUpperCase();
    if (!KEY_RE.test(key)) throw bad('Project key must be 2–10 characters: a letter followed by letters or numbers.');
    if (await this.projects.findByKey(key)) throw bad(`The key ${key} is already in use.`);
    if (!body.name) throw bad('Project name is required.');
    const count = await this.projects.count();
    const fields = await this.fields({ type: 'software', color: COLORS[count % COLORS.length], leadId: actor.id, ...body });
    const workflowId = fields.workflow_id ?? (await this.catalog.defaultWorkflowId());
    const project = await this.db.tx(async () => {
      const row = await this.projects.insert({ access: 'open', ...fields, key, workflow_id: workflowId, org_id: actor?.organizationId || 'default-org' });
      // The creator and the lead administer the new project.
      await this.projects.addMemberIfMissing(key, actor.id, 'admin', actor.id);
      if (row.lead_id && row.lead_id !== actor.id) await this.projects.addMemberIfMissing(key, row.lead_id, 'admin', actor.id);
      // Scrum projects start with an empty first sprint, like Jira.
      if (row.type === 'software') {
        await this.sprints.insert({ project_key: key, name: `${key} Sprint 1`, state: 'future', position: await this.sprints.nextPosition() });
      }
      await this.projects.star(actor.id, key);
      await this.audit.record(actor, 'project.created', { project: key, target: key, details: { name: row.name, type: row.type, access: row.access } });
      return row;
    });
    return this.view(actor, project);
  }

  async update(actor, key, body = {}) {
    const project = await this.access.assert(actor, key, 'ADMINISTER_PROJECT');
    const fields = await this.fields(body, project);
    const changed = Object.keys(fields).filter((c) => String(fields[c] ?? '') !== String(project[c] ?? ''));
    if (!changed.length) return this.view(actor, project);
    if (changed.includes('workflow_id')) await this.assertWorkflowFits(project, fields.workflow_id);
    const updated = await this.db.tx(async () => {
      const row = await this.projects.update(project.key, Object.fromEntries(changed.map((c) => [c, fields[c]])));
      const details = Object.fromEntries(changed.map((c) => [c, { from: project[c] ?? null, to: fields[c] ?? null }]));
      if (details.description) details.description = { changed: true };
      await this.audit.record(actor, changed.includes('access') ? 'project.access_changed' : 'project.updated', { project: project.key, target: project.key, details });
      return row;
    });
    actor.cache.clear();
    return this.view(actor, updated);
  }

  /** Switching workflow is only allowed when every work item's status exists in the new workflow. */
  async assertWorkflowFits(project, workflowId) {
    const workflow = await this.catalog.workflow(workflowId);
    const allowed = new Set(workflow.statuses.map((s) => s.id));
    const used = await this.projects.usedStatuses(project.key);
    const missing = used.filter((s) => !allowed.has(s.id));
    if (missing.length) {
      throw bad(`Work items in ${project.key} use ${missing.map((s) => `'${s.name}'`).join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not in the '${workflow.name}' workflow. Move them first.`);
    }
  }

  /** Admins only; the last project can't be deleted. Removes work items, sprints, releases, forms and the recycle bin. */
  async remove(actor, key, { confirm } = {}) {
    if (!actor.isSiteAdmin) throw forbidden('Only administrators can delete projects.');
    const project = await this.projects.findByKey(key);
    if (!project) throw notFound(`Project '${key}' does not exist.`);
    if ((await this.projects.count()) <= 1) throw bad('You cannot delete the only project.');
    if (confirm !== undefined && String(confirm).toUpperCase() !== project.key) throw bad(`Type ${project.key} to confirm.`);
    const removed = await this.db.tx(async () => {
      const count = await this.projects.deleteCascade(project.key);
      await this.audit.record(actor, 'project.deleted', { project: project.key, target: project.key, details: { name: project.name, removedIssues: count } });
      return count;
    });
    return { ok: true, removedIssues: removed };
  }

  async star(actor, key) {
    const project = await this.access.assert(actor, key);
    await this.projects.star(actor.id, project.key);
    return { ok: true, starred: true };
  }

  async unstar(actor, key) {
    const project = await this.projects.findByKey(key);
    if (!project) throw notFound(`Project '${key}' does not exist.`);
    await this.projects.unstar(actor.id, project.key);
    return { ok: true, starred: false };
  }
}

module.exports = { ProjectService, KEY_RE, PROJECT_TYPES: TYPES };
