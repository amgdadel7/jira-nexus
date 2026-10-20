'use strict';

const I = require('../../domain/issue');
const W = require('../../domain/workflow');
const rank = require('../../domain/rank');
const { formatDuration } = require('../../domain/duration');
const { bad, forbidden } = require('../../shared/errors');
const { nowIso } = require('../../shared/time');
const { IssueGuard } = require('./IssueGuard');

const MAX_BULK = 500;

/**
 * Write-side use cases for work items: create, update (with workflow and
 * resolution rules), delete to the recycle bin, clone, bulk change, rank and
 * watch. Every change records history, notifies people and publishes a domain
 * event after the transaction commits.
 */
class IssueService {
  constructor(deps) {
    const { db, bus, access, guard, catalog, resolver, issueRepo, projectRepo, userRepo, teamRepo, linkRepo, notifications, audit, trash } = deps;
    Object.assign(this, {
      db, bus, access, guard, catalog, resolver, notifications, audit, trash,
      issues: issueRepo, projects: projectRepo, users: userRepo, teams: teamRepo, links: linkRepo,
    });
    this.customFields = null; // set by the container (CustomFieldService)
  }

  /* ---------- create ---------- */
  async targetProjectKey(body) {
    let key = body.projectKey || body.project;
    if (!key && body.parentKey) key = await this.issues.projectKeyOf(body.parentKey);
    return String(key || 'KAN').toUpperCase();
  }

  async create(actor, body = {}) {
    const projectKey = await this.targetProjectKey(body);
    const project = await this.access.assert(actor, projectKey, 'CREATE_ISSUES');
    if (body.assigneeId && body.assigneeId !== actor.id) await this.access.assert(actor, projectKey, 'ASSIGN_ISSUES');
    return this.createInProject(actor, project, body);
  }

  /** Creates a work item without permission checks (callers have checked; also used by automation/import). */
  async createInProject(actor, project, body) {
    const workflow = await this.catalog.workflowForProject(project);
    const input = {
      type: 'Task',
      priority: (await this.catalog.defaultPriority()).name,
      reporterId: actor.id,
      status: W.initialStatus(workflow).name,
      ...body,
    };
    const resolved = await this.resolver.resolve(input, { project });
    const done = resolved.statusCategory === 'done';
    const defaultResolution = done ? await this.catalog.defaultResolution() : null;

    let createdId;
    await this.db.tx(async () => {
      const num = await this.projects.takeNextNumber(project.key);
      const key = `${project.key}-${num}`;
      const columns = {
        ...resolved.columns,
        key, num, project_key: project.key,
        rank: body.afterKey || body.beforeKey ? await this.computeRank(body) : await this.issues.nextRank(),
        resolved_at: done ? nowIso() : null,
        resolution_id: done ? (resolved.columns.resolution_id ?? defaultResolution?.id ?? null) : null,
      };
      if (!columns.assignee_id && resolved.componentRows?.length) {
        columns.assignee_id = this.componentDefaultAssignee(resolved.componentRows[0], project);
      }
      const id = await this.issues.insert(columns);
      createdId = id;
      if (resolved.labels?.length) await this.issues.setLabels(id, resolved.labels);
      if (resolved.componentIds?.length) await this.issues.setComponents(id, resolved.componentIds);
      if (body.customFields && this.customFields) await this.customFields.applyValues(actor, { id, project_key: project.key }, body.customFields, { recordHistory: false });

      await this.issues.addHistory({ issueId: id, authorId: actor.id, field: 'created' });
      for (const userId of new Set([actor.id, columns.reporter_id, columns.assignee_id])) await this.issues.watch(id, userId);
      if (columns.assignee_id && columns.assignee_id !== actor.id) {
        await this.notifications.notify({ issue: { id }, actorId: actor.id, type: 'assigned', message: `assigned ${key} to you`, only: [columns.assignee_id] });
      }
      await this.bus.publish('issue_created', { key, actorId: actor.id });
    });
    return this.issues.findById(createdId);
  }

