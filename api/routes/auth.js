const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const A = require('../auth');
const L = require('../lib');
const PM = require('../perms');
const B = require('../billing');

const r = express.Router();
const attempts = new Map(); // naive in-memory rate limit: "email|ip" -> { n, until }
const SHOW_RESET_LINKS = process.env.SHOW_RESET_LINKS ? process.env.SHOW_RESET_LINKS === 'true' : process.env.NODE_ENV !== 'production';
const limitKey = (req, email) => `${email}|${req.ip}`;
function checkLimit(req, email) {
  const a = attempts.get(limitKey(req, email));
  if (a && a.until > Date.now()) {
    const secs = Math.ceil((a.until - Date.now()) / 1000);
    throw Object.assign(new Error(`Too many failed attempts. Try again in ${secs} second${secs === 1 ? '' : 's'}.`), { status: 429 });
  }
}
function failAttempt(req, email) {
  const k = limitKey(req, email);
  const n = (attempts.get(k)?.n || 0) + 1;
  attempts.set(k, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
  if (attempts.size > 5000) attempts.clear();
}

r.post('/auth/login', L.wrap((req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw L.bad('Enter your email and password.');
  checkLimit(req, email);
  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user || !A.verifyPassword(password, user.password_hash)) {
    failAttempt(req, email);
    return res.status(401).json({ error: 'Incorrect email address and / or password.' });
  }
  if (!user.active) return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
  attempts.delete(limitKey(req, email));
  const remember = req.body?.remember !== false;
  const session = A.createSession(user.id, { remember, userAgent: req.headers['user-agent'] });
  A.setSessionCookie(req, res, session);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  res.json({ user: A.publicUser(user), token: session.token, expiresAt: session.expires.toISOString(), remember });
}));

r.post('/auth/logout', L.wrap((req, res) => {
  if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  A.clearSessionCookie(req, res);
  res.json({ ok: true });
}));

// ----- forgot / reset password -----
// There is no mail server, so outside production the reset link is returned in the response
// (and always written to the server log). Set SHOW_RESET_LINKS=true|false to override.
r.post('/auth/forgot', L.wrap((req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw L.bad('Enter a valid email address.');
  checkLimit(req, `forgot:${email}`);
  failAttempt(req, `forgot:${email}`); // at most 5 requests a minute per email
  const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE AND active = 1').get(email);
  const out = { ok: true, message: 'If an account exists for that email, we sent a link to reset the password.' };
  if (user) {
    const token = A.createResetToken(user.id);
    const resetPath = `/reset-password?token=${token}`;
    console.log(`[auth] password reset link for ${user.email}: ${resetPath}`);
    if (SHOW_RESET_LINKS) out.resetPath = resetPath;
  }
  res.json(out);
}));
r.get('/auth/reset/:token', L.wrap((req, res) => {
  const userId = A.peekResetToken(req.params.token);
  if (!userId) throw L.bad('This reset link is invalid or has expired. Request a new one.');
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  res.json({ ok: true, email: u.email });
}));
r.post('/auth/reset', L.wrap((req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) throw L.bad('The new password must be at least 8 characters.');
  const userId = A.consumeResetToken(req.body?.token);
  if (!userId) throw L.bad('This reset link is invalid or has expired. Request a new one.');
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(A.hashPassword(password), userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); // sign out everywhere
  })();
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ ok: true, email: u.email });
}));

