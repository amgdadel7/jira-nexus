'use strict';

const { bad, notFound, forbidden } = require('../../shared/errors');
const { DATE_RE } = require('../../domain/issue');

const TYPES = ['text', 'paragraph', 'number', 'date', 'select', 'multiselect', 'user', 'checkbox', 'url'];
const TYPE_LABEL = {
  text: 'Short text', paragraph: 'Paragraph', number: 'Number', date: 'Date picker', select: 'Dropdown',
  multiselect: 'Multi-select', user: 'User picker', checkbox: 'Checkbox', url: 'URL',
};
const WITH_OPTIONS = ['select', 'multiselect'];

/**
 * Custom fields (cf[10100] …): site-wide definitions administered by site
 * admins, enabled per project (field context, order, required) by project
 * admins, with typed values on work items.
 */
class CustomFieldService {
  constructor({ db, access, audit, customFieldRepo, userRepo, issueRepo }) {
    Object.assign(this, { db, access, audit, repo: customFieldRepo, users: userRepo, issues: issueRepo });
    this.cache = null;
  }

  static get TYPES() {
    return TYPES.map((id) => ({ id, label: TYPE_LABEL[id], hasOptions: WITH_OPTIONS.includes(id) }));
  }

  invalidate() {
    this.cache = null;
  }

  /** Definitions for the JQL compiler ({ id, name, type, options }). */
  async definitions() {
    if (!this.cache) this.cache = await this.repo.list();
    return this.cache;
  }

  list() {
    return this.definitions();
  }

  async get(id) {
    const field = await this.repo.find(id);
    if (!field) throw notFound('Custom field not found.');
    return field;
  }

  /* ---------- administration (site admins) ---------- */
  assertAdmin(actor) {
    if (!actor.isSiteAdmin) throw forbidden('Only site administrators can manage custom fields.');
  }