  componentDefaultAssignee(component, project) {
    if (component.default_assignee === 'component_lead') return component.lead_id || null;
    if (component.default_assignee === 'project_lead') return project.lead_id || null;
    return null;
  }

  /* ---------- update ---------- */
  async update(actor, key, body = {}) {
    const record = await this.guard.load(actor, key);
    for (const permission of IssueGuard.permissionsFor(body)) await this.access.assert(actor, record.project_key, permission);
    const project = await this.projects.findByKey(record.project_key);
    const resolved = await this.resolver.resolve(body, { existing: record, project });
    await this.db.tx(async () => {
      await this.applyChanges(actor, record, resolved);
      if (body.customFields && this.customFields) await this.customFields.applyValues(actor, record, body.customFields);
    });
    return this.issues.findById(record.id);
  }

  /**
   * Applies a resolved change set to an issue_view row. Returns the changed field names.
   * Must run inside a transaction.
   */
  async applyChanges(actor, record, resolved) {
    const changed = Object.keys(resolved.fields).filter((field) => !I.sameValue(record[field], resolved.fields[field]));
    if (!changed.length) return [];
    const columns = { ...resolved.columns };

    // Resolution follows the status category: entering "done" resolves, leaving it re-opens.
    const finalCategory = changed.includes('status') ? resolved.statusCategory : record.status_category;
    if (changed.includes('status')) {
      if (I.isDoneCategory(finalCategory)) {
        columns.resolved_at = record.resolved_at || nowIso();
        if (columns.resolution_id == null) columns.resolution_id = record.resolution_id || (await this.catalog.defaultResolution())?.id || null;
      } else {
        columns.resolved_at = null;
        columns.resolution_id = null;
      }
    } else if (columns.resolution_id && !I.isDoneCategory(finalCategory)) {
      throw bad('A resolution can only be set on work items in a done status.');
    }

    if (Object.keys(columns).length) await this.issues.update(record.id, columns);
    else await this.issues.touch(record.id);
    if (changed.includes('labels')) await this.issues.setLabels(record.id, resolved.labels);
    if (changed.includes('components')) await this.issues.setComponents(record.id, resolved.componentIds);

    await this.recordHistory(actor, record, resolved.fields, changed, columns);

    const after = { ...record, ...resolved.fields };
    if (changed.includes('assignee_id') && after.assignee_id) {
      await this.issues.watch(record.id, after.assignee_id);
      await this.notifications.notify({ issue: after, actorId: actor.id, type: 'assigned', message: `assigned ${record.key} to you`, only: [after.assignee_id] });
    }
    if (changed.includes('status')) {
      await this.notifications.notify({ issue: after, actorId: actor.id, type: 'status', message: `changed ${record.key} from ${record.status} to ${after.status}` });
    }
    await this.bus.publish('issue_updated', { key: record.key, before: record, changed, actorId: actor.id });
    return changed;
  }

  async recordHistory(actor, record, fields, changed, columns) {
    const at = nowIso();
    const userIds = [record.assignee_id, fields.assignee_id, record.reporter_id, fields.reporter_id];
    const [userNames, issueKeys, teamNames] = await Promise.all([
      this.users.namesByIds(userIds),
      this.issues.keysByIds([record.parent_id, fields.parent_id]),
      changed.includes('team_id') ? this.teamNames([record.team_id, fields.team_id]) : {},
    ]);
    const display = (field, value) => {
      const names = { assignee_id: userNames[value], reporter_id: userNames[value], parent_id: issueKeys[value], team_id: teamNames[value] };
      return I.historyValue(field, value, { formatDuration, names });
    };
    for (const field of changed) {
      await this.issues.addHistory({
        issueId: record.id, authorId: actor.id, field: I.HISTORY_LABEL[field] || field,
        from: display(field, record[field]), to: display(field, fields[field]), at,
      });
    }
    // Implicit resolution change caused by a transition
    if (!changed.includes('resolution') && 'resolution_id' in columns && columns.resolution_id !== record.resolution_id) {
      const resolution = columns.resolution_id ? (await this.catalog.snapshot()).resolutions.find((r) => r.id === columns.resolution_id)?.name : null;
      await this.issues.addHistory({ issueId: record.id, authorId: actor.id, field: 'resolution', from: record.resolution, to: resolution, at });
    }
  }

