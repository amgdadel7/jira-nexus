'use strict';

const { handle } = require('../handler');
const { issue } = require('../presenters/issues');

/** Agile reports and the timesheet. */
module.exports = function reportsController(router, { services }) {
  const { reports } = services;

  router.get('/reports/velocity', handle((req) => reports.velocity(req.actor, req.query)));
  router.get('/reports/cfd', handle((req) => reports.cumulativeFlow(req.actor, req.query)));
  router.get('/reports/timesheet', handle((req) => reports.timesheet(req.actor, req.query)));
  router.get('/reports/sprint/:id', handle(async (req) => {
    const r = await reports.sprintReport(req.actor, req.params.id);
    const s = r.sprint;
    return {
      sprint: { id: s.id, name: s.name, goal: s.goal, state: s.state, startDate: s.start_date, endDate: s.end_date, completedAt: s.completed_at, projectKey: s.project_key },
      summary: r.summary,
      completed: r.completed.map((i) => issue(i)), notCompleted: r.notCompleted.map((i) => issue(i)), removed: r.removed.map((i) => issue(i)),
      burndown: r.burndown,
    };
  }));
};