// ----- active sessions -----
// ---------- personal API tokens (for scripts and integrations) ----------
const noTokenAuth = (req) => { if (req.apiTokenId) throw L.forbidden('API tokens cannot manage tokens or sessions. Log in with a password.'); };
r.get('/auth/tokens', A.requireAuth, L.wrap((req, res) => {
  noTokenAuth(req);
  res.json(db.prepare('SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id).map(A.apiTokenOut));
}));
r.post('/auth/tokens', A.requireAuth, L.wrap((req, res) => {
  noTokenAuth(req);
  const name = String(req.body?.name || '').trim();
  if (!name) throw L.bad('Give the token a name so you can recognise it later.');
  if (name.length > 60) throw L.bad('Token name must be 60 characters or less.');
  const days = req.body?.expiresInDays == null || req.body.expiresInDays === '' ? null : Number(req.body.expiresInDays);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) throw L.bad('Expiry must be between 1 and 365 days, or none.');
  if (db.prepare('SELECT COUNT(*) c FROM api_tokens WHERE user_id = ?').get(req.user.id).c >= 20) throw L.bad('You can have at most 20 API tokens. Revoke one first.');
  const { id, token } = A.createApiToken(req.user.id, name, days);
  res.status(201).json({ ...A.apiTokenOut(db.prepare('SELECT * FROM api_tokens WHERE id = ?').get(id)), token });
}));
r.delete('/auth/tokens/:id', A.requireAuth, L.wrap((req, res) => {
  noTokenAuth(req);
  const info = db.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!info.changes) throw L.notFound('Token not found.');
  res.json({ ok: true });
}));

r.get('/auth/sessions', A.requireAuth, L.wrap((req, res) => {
  const rows = db.prepare('SELECT token, created_at, last_seen_at, expires_at, user_agent, remember FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC')
    .all(req.user.id, new Date().toISOString());
  res.json(rows.map((s) => ({
    id: s.token.slice(0, 12), current: s.token === req.sessionToken, created: s.created_at, lastSeen: s.last_seen_at || s.created_at,
    expires: s.expires_at, userAgent: s.user_agent, remember: !!s.remember,
  })));
}));
r.delete('/auth/sessions', A.requireAuth, L.wrap((req, res) => {
  const info = db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.sessionToken || '');
  res.json({ ok: true, removed: info.changes });
}));
r.delete('/auth/sessions/:id', A.requireAuth, L.wrap((req, res) => {
  const id = String(req.params.id);
  if (!/^[a-f0-9]{12}$/.test(id)) throw L.bad('Invalid session id.');
  const info = db.prepare("DELETE FROM sessions WHERE user_id = ? AND substr(token,1,12) = ? AND token != ?").run(req.user.id, id, req.sessionToken || '');
  if (!info.changes) throw L.notFound('Session not found.');
  res.json({ ok: true });
}));

r.get('/auth/me', A.requireAuth, L.wrap((req, res) => res.json({ user: A.publicUser(req.user) })));

r.patch('/auth/me', A.requireAuth, L.wrap((req, res) => {
  const { name, title, color, currentPassword, newPassword } = req.body || {};
  const u = req.user;
  const upd = {};
  if (name !== undefined) { if (!String(name).trim()) throw L.bad('Name is required.'); upd.name = String(name).trim().slice(0, 80); }
  if (title !== undefined) upd.title = String(title).slice(0, 80);
  if (color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(color)) throw L.bad('Color must be a hex value like #0052CC.'); upd.color = color; }
  if (newPassword !== undefined) {
    if (u.password_hash && !A.verifyPassword(currentPassword || '', u.password_hash)) throw L.bad('Your current password is incorrect.');
    if (String(newPassword).length < 8) throw L.bad('The new password must be at least 8 characters.');
    upd.password_hash = A.hashPassword(newPassword);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, req.sessionToken || '');
  }
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => upd[c]), u.id);
  res.json({ user: A.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
}));

