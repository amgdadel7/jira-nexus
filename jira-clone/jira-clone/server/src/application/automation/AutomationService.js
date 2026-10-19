'use strict';

const AU = require('../../domain/automation');
const { bad, notFound } = require('../../shared/errors');
const { clampInt } = require('../../shared/validation');

/** Project automation rules: list / create (also from templates) / edit / delete, run history, manual run. */
class AutomationService {
  constructor({ db, access, audit, catalog, automationRepo, issueRepo, userRepo, issueQuery, automationEngine }) {
    Object.assign(this, { db, access, audit, catalog, issueQuery, engine: automationEngine, repo: automationRepo, issues: issueRepo, users: userRepo });
  }

  async adminProject(actor, projectKey) {
    return this.access.assert(actor, String(projectKey || '').toUpperCase(), 'ADMINISTER_PROJECT');
  }

  async loadRule(actor, id) {
    const rule = await this.repo.findRule(id);
    if (!rule) throw notFound('Rule not found.');
    await this.adminProject(actor, rule.project_key);
    return rule;
  }

  async withStats(rules) {
    const stats = await this.repo.stats(rules.map((r) => r.id));
    return rules.map((r) => ({ ...r, stats: stats.get(r.id) || null }));
  }

  async list(actor, projectKey) {
    const project = await this.adminProject(actor, projectKey);
    return {
      rules: await this.withStats(await this.repo.listRules(project.key)),
      usage: await this.engine.usage(),
      triggers: AU.TRIGGERS, actions: AU.ACTIONS, templates: AU.TEMPLATES, fields: Object.keys(AU.WATCHABLE_FIELDS),
    };
  }

  async get(actor, id) {
    return (await this.withStats([await this.loadRule(actor, id)]))[0];
  }

  /* ---------- validation ---------- */
  async cleanTrigger(trigger = {}) {
    if (!AU.TRIGGERS[trigger.type]) throw bad('Choose a trigger for the rule.');
    const out = { type: trigger.type };
    if (trigger.type === 'issue_transitioned') {
      for (const k of ['from', 'to']) {
        if (!trigger[k]) continue;
        const status = await this.catalog.statusByName(trigger[k]);
        if (!status) throw bad(`Unknown status '${trigger[k]}'.`);
        out[k] = status.name;
      }
    }
    if (trigger.type === 'field_changed') {
      const field = String(trigger.field || '').toLowerCase().replace(/\s+/g, '');
      if (!AU.WATCHABLE_FIELDS[field]) throw bad('Choose which field to watch.');
      out.field = field;
    }
    return out;
  }

  async cleanCondition(actor, condition) {
    const text = String(condition || '').trim();
    if (!text) return '';
    if (/\border\s+by\b/i.test(text)) throw bad('Conditions cannot contain ORDER BY.');
    try {
      await this.issueQuery.compile(actor, text);
    } catch (err) {
      throw bad(`Condition: ${err.message}`);
    }
    return text;
  }

  async cleanAction(action, index) {
    const n = index + 1;
    if (!action || !AU.ACTIONS[action.type]) throw bad(`Action ${n}: unknown action.`);
    const out = { type: action.type };
    switch (action.type) {
      case 'assign': {
        const to = String(action.to || '');
        if (!AU.ASSIGN_TARGETS.includes(to) && !(await this.users.isActive(to))) throw bad(`Action ${n}: choose who to assign.`);
        out.to = to;
        break;
      }
      case 'transition': {
        const status = await this.catalog.statusByName(action.status);
        if (!status) throw bad(`Action ${n}: choose a status.`);
        out.status = status.name;
        break;
      }
      case 'set_priority': {
        const priority = await this.catalog.priorityByName(action.priority);
        if (!priority) throw bad(`Action ${n}: choose a priority.`);
        out.priority = priority.name;
        break;
      }
      case 'add_label': {
        const label = String(action.label || '').trim().replace(/\s+/g, '_').slice(0, 60);
        if (!label) throw bad(`Action ${n}: enter a label.`);
        out.label = label;
        break;
      }
      case 'comment': {
        const body = String(action.body || '').trim();
        if (!body) throw bad(`Action ${n}: enter the comment.`);
        out.body = body.slice(0, 32000);
        break;
      }
      case 'add_watcher': {
        const userId = String(action.userId || '');
        if (!AU.WATCHER_TARGETS.includes(userId) && !(await this.users.isActive(userId))) throw bad(`Action ${n}: choose a watcher.`);
        out.userId = userId;
        break;
      }
      case 'set_story_points': {
        const value = action.value === '' || action.value == null ? null : Number(action.value);
        if (value !== null && (Number.isNaN(value) || value < 0 || value > 1000)) throw bad(`Action ${n}: story points must be between 0 and 1000.`);
        out.value = value;
        break;
      }
      default:
        break;
    }
    return out;
  }

