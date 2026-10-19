'use strict';

const { handle, created } = require('../handler');
const present = require('../presenters/productivity');
const { redirectUri } = require('./signup.controller');
const { setSessionCookie } = require('../authTransport');

/** Site administration: workspace reset, sign-up policy, social-login providers and outgoing webhooks. (Mounted behind requireAuth; each route also requires a site admin.) */
module.exports = function adminController(router, { services, guards, config }) {
  const { webhooks, signup, authProviders, maintenance } = services;
  const admin = guards.requireAdmin;

  router.post('/reset', admin, handle(async (req, res) => {
    const session = await maintenance.reset(req.actor, { userAgent: req.headers['user-agent'] });
    setSessionCookie(req, res, session);
    return { ok: true, token: session.token };
  }));

  router.get('/admin/site', admin, handle(() => signup.policy()));
  router.put('/admin/site', admin, handle((req) => signup.updatePolicy(req.actor, req.body || {})));
  router.get('/admin/auth-providers', admin, handle((req) => authProviders.list((key) => redirectUri(req, config, key))));
  router.put('/admin/auth-providers/:provider', admin, handle((req) => authProviders.update(req.actor, req.params.provider, req.body || {}, redirectUri(req, config, req.params.provider))));

  router.get('/admin/webhooks', admin, handle(async () => {
    const r = await webhooks.list();
    return { webhooks: r.webhooks.map(present.webhook), events: r.events };
  }));
  router.post('/admin/webhooks', admin, handle(async (req, res) => created(res, present.webhook(await webhooks.create(req.actor, req.body || {})))));
  router.patch('/admin/webhooks/:id', admin, handle(async (req) => present.webhook(await webhooks.update(req.actor, req.params.id, req.body || {}))));
  router.delete('/admin/webhooks/:id', admin, handle((req) => webhooks.remove(req.actor, req.params.id)));
  router.post('/admin/webhooks/:id/test', admin, handle(async (req) => present.deliveryResult(await webhooks.test(req.actor, req.params.id))));
  router.get('/admin/webhooks/:id/deliveries', admin, handle(async (req) => (await webhooks.deliveries(req.params.id, req.query.limit)).map((d) => present.delivery(d))));
  router.get('/admin/webhook-deliveries/:id', admin, handle(async (req) => present.delivery(await webhooks.delivery(req.params.id), true)));
  router.post('/admin/webhook-deliveries/:id/redeliver', admin, handle(async (req) => present.deliveryResult(await webhooks.redeliver(req.params.id))));
};