  async teamNames(ids) {
    const out = {};
    for (const id of ids.filter(Boolean)) out[id] = (await this.teams.find(id))?.name ?? String(id);
    return out;
  }

  /** Convenience change sets used by sprints, releases and user deactivation. */
  setSprint(actor, record, sprint) {
    return this.applyChanges(actor, record, { fields: { sprint: sprint?.name ?? null }, columns: { sprint_id: sprint?.id ?? null } });
  }

  setFixVersion(actor, record, version) {
    return this.applyChanges(actor, record, { fields: { fix_version: version?.name ?? null }, columns: { fix_version_id: version?.id ?? null } });
  }

  async unassignOpenWork(actor, userId) {
    const rows = await this.issues.openAssignedTo(userId);
    for (const row of rows) await this.applyChanges(actor, row, { fields: { assignee_id: null }, columns: { assignee_id: null } });
    return rows.length;
  }

  /* ---------- workflow transitions ---------- */
  async transitions(actor, key) {
    const record = await this.guard.load(actor, key);
    const project = await this.projects.findByKey(record.project_key);
    const workflow = await this.catalog.workflowForProject(project);
    const byId = new Map(workflow.statuses.map((s) => [s.id, s]));
    return {
      status: { id: record.status_id, name: record.status, category: record.status_category },
      transitions: W.availableTransitions(workflow, record.status_id).map((t) => ({
        id: t.id, name: t.name || byId.get(t.toStatusId)?.name,
        to: { id: t.toStatusId, name: byId.get(t.toStatusId)?.name, category: byId.get(t.toStatusId)?.category },
      })),
    };
  }

  /** POST /issues/:key/transitions { transitionId | to, resolution? } */
  async transition(actor, key, { transitionId, to, resolution } = {}) {
    const { transitions } = await this.transitions(actor, key);
    const target = transitions.find((t) => (transitionId != null && String(t.id) === String(transitionId))
      || (to && t.to.name.toLowerCase() === String(to).toLowerCase()));
    if (!target) throw bad('That transition isn’t available for this work item.');
    return this.update(actor, key, { status: target.to.name, ...(resolution !== undefined ? { resolution } : {}) });
  }

  /* ---------- delete ---------- */
  async delete(actor, key) {
    const record = await this.guard.load(actor, key, 'DELETE_ISSUES');
    return this.db.tx(async () => {
      const entry = await this.trash.moveToTrash(actor, record);
      await this.audit.record(actor, 'issue.deleted', { project: record.project_key, target: record.key, details: { summary: record.summary, trashId: entry.id } });
      await this.bus.publish('issue_deleted', { key: record.key, before: record, actorId: actor.id });
      return { ok: true, trashId: entry.id, recycleBin: true };
    });
  }

  /* ---------- clone ---------- */
  async clone(actor, key) {
    const record = await this.guard.load(actor, key, 'CREATE_ISSUES');
    const project = await this.projects.findByKey(record.project_key);
    return this.db.tx(async () => {
      const copy = await this.createInProject(actor, project, {
        type: record.type, summary: `CLONE - ${record.summary}`.slice(0, I.MAX_SUMMARY), description: record.description,
        priority: record.priority, assigneeId: record.assignee_id, labels: record.labels, dueDate: record.due_date,
        startDate: record.start_date, fixVersion: record.fix_version_status === 'archived' ? null : record.fix_version,
        storyPoints: record.story_points, sprint: record.sprint_state === 'closed' ? null : record.sprint,
        parentKey: record.parent_key, components: record.components, teamId: record.team_id, afterKey: record.key,
      });
      await this.links.insert({ sourceId: copy.id, targetId: record.id, type: 'clones', createdBy: actor.id });
      return this.issues.findById(copy.id);
    });
  }

