'use strict';

const express = require('express');
const { handle, created } = require('../handler');
const { setSessionCookie } = require('../authTransport');
const { publicUser } = require('../presenters/users');
const { oauthResultPage } = require('../presenters/oauthPage');

const publicBase = (req, config) => config.publicUrl || `${req.protocol}://${req.get('host')}`;
const redirectUri = (req, config, provider) => `${publicBase(req, config)}/api/auth/oauth/${provider}/callback`;
const wantsHtml = (req) => !String(req.headers.accept || '').includes('application/json');

function loginBody(req, res, { user, session }) {
  setSessionCookie(req, res, session);
  return { user: publicUser(user), token: session.token, expiresAt: session.expires.toISOString(), remember: session.remember };
}

/** Public sign-up (e-mail code), social login (OAuth) and my linked identities. */
module.exports = function signupController(router, { services, guards, config }) {
  const { signup } = services;

  router.get('/auth/config', handle(() => signup.publicConfig()));

  router.post('/auth/signup/start', handle((req) => signup.start({ email: req.body?.email, ip: req.ip })));
  router.post('/auth/signup/verify', handle((req) => signup.verify({ ...req.body, ip: req.ip })));
  router.post('/auth/signup/complete', handle(async (req, res) => {
    const result = await signup.complete({ ...req.body, userAgent: req.headers['user-agent'] });
    return created(res, loginBody(req, res, result));
  }));

  router.get('/auth/oauth/:provider/start', async (req, res, next) => {
    const { provider } = req.params;
    const popup = req.query.popup === '1';
    try {
      const url = await signup.oauthStart(provider, { mode: req.query.mode, popup, remember: req.query.remember !== '0', redirectUri: redirectUri(req, config, provider) });
      return wantsHtml(req) ? res.redirect(302, url) : res.json({ url });
    } catch (err) {
      if (!wantsHtml(req) || !err.status || err.status >= 500) return next(err);
      return res.status(err.status).type('html').send(oauthResultPage({ popup, provider, error: err.message }));
    }
  });

  const callback = async (req, res, next) => {
    try {
      const { provider } = req.params;
      const query = { ...req.query, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
      const result = await signup.oauthCallback(provider, query, { redirectUri: redirectUri(req, config, provider), userAgent: req.headers['user-agent'] });
      const payload = result.error ? null : { ...loginBody(req, res, result), created: result.created };
      res.status(result.error ? 400 : 200).type('html').send(oauthResultPage({ popup: result.popup, provider, payload, error: result.error }));
    } catch (err) { next(err); }
  };
  router.get('/auth/oauth/:provider/callback', callback);
  router.post('/auth/oauth/:provider/callback', express.urlencoded({ extended: false }), callback); // Apple uses form_post

  router.get('/auth/identities', guards.requireAuth, handle((req) => signup.identitiesOf(req.actor)));
  router.delete('/auth/identities/:provider', guards.requireAuth, handle((req) => signup.unlink(req.actor, req.params.provider)));
};

module.exports.redirectUri = redirectUri;
