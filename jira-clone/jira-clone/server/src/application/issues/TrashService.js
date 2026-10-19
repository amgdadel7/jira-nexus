'use strict';

const { conflict, notFound } = require('../../shared/errors');
const { DAY } = require('../../shared/time');

/** Child rows that reference something which may have disappeared since the delete. */
const CHILD_REFERENCES = {
  watchers: ['users', 'user_id'], votes: ['users', 'user_id'], goal_issues: ['goals', 'goal_id'],
  issue_components: ['components', 'component_id'], issue_labels: ['labels', 'label_id'],
  custom_field_values: ['custom_fields', 'field_id'],
};
const OPTIONAL_REFERENCES = [
  ['sprint_id', 'sprints'], ['fix_version_id', 'versions'], ['team_id', 'teams'],
  ['assignee_id', 'users'], ['reporter_id', 'users'], ['resolution_id', 'resolutions'],
];

/**
 * Recycle bin: deleting a work item stores a full snapshot (with sub-tasks,
 * comments, history, files …) so it can be restored exactly. Files stay on
 * disk until the entry is purged; entries expire after the plan's retention.
 */
class TrashService {
  constructor({ db, access, billing, audit, trashRepo, issueRepo, catalog, projectRepo, storage }) {
    Object.assign(this, { db, access, billing, audit, repo: trashRepo, issues: issueRepo, catalog, projects: projectRepo, storage });
  }

  /** Moves an issue (issue_view row) and its sub-tasks to the bin. */
  moveToTrash(actor, record) {
    return this.db.tx(async () => {
      const ids = [record.id, ...(await this.issues.subtaskIds(record.id))];
      const snapshot = await this.repo.snapshot(ids);
      snapshot.meta = { rootId: record.id, status: record.status, assigneeId: record.assignee_id };
      const files = snapshot.attachments.map((a) => a.stored_name);
      const id = await this.repo.insert({
        projectKey: record.project_key, issueKey: record.key, summary: record.summary, type: record.type,
        snapshot, files, deletedBy: actor.id,
      });
      await this.issues.deleteMany(ids);
      return { id, count: ids.length };
    });
  }

  async list(actor, projectKey) {
    const project = await this.access.assert(actor, projectKey || 'KAN', 'DELETE_ISSUES');
    await this.purgeExpired();
    return {
      retentionDays: await this.billing.retentionDays(),
      canPurge: await this.access.can(actor, project.key, 'ADMINISTER_PROJECT'),
      items: await this.repo.list(project.key),
    };
  }

  async entry(id) {
    const entry = await this.repo.find(id);
    if (!entry) throw notFound('That item is no longer in the recycle bin.');
    return entry;
  }

  async restore(actor, id) {
    const entry = await this.entry(id);
    await this.access.assert(actor, entry.project_key, 'DELETE_ISSUES');
    const key = await this.db.tx(() => this.restoreEntry(entry));
    await this.audit.record(actor, 'issue.restored', { project: entry.project_key, target: key, details: { summary: entry.summary } });
    return key;
  }

  async restoreEntry(entry) {
    const snap = entry.snapshot;
    const project = await this.projects.findByKey(entry.project_key);
    if (!project) throw conflict('The project no longer exists.');
    for (const issue of snap.issues) {
      if (await this.issues.findByKey(issue.key)) throw conflict(`${issue.key} already exists.`);
    }
    const rootId = snap.meta?.rootId ?? snap.issues[0].id;
    const ids = new Set(snap.issues.map((i) => i.id));
    const ordered = [...snap.issues].sort((a, b) => (a.id === rootId ? -1 : b.id === rootId ? 1 : a.id - b.id));
    const workflow = await this.catalog.workflowForProject(project);
    for (const issue of ordered) {
      const row = { ...issue };
      if (row.parent_id && !ids.has(row.parent_id) && !(await this.repo.exists('issues', 'id', row.parent_id))) row.parent_id = null;
      for (const [column, table] of OPTIONAL_REFERENCES) {
        if (row[column] && !(await this.repo.exists(table, 'id', row[column]))) row[column] = null;
      }
      if (!workflow.statuses.some((s) => s.id === row.status_id)) row.status_id = workflow.statuses[0].id;
      await this.repo.insertRow('issues', row);
    }
    for (const table of this.repo.childTables) {
      for (const row of snap[table] || []) {
        const ref = CHILD_REFERENCES[table];
        if (ref && !(await this.repo.exists(ref[0], 'id', row[ref[1]]))) continue;
        await this.repo.insertRow(table, row);
      }
    }
    for (const link of snap.issue_links || []) {
      if (await this.repo.exists('issues', 'id', link.source_id) && await this.repo.exists('issues', 'id', link.target_id)) {
        await this.repo.insertRow('issue_links', link);
      }
    }
    for (const orphanId of snap.orphaned || []) {
      await this.repo.reparent(orphanId, rootId);
    }
    await this.issues.addHistory({ issueId: rootId, authorId: null, field: 'restored', to: 'from recycle bin' });
    await this.repo.delete(entry.id);
    return entry.issue_key;
  }

  async purge(actor, id) {
    const entry = await this.entry(id);
    await this.access.assert(actor, entry.project_key, 'ADMINISTER_PROJECT');
    await this.purgeEntry(entry);
    await this.audit.record(actor, 'issue.purged', { project: entry.project_key, target: entry.issue_key, details: { summary: entry.summary } });
  }

  async purgeEntry(entry) {
    for (const file of entry.files || []) this.storage.remove(file);
    await this.repo.delete(entry.id);
  }

  async purgeExpired() {
    const cutoff = new Date(Date.now() - (await this.billing.retentionDays()) * DAY).toISOString();
    const expired = await this.repo.olderThan(cutoff);
    for (const entry of expired) await this.purgeEntry(entry);
    return expired.length;
  }
}

module.exports = { TrashService };