// ---------- user administration ----------
r.get('/users', A.requireAuth, L.wrap((req, res) => {
  const users = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM issues WHERE assignee_id = u.id AND status != 'Done') AS open_count,
    (SELECT MAX(created_at) FROM sessions WHERE user_id = u.id) AS last_login FROM users u WHERE u.bot = 0 ORDER BY u.active DESC, u.name`).all();
  res.json(users.map((u) => ({ ...A.publicUser(u), openCount: u.open_count, lastLogin: u.last_login, created: u.created_at })));
}));

const COLORS = ['#0052CC', '#6554C0', '#00875A', '#FF5630', '#FF991F', '#00B8D9', '#8777D9', '#36B37E', '#DE350B', '#5243AA'];

r.post('/users', A.requireAdmin, L.wrap((req, res) => {
  const { name, email, password, role = 'member', title = '' } = req.body || {};
  if (!String(name || '').trim()) throw L.bad('Name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) throw L.bad('Enter a valid email address.');
  if (String(password || '').length < 8) throw L.bad('Password must be at least 8 characters.');
  if (!['admin', 'member'].includes(role)) throw L.bad('Role must be admin or member.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)) throw L.bad('A user with that email already exists.');
  B.assertSeat(1);
  const id = `u${crypto.randomBytes(4).toString('hex')}`;
  const color = COLORS[db.prepare('SELECT COUNT(*) c FROM users').get().c % COLORS.length];
  db.prepare('INSERT INTO users (id,name,email,color,password_hash,role,active,title,created_at) VALUES (?,?,?,?,?,?,1,?,?)')
    .run(id, String(name).trim(), String(email).trim().toLowerCase(), color, A.hashPassword(password), role, String(title).slice(0, 80), L.now());
  // optional initial project roles: projects: [{ key, role }]
  for (const pr of Array.isArray(req.body.projects) ? req.body.projects : []) {
    const pk = String(pr.key || '').toUpperCase();
    if (!db.prepare('SELECT 1 FROM projects WHERE key = ?').get(pk) || !PM.ROLES.includes(pr.role)) continue;
    db.prepare('INSERT OR REPLACE INTO project_members (project_key,user_id,role,added_by,added_at) VALUES (?,?,?,?,?)').run(pk, id, pr.role, req.user.id, L.now());
  }
  PM.audit(req, 'user.invited', { target: String(name).trim(), details: { userId: id, email: String(email).trim().toLowerCase(), role } });
  res.status(201).json(A.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
}));

r.patch('/users/:id', A.requireAdmin, L.wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) throw L.notFound('User not found.');
  const { name, email, role, active, title, password } = req.body || {};
  const upd = {};
  if (name !== undefined) { if (!String(name).trim()) throw L.bad('Name is required.'); upd.name = String(name).trim(); }
  if (email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw L.bad('Enter a valid email address.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?').get(email, u.id)) throw L.bad('A user with that email already exists.');
    upd.email = email.toLowerCase();
  }
  if (title !== undefined) upd.title = String(title).slice(0, 80);
  if (role !== undefined) {
    if (!['admin', 'member'].includes(role)) throw L.bad('Role must be admin or member.');
    if (u.id === req.user.id && role !== 'admin') throw L.bad('You cannot remove your own admin role.');
    upd.role = role;
  }
  if (active !== undefined) {
    if (u.id === req.user.id && !active) throw L.bad('You cannot deactivate yourself.');
    if (active && !u.active) B.assertSeat(1);
    upd.active = active ? 1 : 0;
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  }
  if (password !== undefined) { if (String(password).length < 8) throw L.bad('Password must be at least 8 characters.'); upd.password_hash = A.hashPassword(password);
    // An admin-set password signs the user out everywhere (except the admin's own current session).
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, req.sessionToken || '');
  }
  const cols = Object.keys(upd);
  if (cols.length) db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => upd[c]), u.id);
  if ('role' in upd && upd.role !== u.role) PM.audit(req, 'user.role_changed', { target: u.name, details: { userId: u.id, from: u.role, to: upd.role } });
  if ('active' in upd && upd.active !== u.active) PM.audit(req, upd.active ? 'user.reactivated' : 'user.deactivated', { target: u.name, details: { userId: u.id } });
  if ('password_hash' in upd) PM.audit(req, 'user.password_reset_by_admin', { target: u.name, details: { userId: u.id } });
  res.json(A.publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)));
}));

// Deleting a user deactivates them (keeps history intact) and unassigns their open work.
r.delete('/users/:id', A.requireAdmin, L.wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) throw L.notFound('User not found.');
  if (u.id === req.user.id) throw L.bad('You cannot remove yourself.');
  db.transaction(() => {
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(u.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    const open = db.prepare("SELECT * FROM issues WHERE assignee_id = ? AND status != 'Done'").all(u.id);
    open.forEach((row) => L.applyUpdate(row, { assignee_id: null }, req.user.id));
  })();
  PM.audit(req, 'user.deactivated', { target: u.name, details: { userId: u.id } });
  res.json({ ok: true });
}));

module.exports = r;
