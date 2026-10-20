'use strict';

const { bad, notFound } = require('../../shared/errors');
const { parseDuration, formatDuration } = require('../../domain/duration');

const MAX_LOG = 7 * 24 * 3600;

/** Time tracking: log work, edit/delete worklogs and keep time spent / remaining estimate in sync (Jira's estimate adjustment modes). */
class WorklogService {
  constructor({ db, bus, access, guard, resolver, worklogRepo, issueRepo, projectRepo, issueService }) {
    Object.assign(this, { db, bus, access, guard, resolver, issueService, repo: worklogRepo, issues: issueRepo, projects: projectRepo });
  }

  static parseSpent(value) {
    let seconds;
    try { seconds = parseDuration(value); } catch (err) { throw bad(err.message); }
    if (!seconds || seconds < 60) throw bad('Time spent must be at least 1m.');
    if (seconds > MAX_LOG) throw bad('You can log at most 1 week of time at once.');
    return seconds;
  }

  static parseStarted(value) {
    if (!value) return new Date().toISOString();
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw bad('Date started is invalid.');
    if (d.getTime() > Date.now() + 365 * 864e5) throw bad('Date started is too far in the future.');
    return d.toISOString();
  }

  /** New remaining estimate for an adjustment mode (undefined = leave unchanged). */
  static remainingAfter(record, mode, delta, value) {
    const current = record.remaining_estimate ?? null;
    const parse = (v) => {
      try { return parseDuration(v); } catch (err) { throw bad(err.message); }
    };
    switch (mode || 'auto') {
      case 'leave': return undefined;
      case 'new': {
        const seconds = parse(value);
        if (seconds === null) throw bad('Enter the new remaining estimate.');
        return seconds;
      }
      case 'manual': return current === null ? undefined : Math.max(0, current - (parse(value) || 0));
      case 'auto': return current === null ? undefined : Math.max(0, current - delta);
      default: throw bad("adjustEstimate must be 'auto', 'leave', 'new' or 'manual'.");
    }
  }

  async list(actor, key) {
    const record = await this.guard.load(actor, key);
    const worklogs = (await this.repo.list(record.id)).map((w) => ({ ...w, issue_key: record.key }));
    return { worklogs, total: record.time_spent || 0, originalEstimate: record.original_estimate ?? null, remainingEstimate: record.remaining_estimate ?? null };
  }

  /** Recomputes time spent (with history) and applies a remaining-estimate change. */
  async syncTotals(actor, record, remaining) {
    const spent = await this.repo.syncTimeSpent(record.id);
    if (spent !== (record.time_spent || 0)) {
      await this.issues.addHistory({ issueId: record.id, authorId: actor.id, field: 'time spent', from: formatDuration(record.time_spent || 0), to: formatDuration(spent) });
    }
    if (remaining !== undefined && remaining !== (record.remaining_estimate ?? null)) {
      const project = await this.projects.findByKey(record.project_key);
      const resolved = await this.resolver.resolve({ remainingEstimate: remaining }, { existing: { ...record, time_spent: spent }, project });
      await this.issueService.applyChanges(actor, record, resolved);
    } else {
      await this.issues.touch(record.id);
    }
  }

  async add(actor, key, body = {}) {
    const record = await this.guard.load(actor, key, 'WORK_ON_ISSUES');
    const seconds = WorklogService.parseSpent(body.timeSpent);
    const started = WorklogService.parseStarted(body.started);
    const comment = String(body.comment || '').trim().slice(0, 5000);
    const remaining = WorklogService.remainingAfter(record, body.adjustEstimate, seconds, body.newEstimate ?? body.reduceBy);
    const worklog = await this.db.tx(async () => {
      const row = await this.repo.insert({ issueId: record.id, authorId: actor.id, startedAt: started, timeSpent: seconds, comment });
      await this.syncTotals(actor, record, remaining);
      await this.bus.publish('worklog_created', {
        key: record.key, actorId: actor.id,
        worklog: {
          id: String(row.id), issueId: String(record.id), timeSpent: formatDuration(seconds), timeSpentSeconds: seconds,
          started, comment, author: { accountId: actor.id, displayName: actor.user?.name },
        },
      });
      return row;
    });
    return { worklog: { ...worklog, issue_key: record.key }, issue: await this.issues.findById(record.id) };
  }

  async loadOwn(actor, id) {
    const worklog = await this.repo.find(id);
    if (!worklog) throw notFound('Worklog not found.');
    const record = await this.guard.load(actor, worklog.issue_key);
    await this.access.assert(actor, record.project_key, worklog.author_id === actor.id ? 'WORK_ON_ISSUES' : 'EDIT_ALL_WORKLOGS');
    return { worklog, record };
  }

  async update(actor, id, body = {}) {
    const { worklog, record } = await this.loadOwn(actor, id);
    const fields = {};
    if (body.timeSpent !== undefined) fields.time_spent = WorklogService.parseSpent(body.timeSpent);
    if (body.started !== undefined) fields.started_at = WorklogService.parseStarted(body.started);
    if (body.comment !== undefined) fields.comment = String(body.comment || '').trim().slice(0, 5000);
    const delta = (fields.time_spent ?? worklog.time_spent) - worklog.time_spent;
    const remaining = 'time_spent' in fields ? WorklogService.remainingAfter(record, body.adjustEstimate, delta, body.newEstimate) : undefined;
    const updated = await this.db.tx(async () => {
      const row = Object.keys(fields).length ? await this.repo.update(worklog.id, fields) : worklog;
      await this.syncTotals(actor, record, remaining);
      return row;
    });
    return { worklog: { ...updated, issue_key: record.key }, issue: await this.issues.findById(record.id) };
  }

  async remove(actor, id, mode = 'auto') {
    const { worklog, record } = await this.loadOwn(actor, id);
    // Deleting work gives the time back to the remaining estimate (Jira's "Automatically adjust").
    const remaining = mode === 'leave' || record.remaining_estimate === null ? undefined : record.remaining_estimate + worklog.time_spent;
    await this.db.tx(async () => {
      await this.repo.delete(worklog.id);
      await this.syncTotals(actor, record, remaining);
    });
    return { ok: true, issue: await this.issues.findById(record.id) };
  }
}

module.exports = { WorklogService };
