'use strict';

const { bad, notFound, forbidden } = require('../../shared/errors');
const { DATE_RE } = require('../../domain/issue');
const { addDays, today } = require('../../shared/time');

const SPRINT_DAYS = 14;

/** Scrum sprints: plan in the backlog, start one at a time, complete and carry over open work. */
class SprintService {
  constructor({ db, bus, access, guard, sprintRepo, issueRepo, issueService }) {
    Object.assign(this, { db, bus, access, guard, sprints: sprintRepo, issues: issueRepo, issueService });
  }

  async withStats(rows) {
    const stats = await this.sprints.stats(rows.map((s) => s.id));
    return rows.map((sprint) => ({ sprint, stats: stats.get(sprint.id) || { total: 0, done: 0, in_progress: 0, points: 0, done_points: 0 } }));
  }

  async one(id) {
    return (await this.withStats([await this.require(id)]))[0];
  }

  async require(id) {
    const sprint = await this.sprints.find(id);
    if (!sprint) throw notFound('Sprint not found.');
    return sprint;
  }

  async list(actor, { project, state } = {}) {
    const states = String(state || '').split(',').filter(Boolean);
    const projectKey = project ? (await this.access.assert(actor, project)).key : null;
    const projectKeys = projectKey ? null : await this.access.browsableKeys(actor);
    return this.withStats(await this.sprints.list({ projectKey, projectKeys, states }));
  }

  async get(actor, id) {
    const sprint = await this.require(id);
    await this.access.assert(actor, sprint.project_key);
    return this.one(sprint.id);
  }

  async cleanName(name, exceptId = 0) {
    const n = String(name || '').trim();
    if (!n) throw bad('Sprint name is required.');
    if (n.length > 60) throw bad('Sprint name must be 60 characters or less.');
    if (await this.sprints.nameTaken(n, exceptId)) throw bad('A sprint with that name already exists.');
    return n;
  }

  static checkDates(start, end) {
    if ((start && !DATE_RE.test(start)) || (end && !DATE_RE.test(end))) throw bad('Dates must be yyyy-MM-dd.');
    if (start && end && end < start) throw bad('The end date must be after the start date.');
  }

  async create(actor, body = {}) {
    const project = await this.access.assert(actor, body.projectKey || 'KAN', 'MANAGE_SPRINTS');
    const name = await this.cleanName(body.name || (await this.sprints.nextName(project.key)));
    const { goal = '', startDate = null, endDate = null } = body;
    SprintService.checkDates(startDate, endDate);
    const row = await this.sprints.insert({
      project_key: project.key, name, goal: String(goal).slice(0, 500), state: 'future',
      start_date: startDate || null, end_date: endDate || null, position: await this.sprints.nextPosition(),
    });
    return this.one(row.id);
  }

  async update(actor, id, body = {}) {
    const sprint = await this.require(id);
    await this.access.assert(actor, sprint.project_key, 'MANAGE_SPRINTS');
    const fields = {};
    if (body.name !== undefined) fields.name = await this.cleanName(body.name, sprint.id);
    if (body.goal !== undefined) fields.goal = String(body.goal || '').slice(0, 500);
    if (body.startDate !== undefined) fields.start_date = body.startDate || null;
    if (body.endDate !== undefined) fields.end_date = body.endDate || null;
    SprintService.checkDates(fields.start_date !== undefined ? fields.start_date : sprint.start_date, fields.end_date !== undefined ? fields.end_date : sprint.end_date);
    if (sprint.state === 'active' && (fields.start_date === null || fields.end_date === null)) throw bad('An active sprint needs a start and end date.');
    if (Object.keys(fields).length) await this.sprints.update(sprint.id, fields); // issues reference the sprint by id, so renames are free
    return this.one(sprint.id);
  }

