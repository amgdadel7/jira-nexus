'use strict';

const express = require('express');
const { handle, created } = require('../handler');
const present = require('../presenters/issues');

/** Work items: JQL search, CRUD, transitions, clone, bulk, rank, comments, watchers, links, attachments, development. */
module.exports = function issuesController(router, { services }) {
  const { issues, issueQuery, comments, links, attachments, development } = services;
  const MAX_UPLOAD = attachments.constructor.MAX_UPLOAD;

  router.get('/search', handle(async (req) => present.search(await issueQuery.search(req.actor, {
    jql: req.query.jql, startAt: req.query.startAt, maxResults: req.query.maxResults, withCustomFields: req.query.fields === 'custom',
  }))));

  router.post('/issues', handle(async (req, res) => created(res, present.issue(await issues.create(req.actor, req.body || {})))));
  router.post('/issues/bulk', handle((req) => issues.bulk(req.actor, req.body || {})));
  router.get('/issues/:key', handle(async (req) => present.detail(await issueQuery.detail(req.actor, req.params.key))));
  router.patch('/issues/:key', handle(async (req) => present.issue(await issues.update(req.actor, req.params.key, req.body || {}))));
  router.delete('/issues/:key', handle((req) => issues.delete(req.actor, req.params.key)));

  router.get('/issues/:key/transitions', handle((req) => issues.transitions(req.actor, req.params.key)));
  router.post('/issues/:key/transitions', handle(async (req) => present.issue(await issues.transition(req.actor, req.params.key, {
    transitionId: req.body?.transitionId ?? req.body?.transition?.id, to: req.body?.to ?? req.body?.status, resolution: req.body?.resolution,
  }))));

  router.post('/issues/:key/clone', handle(async (req, res) => created(res, present.issue(await issues.clone(req.actor, req.params.key)))));
  router.post('/issues/:key/rank', handle(async (req) => present.issue(await issues.rank(req.actor, req.params.key, req.body || {}))));

  router.post('/issues/:key/comments', handle(async (req, res) => created(res, present.comment(await comments.add(req.actor, req.params.key, req.body?.body)))));
  router.patch('/comments/:id', handle(async (req) => present.comment(await comments.update(req.actor, req.params.id, req.body?.body))));
  router.delete('/comments/:id', handle((req) => comments.remove(req.actor, req.params.id)));

  router.post('/issues/:key/watch', handle((req) => issues.watch(req.actor, req.params.key)));
  router.delete('/issues/:key/watch', handle((req) => issues.unwatch(req.actor, req.params.key)));

  router.post('/issues/:key/links', handle(async (req, res) => created(res, await links.create(req.actor, req.params.key, req.body || {}))));
  router.delete('/links/:id', handle((req) => links.remove(req.actor, req.params.id)));

  router.post('/issues/:key/attachments', express.raw({ type: () => true, limit: MAX_UPLOAD }), handle(async (req, res) => created(res, present.attachment(
    await attachments.upload(req.actor, req.params.key, { filename: req.headers['x-filename'], contentType: req.headers['content-type'], buffer: req.body }),
  ))));
  router.get('/attachments/:id', handle(async (req, res) => {
    const file = await attachments.download(req.actor, req.params.id, { inline: req.query.inline === '1' });
    res.setHeader('Content-Type', file.attachment.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `${file.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.attachment.filename)}`);
    file.stream().pipe(res);
  }));
  router.delete('/attachments/:id', handle((req) => attachments.remove(req.actor, req.params.id)));

  router.post('/issues/:key/dev', handle(async (req, res) => created(res, present.development(await development.add(req.actor, req.params.key, req.body || {})))));
};
