'use strict';

const I = require('../../domain/issue');
const W = require('../../domain/workflow');
const { parseDuration } = require('../../domain/duration');
const { bad } = require('../../shared/errors');

/**
 * Turns API input (camelCase, names) into a validated change set:
 *
 *   { fields:  { status: 'In Progress', assignee_id: 'u2', labels: [...] },   ← comparable with issue_view rows
 *     columns: { status_id: 3, assignee_id: 'u2' },                            ← what to write to `issues`
 *     labels?: [names], componentIds?: [ids] }                                 ← join tables
 *
 * `existing` is the current issue_view row (null on create). Only keys present
 * in the body are resolved, so PATCH semantics come for free.
 */
class IssueFieldResolver {
  constructor({ catalog, userRepo, issueRepo, sprintRepo, versionRepo, componentRepo, teamRepo }) {
    Object.assign(this, { catalog, users: userRepo, issues: issueRepo, sprints: sprintRepo, versions: versionRepo, components: componentRepo, teams: teamRepo });
  }

  async resolve(body, { existing = null, project }) {
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
    const out = { fields: {}, columns: {} };
    const set = (field, value, columns = { [field]: value }) => {
      out.fields[field] = value;
      Object.assign(out.columns, columns);
    };

    if (has('summary')) set('summary', I.cleanSummary(body.summary));
    if (has('description')) set('description', I.cleanDescription(body.description));

    if (has('type')) {
      const type = await this.catalog.typeByName(body.type);
      if (!type) throw bad('Invalid work type.');
      set('type', type.name, { issue_type_id: type.id });
    }

    if (has('status')) {
      const workflow = await this.catalog.workflowForProject(project);
      const status = W.statusByName(workflow, body.status);
      if (!status) {
        const known = await this.catalog.statusByName(body.status);
        throw bad(known ? `'${known.name}' is not part of the ${project.key} workflow.` : 'Invalid status.');
      }
      if (existing && !W.canTransition(workflow, existing.status_id, status.id)) {
        throw bad(`The workflow doesn’t allow moving from '${existing.status}' to '${status.name}'.`);
      }
      set('status', status.name, { status_id: status.id });
      out.statusCategory = status.category;
    }

    if (has('priority')) {
      const priority = await this.catalog.priorityByName(body.priority);
      if (!priority) throw bad('Invalid priority.');
      set('priority', priority.name, { priority_id: priority.id });
    }

    if (has('resolution')) {
      if (!body.resolution) set('resolution', null, { resolution_id: null });
      else {
        const resolution = await this.catalog.resolutionByName(body.resolution);
        if (!resolution) throw bad('Invalid resolution.');
        set('resolution', resolution.name, { resolution_id: resolution.id });
      }
    }

    for (const [key, field] of [['assigneeId', 'assignee_id'], ['reporterId', 'reporter_id']]) {
      if (!has(key)) continue;
      if (body[key]) {
        const user = await this.users.findById(body[key]);
        if (!user || !user.active) throw bad('Unknown or inactive user.');
      }
      set(field, body[key] || null);
    }

    if (has('parentKey')) set('parent_id', await this.parent(body.parentKey, existing, project));

    if (has('labels')) {
      out.labels = I.cleanLabels(body.labels);
      out.fields.labels = out.labels;
    }

    if (has('dueDate')) set('due_date', I.cleanDate(body.dueDate));
    if (has('startDate')) set('start_date', I.cleanDate(body.startDate));
    if (has('dueDate') || has('startDate')) {
      const start = has('startDate') ? out.fields.start_date : existing?.start_date;
      const due = has('dueDate') ? out.fields.due_date : existing?.due_date;
      if (start && due && start > due) throw bad('Start date must be before the due date.');
    }

    if (has('storyPoints')) set('story_points', I.cleanStoryPoints(body.storyPoints));

    if (has('sprintId') && !has('sprint')) {
      const sprint = body.sprintId ? await this.sprints.find(body.sprintId) : null;
      if (body.sprintId && !sprint) throw bad('Unknown sprint.');
      body = { ...body, sprint: sprint ? sprint.name : null };
    }
    if (has('sprint')) {
      if (!body.sprint) set('sprint', null, { sprint_id: null });
      else {
        const sprint = await this.sprints.findByName(body.sprint);
        if (!sprint) throw bad(`Sprint '${body.sprint}' does not exist.`);
        if (sprint.project_key !== project.key) throw bad(`Sprint '${sprint.name}' belongs to another project.`);
        if (sprint.state === 'closed' && sprint.id !== existing?.sprint_id) throw bad(`Sprint '${sprint.name}' is closed. Choose an active or future sprint.`);
        set('sprint', sprint.name, { sprint_id: sprint.id });
      }
    }

    if (has('fixVersion')) {
      if (!body.fixVersion) set('fix_version', null, { fix_version_id: null });
      else {
        const version = await this.versions.findByName(project.key, body.fixVersion);
        if (!version) throw bad(`Version '${body.fixVersion}' does not exist in ${project.key}.`);
        if (version.status === 'archived' && version.id !== existing?.fix_version_id) throw bad(`Version '${version.name}' is archived.`);
        set('fix_version', version.name, { fix_version_id: version.id });
      }
    }

    if (has('components')) {
      if (!Array.isArray(body.components)) throw bad('Components must be an array of names.');
      const wanted = [...new Set(body.components.map((n) => String(n).trim().toLowerCase()))];
      const found = await this.components.findByNames(project.key, wanted);
      const ordered = wanted.map((name) => {
        const hit = found.find((c) => c.name.toLowerCase() === name);
        if (!hit) throw bad(`Component '${body.components.find((n) => String(n).trim().toLowerCase() === name)}' does not exist in ${project.key}.`);
        return hit;
      });
      out.componentIds = ordered.map((c) => c.id);
      out.fields.components = ordered.map((c) => c.name);
      out.componentRows = ordered;
    }

    for (const [key, field] of [['originalEstimate', 'original_estimate'], ['remainingEstimate', 'remaining_estimate']]) {
      if (!has(key)) continue;
      let seconds;
      try { seconds = parseDuration(body[key]); } catch (err) { throw bad(err.message); }
      if (seconds !== null && seconds > I.MAX_ESTIMATE) throw bad('That estimate is too large.');
      set(field, seconds);
    }
    // Like Jira: the first original estimate (nothing logged yet) also becomes the remaining estimate.
    if (has('originalEstimate') && !has('remainingEstimate') && (existing?.remaining_estimate ?? null) === null && !(existing?.time_spent > 0)) {
      set('remaining_estimate', out.fields.original_estimate);
    }

    if (has('teamId')) {
      if (body.teamId === null || body.teamId === '') set('team_id', null);
      else {
        const team = await this.teams.find(body.teamId);
        if (!team) throw bad('Unknown team.');
        set('team_id', team.id);
      }
    }

    return out;
  }

  async parent(parentKey, existing, project) {
    if (!parentKey) return null;
    const parent = await this.issues.findByKey(parentKey);
    if (!parent) throw bad(`Parent ${parentKey} not found.`);
    if (existing && (parent.id === existing.id || parent.parent_id === existing.id)) throw bad('That would create a circular parent relationship.');
    if (parent.project_key !== project.key) throw bad(`Parent ${parent.key} belongs to another project.`);
    return parent.id;
  }
}

module.exports = { IssueFieldResolver };
