'use strict';

const express = require('express');
const { handle, created } = require('../handler');
const { issue, worklog } = require('../presenters/issues');
const { publicUser } = require('../presenters/users');
const present = require('../presenters/productivity');

/** Time tracking, votes, personal preferences + photo, project automation and CSV import. */
module.exports = function productivityController(router, { services }) {
  const { worklogs, votes, profile, automation, importer } = services;
  const withIssue = (r) => ({ ...r, ...(r.worklog ? { worklog: worklog(r.worklog) } : {}), issue: issue(r.issue) });

  router.get('/issues/:key/worklogs', handle(async (req) => {
    const r = await worklogs.list(req.actor, req.params.key);
    return { ...r, worklogs: r.worklogs.map(worklog) };
  }));
  router.post('/issues/:key/worklogs', handle(async (req, res) => created(res, withIssue(await worklogs.add(req.actor, req.params.key, req.body || {})))));
  router.patch('/worklogs/:id', handle(async (req) => withIssue(await worklogs.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/worklogs/:id', handle(async (req) => withIssue(await worklogs.remove(req.actor, req.params.id, req.query.adjustEstimate || req.body?.adjustEstimate || 'auto'))));

  router.get('/issues/:key/votes', handle((req) => votes.get(req.actor, req.params.key)));
  router.post('/issues/:key/votes', handle((req) => votes.vote(req.actor, req.params.key)));
  router.delete('/issues/:key/votes', handle((req) => votes.unvote(req.actor, req.params.key)));

  router.get('/auth/me/preferences', handle((req) => profile.preferences(req.actor)));
  router.patch('/auth/me/preferences', handle((req) => profile.updatePreferences(req.actor, req.body || {})));
  router.post('/auth/me/avatar', express.raw({ type: () => true, limit: 2 * 1024 * 1024 }), handle(async (req) => ({ user: publicUser(await profile.setAvatar(req.actor, req.body)) })));
  router.delete('/auth/me/avatar', handle(async (req) => ({ user: publicUser(await profile.removeAvatar(req.actor)) })));

  router.get('/projects/:key/automation', handle(async (req) => {
    const r = await automation.list(req.actor, req.params.key);
    return { ...r, rules: r.rules.map(present.rule) };
  }));
  router.post('/projects/:key/automation', handle(async (req, res) => created(res, present.rule(await automation.create(req.actor, req.params.key, req.body || {})))));
  router.get('/projects/:key/automation/audit', handle(async (req) => (await automation.projectRuns(req.actor, req.params.key, req.query)).map(present.run)));
  router.get('/automation/:id', handle(async (req) => present.rule(await automation.get(req.actor, req.params.id))));
  router.patch('/automation/:id', handle(async (req) => present.rule(await automation.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/automation/:id', handle((req) => automation.remove(req.actor, req.params.id)));
  router.get('/automation/:id/runs', handle(async (req) => (await automation.runs(req.actor, req.params.id, req.query.limit)).map(present.run)));
  router.post('/automation/:id/run', handle(async (req) => {
    const r = await automation.runManually(req.actor, req.params.id, req.body?.issueKey);
    return { ...r, statusLabel: present.run({ status: r.status }).statusLabel, issue: issue(r.issue) };
  }));

  router.post('/projects/:key/import', express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }), handle(async (req, res) => {
    const raw = typeof req.body === 'string';
    const dryRun = raw ? ['1', 'true'].includes(String(req.query.dryRun)) : Boolean(req.body?.dryRun);
    const r = await importer.run(req.actor, req.params.key, { csv: raw ? req.body : req.body?.csv, dryRun });
    return r.dryRun ? r : created(res, r);
  }));
};