  /* ---------- bulk ---------- */
  async bulk(actor, { keys, changes, action } = {}) {
    if (!Array.isArray(keys) || !keys.length) throw bad('No work items selected.');
    if (keys.length > MAX_BULK) throw bad(`You can change at most ${MAX_BULK} work items at once.`);
    const rows = [];
    for (const key of keys) {
      const row = await this.issues.findByKey(String(key));
      if (row && (await this.access.can(actor, row.project_key, 'BROWSE_PROJECT'))) rows.push(row);
    }
    const needs = action === 'delete' ? ['DELETE_ISSUES'] : IssueGuard.permissionsFor(changes);
    const denied = [];
    for (const row of rows) {
      for (const permission of needs) {
        if (!(await this.access.can(actor, row.project_key, permission))) { denied.push(row.key); break; }
      }
    }
    if (denied.length) {
      throw forbidden(`You don’t have permission to change ${denied.slice(0, 5).join(', ')}${denied.length > 5 ? ` and ${denied.length - 5} more` : ''}.`);
    }

    let count = 0;
    const projects = new Map();
    await this.db.tx(async () => {
      for (const { id } of rows) {
        const row = await this.issues.findById(id);
        if (!row) continue; // already removed as a sub-task of another selected item
        if (action === 'delete') {
          const entry = await this.trash.moveToTrash(actor, row);
          await this.audit.record(actor, 'issue.deleted', { project: row.project_key, target: row.key, details: { summary: row.summary, bulk: true, trashId: entry.id } });
          await this.bus.publish('issue_deleted', { key: row.key, before: row, actorId: actor.id });
          count += 1;
        } else {
          if (!projects.has(row.project_key)) projects.set(row.project_key, await this.projects.findByKey(row.project_key));
          const resolved = await this.resolver.resolve(changes || {}, { existing: row, project: projects.get(row.project_key) });
          if ((await this.applyChanges(actor, row, resolved)).length) count += 1;
        }
      }
    });
    return { ok: true, count };
  }

  /* ---------- rank (cf[10019]) ---------- */
  async rank(actor, key, { beforeKey, afterKey } = {}) {
    const record = await this.guard.load(actor, key, 'EDIT_ISSUES');
    if (!beforeKey && !afterKey) throw bad('beforeKey or afterKey is required.');
    if (String(beforeKey || afterKey).toUpperCase() !== record.key) {
      await this.db.tx(async () => this.issues.setRank(record.id, await this.computeRank({ beforeKey, afterKey, movingId: record.id })));
    }
    return this.issues.findById(record.id);
  }

  async computeRank({ beforeKey, afterKey, movingId = 0 }) {
    const reference = await this.issues.rankOf(beforeKey || afterKey);
    if (!reference) throw bad('Reference work item not found.');
    const value = beforeKey
      ? rank.between(await this.issues.neighbourBelow(reference.rank, movingId), reference.rank)
      : rank.between(reference.rank, await this.issues.neighbourAbove(reference.rank, movingId));
    if (value !== null) return value;
    await this.issues.rebalanceRanks();
    return this.computeRank({ beforeKey, afterKey, movingId });
  }

  /* ---------- watchers ---------- */
  async watch(actor, key) {
    const record = await this.guard.load(actor, key);
    await this.issues.watch(record.id, actor.id);
    return { watching: true };
  }

  async unwatch(actor, key) {
    const record = await this.guard.load(actor, key);
    await this.issues.unwatch(record.id, actor.id);
    return { watching: false };
  }
}

module.exports = { IssueService };
