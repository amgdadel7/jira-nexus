'use strict';

const { handle, created } = require('../handler');
const { setSessionCookie, clearSessionCookie } = require('../authTransport');
const present = require('../presenters/users');

/** /auth/login, logout, password reset, sessions, API tokens, /auth/me and /users. */
module.exports = function authController(router, { services, guards }) {
  const { auth, users } = services;
  const { requireAuth, requireAdmin } = guards;

  router.post('/auth/login', handle(async (req, res) => {
    const { user, session } = await auth.login({ ...req.body, userAgent: req.headers['user-agent'], ip: req.ip });
    setSessionCookie(req, res, session);
    return { user: present.publicUser(user), token: session.token, expiresAt: session.expires.toISOString(), remember: session.remember };
  }));

  router.post('/auth/logout', handle(async (req, res) => {
    await auth.logout(req.sessionToken);
    clearSessionCookie(req, res);
    return { ok: true };
  }));

  router.post('/auth/forgot', handle((req) => auth.requestPasswordReset({ email: req.body?.email, ip: req.ip })));
  router.get('/auth/reset/:token', handle(async (req) => ({ ok: true, email: await auth.peekPasswordReset(req.params.token) })));
  router.post('/auth/reset', handle(async (req) => ({ ok: true, email: await auth.resetPassword(req.body || {}) })));

  router.get('/auth/tokens', requireAuth, handle(async (req) => (await auth.listApiTokens(req.actor)).map(present.apiToken)));
  router.post('/auth/tokens', requireAuth, handle(async (req, res) => {
    const { row, token } = await auth.createApiToken(req.actor, req.body || {});
    return created(res, { ...present.apiToken(row), token });
  }));
  router.delete('/auth/tokens/:id', requireAuth, handle(async (req) => {
    await auth.revokeApiToken(req.actor, req.params.id);
    return { ok: true };
  }));

  router.get('/auth/sessions', requireAuth, handle(async (req) => (await auth.listSessions(req.actor)).map((s) => present.session(s, req.sessionToken))));
  router.delete('/auth/sessions', requireAuth, handle(async (req) => ({ ok: true, removed: await auth.revokeOtherSessions(req.actor) })));
  router.delete('/auth/sessions/:id', requireAuth, handle(async (req) => {
    await auth.revokeSession(req.actor, req.params.id);
    return { ok: true };
  }));

  router.get('/auth/me', requireAuth, handle((req) => ({ user: present.publicUser(req.user) })));
  router.patch('/auth/me', requireAuth, handle(async (req) => ({ user: present.publicUser(await auth.updateProfile(req.actor, req.body || {})) })));

  router.get('/users', requireAuth, handle(async () => (await users.listDirectory()).map(present.directoryUser)));
  router.post('/users', requireAdmin, handle(async (req, res) => created(res, present.publicUser(await users.invite(req.actor, req.body)))));
  router.patch('/users/:id', requireAdmin, handle(async (req) => present.publicUser(await users.update(req.actor, req.params.id, req.body))));
  router.delete('/users/:id', requireAdmin, handle(async (req) => {
    await users.remove(req.actor, req.params.id);
    return { ok: true };
  }));
};
