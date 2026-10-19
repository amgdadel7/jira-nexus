'use strict';

const { GOAL_STATUSES, cleanDate } = require('../../domain/issue');
const { bad, notFound } = require('../../shared/errors');

class GoalService {
  constructor({ db, access, guard, goalRepo, userRepo }) {
    Object.assign(this, { db, access, guard, goals: goalRepo, users: userRepo });
  }

  async fields(body) {
    const out = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Goal name is required.');
      out.name = name.slice(0, 200);
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 5000);
    if (body.status !== undefined) {
      if (!GOAL_STATUSES.includes(body.status)) throw bad('Invalid goal status.');
      out.status = body.status;
    }
    if (body.ownerId !== undefined) {
      if (body.ownerId && !(await this.users.findById(body.ownerId))) throw bad('Unknown user.');
      out.owner_id = body.ownerId || null;
    }
    if (body.targetDate !== undefined) out.target_date = cleanDate(body.targetDate);
    return out;
  }

  /** Goal with the linked items the actor can see and progress over those items + children. */
  async view(actor, goal) {
    const issues = [];
    for (const issue of await this.goals.issues(goal.id)) {
      if (await this.access.can(actor, issue.project_key, 'BROWSE_PROJECT')) issues.push(issue);
    }
    const { total, done } = await this.goals.progress(issues.map((i) => i.id));
    return { goal, issues, progress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 } };
  }

  async require(id) {
    const goal = await this.goals.find(id);
    if (!goal) throw notFound('Goal not found.');
    return goal;
  }

  async list(actor) {
    const out = [];
    for (const goal of await this.goals.list()) out.push(await this.view(actor, goal));
    return out;
  }

  async get(actor, id) {
    return this.view(actor, await this.require(id));
  }

  async create(actor, body = {}) {
    await this.access.assertGlobal(actor, 'MANAGE_GOALS');
    const fields = await this.fields({ status: 'pending', ownerId: actor.id, ...body });
    if (!fields.name) throw bad('Goal name is required.');
    return this.view(actor, await this.goals.insert(fields));
  }

  async update(actor, id, body = {}) {
    await this.access.assertGlobal(actor, 'MANAGE_GOALS');
    const goal = await this.require(id);
    const fields = await this.fields(body);
    return this.view(actor, Object.keys(fields).length ? await this.goals.update(goal.id, fields) : goal);
  }

  async remove(actor, id) {
    await this.access.assertGlobal(actor, 'MANAGE_GOALS');
    await this.goals.delete((await this.require(id)).id);
    return { ok: true };
  }

  async link(actor, id, key) {
    await this.access.assertGlobal(actor, 'MANAGE_GOALS');
    const goal = await this.require(id);
    const issue = await this.guard.load(actor, String(key || ''));
    await this.goals.link(goal.id, issue.id);
    return this.view(actor, await this.goals.update(goal.id, {}));
  }

  async unlink(actor, id, key) {
    await this.access.assertGlobal(actor, 'MANAGE_GOALS');
    const goal = await this.require(id);
    const issue = await this.guard.load(actor, key);
    await this.goals.unlink(goal.id, issue.id);
    return this.view(actor, goal);
  }
}

module.exports = { GoalService };
