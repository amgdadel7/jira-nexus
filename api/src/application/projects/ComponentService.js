'use strict';

const { bad, notFound } = require('../../shared/errors');

const DEFAULT_ASSIGNEE = ['unassigned', 'project_lead', 'component_lead'];

class ComponentService {
  constructor({ db, access, audit, componentRepo, userRepo }) {
    Object.assign(this, { db, access, audit, components: componentRepo, users: userRepo });
  }

  async withStats(rows) {
    const stats = await this.components.stats(rows.map((c) => c.id));
    return rows.map((component) => ({ component, stats: stats.get(component.id) || { total: 0, open: 0 } }));
  }

  async require(id) {
    const component = await this.components.find(id);
    if (!component) throw notFound('Component not found.');
    return component;
  }

  async list(actor, projectKey) {
    const project = await this.access.assert(actor, projectKey || 'KAN');
    return this.withStats(await this.components.list(project.key));
  }

  async fields(body, existing, projectKey) {
    const out = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Component name is required.');
      if (name.length > 80) throw bad('Component name must be 80 characters or less.');
      if (await this.components.nameTaken(projectKey, name, existing?.id)) throw bad(`A component called '${name}' already exists.`);
      out.name = name;
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 1000);
    if (body.leadId !== undefined) {
      if (body.leadId && !(await this.users.findById(body.leadId))) throw bad('Unknown user.');
      out.lead_id = body.leadId || null;
    }
    if (body.defaultAssignee !== undefined) {
      if (!DEFAULT_ASSIGNEE.includes(body.defaultAssignee)) throw bad('Invalid default assignee.');
      out.default_assignee = body.defaultAssignee;
    }
    return out;
  }

  async create(actor, body = {}) {
    const project = await this.access.assert(actor, body.projectKey || 'KAN', 'ADMINISTER_PROJECT');
    const fields = await this.fields({ defaultAssignee: 'unassigned', ...body }, null, project.key);
    if (!fields.name) throw bad('Component name is required.');
    const row = await this.db.tx(async () => {
      const inserted = await this.components.insert({ ...fields, project_key: project.key });
      await this.audit.record(actor, 'component.created', { project: project.key, target: fields.name });
      return inserted;
    });
    return (await this.withStats([row]))[0];
  }

  async update(actor, id, body = {}) {
    const component = await this.require(id);
    await this.access.assert(actor, component.project_key, 'ADMINISTER_PROJECT');
    const fields = await this.fields(body, component, component.project_key);
    const columns = Object.keys(fields);
    const row = !columns.length ? component : await this.db.tx(async () => {
      const updated = await this.components.update(component.id, fields); // issues reference components by id
      await this.audit.record(actor, 'component.updated', { project: component.project_key, target: fields.name || component.name, details: { fields: columns } });
      return updated;
    });
    return (await this.withStats([row]))[0];
  }

  async remove(actor, id, moveToId) {
    const component = await this.require(id);
    await this.access.assert(actor, component.project_key, 'ADMINISTER_PROJECT');
    const moveTo = moveToId ? await this.require(moveToId) : null;
    if (moveTo && (moveTo.project_key !== component.project_key || moveTo.id === component.id)) throw bad('Choose another component in the same project.');
    const affected = await this.db.tx(async () => {
      const count = await this.components.reassign(component.id, moveTo?.id || null);
      await this.components.delete(component.id);
      await this.audit.record(actor, 'component.deleted', { project: component.project_key, target: component.name, details: { affected: count, movedTo: moveTo?.name || null } });
      return count;
    });
    return { ok: true, affected };
  }
}

module.exports = { ComponentService, DEFAULT_ASSIGNEE };
