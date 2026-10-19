'use strict';

const { bad, notFound } = require('../../shared/errors');
const { clampInt } = require('../../shared/validation');
const { DATE_RE } = require('../../domain/issue');
const { HOURS_PER_DAY, DAYS_PER_WEEK } = require('../../domain/duration');

const DAY = 864e5;
const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const points = (items) => items.reduce((total, x) => total + (x.story_points || 0), 0);

/** Velocity, cumulative flow, sprint report (with burndown) and timesheet. */
class ReportService {
  constructor({ access, catalog, reportRepo, sprintRepo }) {
    Object.assign(this, { access, catalog, repo: reportRepo, sprints: sprintRepo });
  }

  async project(actor, key) {
    return this.access.assert(actor, String(key || 'KAN').toUpperCase(), 'BROWSE_PROJECT');
  }

  async members(sprint) {
    const [current, movedOut] = await Promise.all([this.repo.sprintItems(sprint.id), this.repo.movedOutOf(sprint)]);
    return { current, movedOut };
  }

  async velocity(actor, { project: key, sprints: count } = {}) {
    const project = await this.project(actor, key);
    const rows = await this.repo.closedSprints(project.key, clampInt(count, 7, 1, 12));
    const sprints = [];
    for (const s of rows) {
      const { current, movedOut } = await this.members(s);
      sprints.push({
        id: s.id, name: s.name, startDate: s.start_date, endDate: s.end_date, completedAt: s.completed_at,
        committed: s.committed_points ?? points(current) + points(movedOut),
        completed: s.completed_points ?? points(current.filter((x) => x.status_category === 'done')),
      });
    }
    const average = sprints.length ? Math.round((sprints.reduce((t, s) => t + s.completed, 0) / sprints.length) * 10) / 10 : 0;
    return { project: project.key, sprints, averageVelocity: average };
  }

  async cumulativeFlow(actor, { project: key, days: count } = {}) {
    const project = await this.project(actor, key);
    const days = clampInt(count, 30, 7, 90);
    const workflow = await this.catalog.workflowForProject(project);
    const statuses = workflow.statuses.map((s) => s.name);
    const [items, changes] = await Promise.all([this.repo.flowItems(project.key), this.repo.statusChanges(project.key)]);
    const byIssue = new Map();
    for (const c of changes) {
      if (!byIssue.has(c.issue_id)) byIssue.set(c.issue_id, []);
      byIssue.get(c.issue_id).push(c);
    }
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const dates = [];
    const series = Object.fromEntries(statuses.map((s) => [s, []]));
    for (let i = days - 1; i >= 0; i -= 1) {
      const end = addDays(today, -i).toISOString();
      dates.push(end.slice(0, 10));
      const counts = Object.fromEntries(statuses.map((s) => [s, 0]));
      for (const item of items) {
        if (item.created_at > end) continue;
        const history = byIssue.get(item.id) || [];
        let status = history.length ? history[0].from_value : item.status;
        for (const c of history) {
          if (c.created_at > end) break;
          status = c.to_value;
        }
        if (counts[status] !== undefined) counts[status] += 1;
      }
      for (const s of statuses) series[s].push(counts[s]);
    }
    return { project: project.key, dates, statuses, series };
  }

  burndown(sprint, all) {
    if (!sprint.start_date) return null;
    const start = new Date(`${sprint.start_date}T00:00:00Z`);
    const end = new Date(`${sprint.end_date || isoDay(addDays(start, 14))}T23:59:59Z`);
    const stop = sprint.state === 'closed' && sprint.completed_at ? new Date(sprint.completed_at) : new Date();
    const total = sprint.committed_points ?? points(all);
    const series = [];
    for (let d = new Date(start); d <= end && d <= stop; d = addDays(d, 1)) {
      const endOfDay = new Date(Math.min(addDays(d, 1).getTime() - 1, end.getTime())).toISOString();
      const done = points(all.filter((x) => x.resolved_at && x.resolved_at <= endOfDay));
      series.push({ date: isoDay(d), remaining: Math.max(0, total - done) });
    }
    return { start: sprint.start_date, end: isoDay(end), total, points: series };
  }

  async sprintReport(actor, id) {
    const sprint = await this.sprints.find(id);
    if (!sprint) throw notFound('Sprint not found.');
    await this.project(actor, sprint.project_key);
    const { current, movedOut } = await this.members(sprint);
    const closed = sprint.state === 'closed';
    const completed = current.filter((x) => x.status_category === 'done');
    const notCompleted = closed ? movedOut : current.filter((x) => x.status_category !== 'done');
    const removed = closed ? [] : movedOut;
    return {
      sprint,
      summary: { completed: completed.length, completedPoints: points(completed), notCompleted: notCompleted.length, notCompletedPoints: points(notCompleted), removed: removed.length },
      completed, notCompleted, removed,
      burndown: this.burndown(sprint, [...current, ...movedOut]),
    };
  }

  async timesheet(actor, { project: key, from: fromQuery, to: toQuery, user } = {}) {
    const project = await this.project(actor, key);
    const to = DATE_RE.test(toQuery || '') ? toQuery : isoDay(new Date());
    const from = DATE_RE.test(fromQuery || '') ? fromQuery : isoDay(new Date(Date.parse(to) - 6 * DAY));
    if (from > to) throw bad('The start date must be before the end date.');
    if ((Date.parse(to) - Date.parse(from)) / DAY > 62) throw bad('Choose a range of at most 62 days.');
    const rows = await this.repo.timesheet(project.key, { from, to, userId: user ? String(user) : null });
    const days = [];
    for (let d = Date.parse(from); d <= Date.parse(to); d += DAY) days.push(isoDay(new Date(d)));
    const users = {};
    const issues = {};
    for (const x of rows) {
      const u = (users[x.author_id] ||= { userId: x.author_id, total: 0, days: {} });
      u.total += x.time_spent;
      u.days[x.day] = (u.days[x.day] || 0) + x.time_spent;
      const i = (issues[x.key] ||= { key: x.key, summary: x.summary, type: x.type, status: x.status, total: 0, byUser: {}, days: {} });
      i.total += x.time_spent;
      i.byUser[x.author_id] = (i.byUser[x.author_id] || 0) + x.time_spent;
      i.days[x.day] = (i.days[x.day] || 0) + x.time_spent;
    }
    const est = await this.repo.estimateTotals(project.key);
    return {
      project: project.key, from, to, days, total: rows.reduce((t, x) => t + x.time_spent, 0),
      users: Object.values(users).sort((a, b) => b.total - a.total),
      issues: Object.values(issues).sort((a, b) => b.total - a.total),
      estimates: { original: est.original, remaining: est.remaining, spent: est.spent, estimatedItems: est.estimated, items: est.items },
      workingDay: { hoursPerDay: HOURS_PER_DAY, daysPerWeek: DAYS_PER_WEEK },
    };
  }
}

module.exports = { ReportService };