  async clean(actor, body, partial = false) {
    const out = {};
    if (!partial || body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Give the rule a name.');
      if (name.length > 255) throw bad('Rule names must be less than 255 characters.');
      out.name = name;
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 2000);
    if (body.enabled !== undefined) out.enabled = Boolean(body.enabled);
    if (!partial || body.trigger !== undefined) out.trigger = await this.cleanTrigger(body.trigger);
    if (body.condition !== undefined) out.condition = await this.cleanCondition(actor, body.condition);
    if (!partial || body.actions !== undefined) {
      const list = Array.isArray(body.actions) ? body.actions : [];
      if (!list.length) throw bad('Add at least one action.');
      if (list.length > 10) throw bad('A rule can have at most 10 actions.');
      out.actions = [];
      for (const [i, action] of list.entries()) out.actions.push(await this.cleanAction(action, i));
    }
    return out;
  }

  /* ---------- use cases ---------- */
  async create(actor, projectKey, body = {}) {
    const project = await this.adminProject(actor, projectKey);
    const template = body.templateId ? AU.TEMPLATES.find((t) => t.id === body.templateId) : null;
    if (body.templateId && !template) throw bad('Unknown template.');
    const fields = await this.clean(actor, template ? { ...template, ...body } : body);
    const rule = await this.repo.insertRule({ project_key: project.key, enabled: true, condition: '', description: '', ...fields, created_by: actor.id });
    await this.audit.record(actor, 'automation.rule_created', { project: project.key, target: rule.name, details: { ruleId: rule.id } });
    return this.get(actor, rule.id);
  }

  async update(actor, id, body = {}) {
    const rule = await this.loadRule(actor, id);
    const fields = await this.clean(actor, body, true);
    const columns = Object.keys(fields);
    if (columns.length) await this.repo.updateRule(rule.id, fields);
    if ('enabled' in fields) {
      await this.audit.record(actor, fields.enabled ? 'automation.rule_enabled' : 'automation.rule_disabled', { project: rule.project_key, target: rule.name });
    } else if (columns.length) {
      await this.audit.record(actor, 'automation.rule_updated', { project: rule.project_key, target: fields.name || rule.name, details: { fields: columns } });
    }
    return this.get(actor, rule.id);
  }

  async remove(actor, id) {
    const rule = await this.loadRule(actor, id);
    await this.repo.deleteRule(rule.id);
    await this.audit.record(actor, 'automation.rule_deleted', { project: rule.project_key, target: rule.name });
    return { ok: true };
  }

  async runs(actor, id, limit) {
    const rule = await this.loadRule(actor, id);
    return this.repo.runs(rule.id, clampInt(limit, 50, 1, 200));
  }

  async projectRuns(actor, projectKey, { status, limit } = {}) {
    const project = await this.adminProject(actor, projectKey);
    return this.repo.projectRuns(project.key, { status: status ? String(status) : null, limit: clampInt(limit, 50, 1, 200) });
  }

  /** "Run rule" for one work item (ignores the trigger, still checks the condition). */
  async runManually(actor, id, issueKey) {
    const rule = await this.loadRule(actor, id);
    const issue = await this.issues.findByKey(String(issueKey || '').toUpperCase());
    if (!issue) throw notFound(`Work item ${issueKey} does not exist.`);
    if (issue.project_key !== rule.project_key) throw bad(`${issue.key} isn’t in ${rule.project_key}.`);
    const out = await this.engine.execute(rule, issue.key, actor.id);
    return { ...out, issue: await this.issues.findByKey(issue.key) };
  }
}

module.exports = { AutomationService };
