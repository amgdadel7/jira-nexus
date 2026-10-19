'use strict';

/**
 * Read-model of the Jira configuration (types, priorities, resolutions,
 * statuses, workflows) cached in memory. Admin use cases call invalidate()
 * after every change; lookups are case-insensitive by name.
 */
class CatalogService {
  constructor({ configRepo }) {
    this.repo = configRepo;
    this.cache = null;
  }

  invalidate() {
    this.cache = null;
  }

  async snapshot() {
    if (this.cache) return this.cache;
    const [types, priorities, resolutions, statuses, workflows, wfStatuses, wfTransitions] = await Promise.all([
      this.repo.list('issue_types'), this.repo.list('priorities'), this.repo.list('resolutions'), this.repo.list('statuses'),
      this.repo.listWorkflows(), this.repo.listWorkflowStatuses(), this.repo.listWorkflowTransitions(),
    ]);
    const byWorkflow = new Map(workflows.map((w) => [w.id, {
      id: w.id, name: w.name, description: w.description, isDefault: w.is_default, created: w.created_at, updated: w.updated_at,
      statuses: [], transitions: [],
    }]));
    for (const s of wfStatuses) {
      byWorkflow.get(s.workflow_id)?.statuses.push({ id: s.status_id, name: s.name, category: s.category, position: s.position, isInitial: s.is_initial });
    }
    for (const t of wfTransitions) {
      byWorkflow.get(t.workflow_id)?.transitions.push({ id: t.id, name: t.name, fromStatusId: t.from_status_id, toStatusId: t.to_status_id });
    }
    this.cache = {
      types, priorities, resolutions, statuses, workflows: byWorkflow,
      defaultWorkflowId: workflows.find((w) => w.is_default)?.id ?? workflows[0]?.id ?? null,
    };
    return this.cache;
  }

  static byName(list, name) {
    const lower = String(name ?? '').toLowerCase();
    return list.find((x) => x.name.toLowerCase() === lower) || null;
  }

  async typeByName(name) { return CatalogService.byName((await this.snapshot()).types, name); }

  async priorityByName(name) { return CatalogService.byName((await this.snapshot()).priorities, name); }

  async statusByName(name) { return CatalogService.byName((await this.snapshot()).statuses, name); }

  async resolutionByName(name) { return CatalogService.byName((await this.snapshot()).resolutions, name); }

  async defaultPriority() {
    const { priorities } = await this.snapshot();
    return priorities.find((p) => p.is_default) || priorities[Math.floor(priorities.length / 2)];
  }

  async defaultResolution() {
    const { resolutions } = await this.snapshot();
    return resolutions.find((r) => r.is_default) || resolutions[0] || null;
  }

  async workflow(id) {
    const snap = await this.snapshot();
    return snap.workflows.get(id) || snap.workflows.get(snap.defaultWorkflowId);
  }

  async workflowForProject(project) {
    return this.workflow(project?.workflow_id);
  }

  async defaultWorkflowId() {
    return (await this.snapshot()).defaultWorkflowId;
  }
}

module.exports = { CatalogService };