  async cleanDefinition(body, existing = null) {
    const out = {};
    if (body.name !== undefined || !existing) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Give the field a name.');
      if (name.length > 60) throw bad('Field names must be 60 characters or less.');
      if (await this.repo.nameTaken(name, existing?.id)) throw bad(`A field called '${name}' already exists.`);
      out.name = name;
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 1000);
    if (!existing) {
      if (!TYPES.includes(body.type)) throw bad(`Field type must be one of ${TYPES.join(', ')}.`);
      out.type = body.type;
    } else if (body.type !== undefined && body.type !== existing.type) {
      throw bad('The type of an existing field can’t be changed. Create a new field instead.');
    }
    return out;
  }

  cleanOptions(options, existing = null) {
    if (!Array.isArray(options)) throw bad('options must be an array.');
    const seen = new Set();
    const known = new Set((existing?.options || []).map((o) => o.id));
    return options.map((o) => {
      const value = String(typeof o === 'string' ? o : o?.value || '').trim().slice(0, 100);
      if (!value) throw bad('Options can’t be empty.');
      if (seen.has(value.toLowerCase())) throw bad(`The option '${value}' is listed twice.`);
      seen.add(value.toLowerCase());
      const id = typeof o === 'object' && o.id ? Number(o.id) : null;
      if (id && !known.has(id)) throw bad('Unknown option id.');
      return { id, value, disabled: typeof o === 'object' && Boolean(o.disabled) };
    });
  }

  async create(actor, body = {}) {
    this.assertAdmin(actor);
    const fields = await this.cleanDefinition(body);
    const options = WITH_OPTIONS.includes(fields.type) ? this.cleanOptions(body.options || []) : [];
    if (WITH_OPTIONS.includes(fields.type) && !options.length) throw bad('Add at least one option.');
    const id = await this.db.tx(async () => {
      const newId = await this.repo.insert({ ...fields, created_by: actor.id });
      if (options.length) await this.repo.replaceOptions(newId, options);
      if (Array.isArray(body.projects)) {
        for (const key of body.projects) await this.enableInProject(String(key).toUpperCase(), newId);
      }
      await this.audit.record(actor, 'custom_field.created', { target: fields.name, details: { type: fields.type } });
      return newId;
    });
    this.invalidate();
    return this.get(id);
  }

  async enableInProject(projectKey, fieldId) {
    const current = await this.repo.projectSettings(projectKey);
    if (current.some((e) => e.field_id === fieldId)) return;
    await this.repo.replaceProjectFields(projectKey, [...current.map((e) => ({ fieldId: e.field_id, required: e.required })), { fieldId, required: false }]);
  }

  async update(actor, id, body = {}) {
    this.assertAdmin(actor);
    const existing = await this.get(id);
    const fields = await this.cleanDefinition(body, existing);
    await this.db.tx(async () => {
      await this.repo.update(existing.id, fields);
      if (body.options !== undefined) {
        if (!WITH_OPTIONS.includes(existing.type)) throw bad('This field type has no options.');
        const options = this.cleanOptions(body.options, existing);
        if (!options.length) throw bad('Add at least one option.');
        await this.repo.replaceOptions(existing.id, options);
      }
      await this.audit.record(actor, 'custom_field.updated', { target: fields.name || existing.name, details: { fields: Object.keys(fields), options: body.options !== undefined } });
    });
    this.invalidate();
    return this.get(existing.id);
  }

  async remove(actor, id) {
    this.assertAdmin(actor);
    const existing = await this.get(id);
    await this.db.tx(async () => {
      await this.repo.delete(existing.id);
      await this.audit.record(actor, 'custom_field.deleted', { target: existing.name, details: { values: existing.usage_count } });
    });
    this.invalidate();
    return { ok: true, removedValues: existing.usage_count };
  }

  /* ---------- project field configuration ---------- */
  async projectFields(actor, projectKey) {
    const project = await this.access.assert(actor, projectKey);
    const settings = new Map((await this.repo.projectSettings(project.key)).map((s) => [s.field_id, s]));
    const fields = (await this.repo.projectFields(project.key)).map((f) => ({ ...f, required: settings.get(f.id)?.required || false }));
    return { project: project.key, fields, canManage: await this.access.can(actor, project.key, 'ADMINISTER_PROJECT') };
  }

  /** PUT /projects/:key/fields { fields: [{ id, required }] } (order = position). */
  async setProjectFields(actor, projectKey, entries) {
    const project = await this.access.assert(actor, projectKey, 'ADMINISTER_PROJECT');
    if (!Array.isArray(entries)) throw bad('fields must be an array of { id, required }.');
    const all = new Map((await this.definitions()).map((f) => [f.id, f]));
    const clean = [];
    for (const e of entries) {
      const fieldId = Number(e?.id ?? e?.fieldId ?? e);
      if (!all.has(fieldId)) throw bad(`Unknown custom field ${e?.id ?? e}.`);
      if (!clean.some((x) => x.fieldId === fieldId)) clean.push({ fieldId, required: Boolean(e?.required) });
    }
    await this.db.tx(async () => {
      await this.repo.replaceProjectFields(project.key, clean);
      await this.audit.record(actor, 'project.fields_changed', { project: project.key, target: project.key, details: { fields: clean.map((c) => c.fieldId) } });
    });
    this.invalidate();
    return this.projectFields(actor, project.key);
  }

  /* ---------- values ---------- */
  /** Normalises one value for storage; null means "clear". */
  async cleanValue(field, value) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return null;
    const option = (v) => {
      const hit = field.options.find((o) => String(o.id) === String(v) || o.value.toLowerCase() === String(v).toLowerCase());
      if (!hit) throw bad(`'${v}' is not an option of ${field.name}.`);
      return hit;
    };
    switch (field.type) {
      case 'text': return String(value).slice(0, 255);
      case 'paragraph': return String(value).slice(0, 32000);
      case 'url': {
        const s = String(value).trim();
        if (!/^https?:\/\/\S+$/i.test(s)) throw bad(`${field.name} must be a web address starting with http:// or https://.`);
        return s.slice(0, 2000);
      }
      case 'number': {
        const n = Number(value);
        if (!Number.isFinite(n)) throw bad(`${field.name} must be a number.`);
        return n;
      }
      case 'date':
        if (!DATE_RE.test(String(value))) throw bad(`${field.name} must be a date (yyyy-MM-dd).`);
        return String(value);
      case 'checkbox': return value === true || value === 'true' || value === 1 || value === '1';
      case 'select': {
        const hit = option(typeof value === 'object' ? value.id : value);
        return hit.id;
      }
      case 'multiselect': {
        if (!Array.isArray(value)) throw bad(`${field.name} must be a list of options.`);
        return [...new Set(value.map((v) => option(typeof v === 'object' ? v.id : v).id))];
      }
      case 'user': {
        const user = await this.users.findById(String(value));
        if (!user || !user.active) throw bad('Unknown or inactive user.');
        return user.id;
      }
      default: return value;
    }
  }

  /** Display text for history. */
  async display(field, value) {
    if (value === null || value === undefined) return null;
    if (field.type === 'select') return field.options.find((o) => o.id === value)?.value ?? String(value);
    if (field.type === 'multiselect') return value.map((id) => field.options.find((o) => o.id === id)?.value ?? id).join(', ') || null;
    if (field.type === 'checkbox') return value ? 'Yes' : 'No';
    if (field.type === 'user') return (await this.users.nameOf(value)) || value;
    if (field.type === 'paragraph') return value.length > 80 ? `${value.slice(0, 80)}…` : value;
    return String(value);
  }

  /**
   * Sets values on an issue from { "10100": value, "Customer": value }. Fields
   * must be enabled in the issue's project. Runs inside the caller's transaction.
   */
  async applyValues(actor, issue, values, { recordHistory = true } = {}) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw bad('customFields must be an object of { fieldId: value }.');
    const available = await this.repo.projectFields(issue.project_key);
    const current = Object.fromEntries((await this.repo.values(issue.id)).map((v) => [v.field_id, v.value]));
    const changed = [];
    for (const [ref, raw] of Object.entries(values)) {
      const id = String(ref).replace(/^cf\[(\d+)\]$/i, '$1').replace(/^customfield_/, '');
      const field = available.find((f) => String(f.id) === id || f.name.toLowerCase() === String(ref).toLowerCase());
      if (!field) throw bad(`The field '${ref}' isn’t available in ${issue.project_key}.`);
      const value = await this.cleanValue(field, raw);
      const before = current[field.id] ?? null;
      if (JSON.stringify(before) === JSON.stringify(value)) continue;
      if (value === null) await this.repo.deleteValue(issue.id, field.id);
      else await this.repo.setValue(issue.id, field.id, value);
      changed.push(field.name);
      if (recordHistory) {
        await this.issues.addHistory({ issueId: issue.id, authorId: actor.id, field: field.name, from: await this.display(field, before), to: await this.display(field, value) });
      }
    }
    if (changed.length && recordHistory) await this.issues.touch(issue.id);
    return changed;
  }

  /** Values of one issue for the detail view: [{ id, name, type, value, display }]. */
  async valuesOf(issue) {
    const fields = await this.repo.projectFields(issue.project_key);
    const values = Object.fromEntries((await this.repo.values(issue.id)).map((v) => [v.field_id, v.value]));
    const out = [];
    for (const f of fields) {
      const value = values[f.id] ?? null;
      out.push({ id: f.id, key: `cf[${f.id}]`, name: f.name, type: f.type, value, display: await this.display(f, value) });
    }
    return out;
  }

  valuesFor(issueIds) {
    return this.repo.valuesFor(issueIds);
  }
}

module.exports = { CustomFieldService, TYPES };
