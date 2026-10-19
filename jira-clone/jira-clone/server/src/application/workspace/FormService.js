'use strict';

const { cleanLabels } = require('../../domain/issue');
const { bad, notFound } = require('../../shared/errors');

const FORM_FIELDS = ['summary', 'description', 'priority', 'dueDate', 'labels', 'storyPoints'];

/** Intake forms: submitting one creates a work item in the form's project. */
class FormService {
  constructor({ access, catalog, formRepo, userRepo, issueService, projectRepo }) {
    Object.assign(this, { access, catalog, forms: formRepo, users: userRepo, issueService, projects: projectRepo });
  }

  async fields(body) {
    const out = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Form name is required.');
      out.name = name.slice(0, 120);
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 2000);
    if (body.issueType !== undefined) {
      const type = await this.catalog.typeByName(body.issueType);
      if (!type || type.hierarchy_level < 0) throw bad('Invalid work type.');
      out.issue_type_id = type.id;
    }
    if (body.fields !== undefined) {
      if (!Array.isArray(body.fields)) throw bad('fields must be an array.');
      out.fields = JSON.stringify([...new Set(['summary', ...body.fields.filter((f) => FORM_FIELDS.includes(f))])]);
    }
    if (body.defaultLabels !== undefined) out.default_labels = cleanLabels(body.defaultLabels || []);
    if (body.defaultAssigneeId !== undefined) {
      if (body.defaultAssigneeId && !(await this.users.findById(body.defaultAssigneeId))) throw bad('Unknown user.');
      out.default_assignee_id = body.defaultAssigneeId || null;
    }
    if (body.active !== undefined) out.active = Boolean(body.active);
    return out;
  }

  async require(id) {
    const form = await this.forms.find(id);
    if (!form) throw notFound('Form not found.');
    return form;
  }

  async list(actor, projectKey) {
    if (projectKey) await this.access.assert(actor, projectKey);
    const out = [];
    for (const form of await this.forms.list(projectKey ? String(projectKey).toUpperCase() : null)) {
      if (await this.access.can(actor, form.project_key, 'BROWSE_PROJECT')) out.push(form);
    }
    return out;
  }

  async get(actor, id) {
    const form = await this.require(id);
    await this.access.assert(actor, form.project_key);
    return form;
  }

  async create(actor, body = {}) {
    const project = await this.access.assert(actor, body.projectKey || 'KAN', 'ADMINISTER_PROJECT');
    const fields = await this.fields({ issueType: 'Task', fields: ['summary', 'description'], defaultLabels: ['form'], active: true, ...body });
    if (!fields.name) throw bad('Form name is required.');
    const id = await this.forms.insert({ ...fields, project_key: project.key, created_by: actor.id });
    return this.forms.find(id);
  }

  async update(actor, id, body = {}) {
    const form = await this.require(id);
    await this.access.assert(actor, form.project_key, 'ADMINISTER_PROJECT');
    const fields = await this.fields(body);
    if (Object.keys(fields).length) await this.forms.update(form.id, fields);
    return this.forms.find(form.id);
  }

  async remove(actor, id) {
    const form = await this.require(id);
    await this.access.assert(actor, form.project_key, 'ADMINISTER_PROJECT');
    await this.forms.delete(form.id);
    return { ok: true };
  }

  async submit(actor, id, values = {}) {
    const form = await this.require(id);
    const project = await this.access.assert(actor, form.project_key, 'CREATE_ISSUES');
    if (!form.active) throw bad('This form is not accepting submissions.');
    const body = { type: form.issue_type, assigneeId: form.default_assignee_id, labels: form.default_labels };
    for (const field of form.fields) if (values[field] !== undefined && values[field] !== '') body[field] = values[field];
    if (form.fields.includes('labels') && Array.isArray(values.labels)) body.labels = [...new Set([...form.default_labels, ...values.labels])];
    body.description = `${body.description || ''}\n\n— Submitted via form “${form.name}”`.trim();
    const issue = await this.issueService.createInProject(actor, project, body);
    await this.forms.countSubmission(form.id);
    return issue;
  }
}

module.exports = { FormService, FORM_FIELDS };