  async start(actor, id, body = {}) {
    const sprint = await this.require(id);
    await this.access.assert(actor, sprint.project_key, 'MANAGE_SPRINTS');
    if (sprint.state !== 'future') throw bad(sprint.state === 'active' ? 'This sprint has already started.' : 'This sprint is already complete.');
    const active = await this.sprints.active(sprint.project_key);
    if (active) throw bad(`'${active.name}' is still active. Complete it before starting another sprint.`);
    const totals = await this.sprints.totals(sprint.id);
    if (!totals.count) throw bad('Add at least one work item to the sprint before starting it.');
    const name = body.name !== undefined ? await this.cleanName(body.name, sprint.id) : sprint.name;
    const startDate = body.startDate || sprint.start_date || today();
    const endDate = body.endDate || sprint.end_date || addDays(startDate, SPRINT_DAYS);
    SprintService.checkDates(startDate, endDate);
    const updated = await this.db.tx(async () => {
      const row = await this.sprints.update(sprint.id, {
        state: 'active', name, goal: body.goal !== undefined ? String(body.goal || '').slice(0, 500) : sprint.goal,
        start_date: startDate, end_date: endDate, committed_points: totals.points, committed_count: totals.count,
      });
      await this.bus.publish('sprint_started', { actorId: actor.id, sprint: { id: row.id, name: row.name, state: row.state, goal: row.goal, startDate: row.start_date, endDate: row.end_date, originBoardId: row.project_key } });
      return row;
    });
    return this.one(updated.id);
  }

  /** Completes the active sprint; open work moves to a future sprint, a new sprint ('new') or the backlog (null). */
  async complete(actor, id, { moveTo = null } = {}) {
    const sprint = await this.require(id);
    await this.access.assert(actor, sprint.project_key, 'MANAGE_SPRINTS');
    if (sprint.state !== 'active') throw bad('Only an active sprint can be completed.');
    const result = await this.db.tx(async () => {
      let target = null;
      let created = null;
      if (moveTo === 'new') {
        created = await this.sprints.insert({ project_key: sprint.project_key, name: await this.sprints.nextName(sprint.project_key), state: 'future', position: await this.sprints.nextPosition() });
        target = created;
      } else if (moveTo !== null && moveTo !== '' && moveTo !== undefined) {
        target = await this.require(moveTo);
        if (target.state !== 'future') throw bad('Open work items can only move to a future sprint or the backlog.');
        if (target.project_key !== sprint.project_key) throw bad('That sprint belongs to another project.');
      }
      const done = await this.sprints.totals(sprint.id, { category: 'done' });
      const open = await this.issues.inSprint(sprint.id, { open: true, belowEpic: true });
      let moved = 0;
      for (const row of open) if ((await this.issueService.setSprint(actor, row, target)).length) moved += 1;
      await this.sprints.update(sprint.id, { state: 'closed', completed_at: new Date().toISOString(), completed_points: done.points, completed_count: done.count });
      await this.bus.publish('sprint_closed', { actorId: actor.id, sprint: { id: sprint.id, name: sprint.name, state: 'closed', goal: sprint.goal, originBoardId: sprint.project_key, movedOpenItems: moved, movedTo: target?.name || null } });
      return { moved, target, created };
    });
    return { sprint: await this.one(sprint.id), moved: result.moved, movedTo: result.target?.name || null, newSprint: result.created ? await this.one(result.created.id) : null };
  }

  async remove(actor, id) {
    const sprint = await this.require(id);
    await this.access.assert(actor, sprint.project_key, 'MANAGE_SPRINTS');
    if (sprint.state !== 'future') throw bad('Only sprints that have not started can be deleted.');
    await this.db.tx(async () => {
      for (const row of await this.issues.inSprint(sprint.id)) await this.issueService.setSprint(actor, row, null);
      await this.sprints.delete(sprint.id);
    });
    return { ok: true };
  }

  /** { keys: [...], sprintId: number | null } – move work items into a sprint or the backlog. */
  async move(actor, { keys, sprintId } = {}) {
    if (!Array.isArray(keys) || !keys.length) throw bad('No work items selected.');
    let sprint = null;
    if (sprintId !== null && sprintId !== undefined) {
      sprint = await this.require(sprintId);
      if (sprint.state === 'closed') throw bad('You cannot add work to a completed sprint.');
    }
    const rows = [];
    for (const key of keys) rows.push(await this.guard.load(actor, String(key)));
    const denied = [];
    for (const row of rows) if (!(await this.access.can(actor, row.project_key, 'EDIT_ISSUES'))) denied.push(row.key);
    if (denied.length) throw forbidden(`You don’t have permission to plan ${denied.slice(0, 5).join(', ')}.`);
    if (sprint && rows.some((r) => r.project_key !== sprint.project_key)) throw bad('Work items can only be added to sprints in their own project.');
    let moved = 0;
    await this.db.tx(async () => {
      for (const row of rows.filter((r) => r.hierarchy_level < 1)) {
        if (row.sprint_id !== (sprint?.id ?? null) && (await this.issueService.setSprint(actor, row, sprint)).length) moved += 1;
      }
    });
    return { ok: true, moved };
  }
}

module.exports = { SprintService };
