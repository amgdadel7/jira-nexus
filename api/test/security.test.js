'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const createApp = require('../app');
const auth = require('../auth');
const db = require('../db');

let server;
let base;

async function request(method, path, body, { token, cookie, headers = {} } = {}) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  if (cookie) reqHeaders['Cookie'] = cookie;

  const res = await fetch(`${base}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

before(async () => {
  const app = createApp({ serveClient: false });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  if (server) server.close();
});

test('Security 01: Non-existent user cannot authenticate and is NEVER mapped to another identity', async () => {
  // Synthesize a signed token pointing to a non-existent user ID
  const fakeUserId = 'u_does_not_exist_99999';
  const expiresEpoch = Date.now() + 3600 * 1000;
  const token = auth.createSession ? auth.createSession(fakeUserId).token : null;
  
  // Delete from sessions table if inserted, or use signed token directly
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(fakeUserId);

  const res = await request('GET', '/auth/me', null, { token });
  assert.equal(res.status, 401, 'Must return 401 Unauthenticated');
  assert.equal(res.data.code, 'unauthenticated');
  assert.notEqual(res.data?.user?.role, 'admin', 'Must never map non-existent user to admin');

  // Verify DB does not contain a resurrected session
  const resurrected = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  assert.equal(resurrected, undefined, 'Revoked/non-existent session must NOT be resurrected in DB');
});

test('Security 02: Revoked session (logout) cannot be accepted or recreated from signature', async () => {
  // Login to get a valid session
  const loginRes = await request('POST', '/auth/login', {
    email: 'ahmed@ahdfinancial.com',
    password: 'password'
  });
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;
  assert.ok(token);

  // Verify the token works
  const beforeLogout = await request('GET', '/auth/me', null, { token });
  assert.equal(beforeLogout.status, 200);
  assert.equal(beforeLogout.data.user.email, 'ahmed@ahdfinancial.com');

  // Perform logout
  const logoutRes = await request('POST', '/auth/logout', null, { token });
  assert.equal(logoutRes.status, 200);

  // Attempt to use the logged out / revoked session token again
  const afterLogout = await request('GET', '/auth/me', null, { token });
  assert.equal(afterLogout.status, 401, 'Logged out session must return 401');
  assert.equal(afterLogout.data.reason, 'unknown_session');

  // Check DB: Session must NOT be in DB
  const sessionRow = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  assert.equal(sessionRow, undefined, 'Session must remain deleted after logout');
});

test('Security 03: Expired session is rejected with 401 expired', async () => {
  const user = db.prepare("SELECT * FROM users WHERE active = 1").get();
  assert.ok(user);

  // Insert a session expired yesterday
  const expiredToken = `s_${user.id}.${Date.now() - 86400000}.1.${crypto.randomBytes(16).toString('hex')}.sig`;
  db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, created_at, expires_at, user_agent, last_seen_at, remember) VALUES (?,?,?,?,?,?,?)')
    .run(expiredToken, user.id, new Date(Date.now() - 172800000).toISOString(), new Date(Date.now() - 86400000).toISOString(), 'test', new Date().toISOString(), 0);

  const res = await request('GET', '/auth/me', null, { token: expiredToken });
  assert.equal(res.status, 401);
  assert.equal(res.data.code, 'unauthenticated');
});

test('Security 04: Invalid or tampered signature is rejected', async () => {
  const loginRes = await request('POST', '/auth/login', {
    email: 'ahmed@ahdfinancial.com',
    password: 'password'
  });
  assert.equal(loginRes.status, 200);
  const validToken = loginRes.data.token;

  // Tamper with the token string
  const tamperedToken = validToken.slice(0, -6) + 'abcdef';
  const res = await request('GET', '/auth/me', null, { token: tamperedToken });
  assert.equal(res.status, 401);
  assert.equal(res.data.code, 'unauthenticated');
});

test('Security 05: Suspended / Deactivated account is blocked from authenticating', async () => {
  // Find or create a user, then deactivate them
  const user = db.prepare("SELECT * FROM users WHERE role = 'member' AND active = 1").get();
  assert.ok(user);

  const session = auth.createSession(user.id);
  // Deactivate the user
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);

  try {
    const res = await request('GET', '/auth/me', null, { token: session.token });
    assert.equal(res.status, 401);
    assert.equal(res.data.reason, 'deactivated');

    // Also attempt login
    const loginRes = await request('POST', '/auth/login', {
      email: user.email,
      password: 'password'
    });
    assert.equal(loginRes.status, 403, 'Deactivated user login must return 403');
  } finally {
    // Re-activate user to leave DB clean
    db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(user.id);
  }
});

test('Security 06: Unauthorized request - members cannot modify global permissions', async () => {
  const omarLogin = await request('POST', '/auth/login', {
    email: 'omar@ahdfinancial.com',
    password: 'password'
  });
  assert.equal(omarLogin.status, 200);
  const omarToken = omarLogin.data.token;

  // Omar (member) attempts to PUT global permissions
  const res = await request('PUT', '/permissions/global', { scheme: { CREATE_PROJECTS: [] } }, { token: omarToken });
  assert.equal(res.status, 403, 'Non-admin must be forbidden from updating global permissions');
});

test('Security 07: Production startup fails if default/insecure SESSION_SECRET is used', async () => {
  const { execSync } = require('child_process');
  
  // Run node with NODE_ENV=production and default secret
  let failed = false;
  try {
    execSync('node -e "process.env.NODE_ENV=\'production\'; delete process.env.SESSION_SECRET; require(\'./auth\');"', {
      cwd: require('path').resolve(__dirname, '..'),
      stdio: 'pipe'
    });
  } catch (err) {
    failed = true;
    const stderr = err.stderr ? err.stderr.toString() : '';
    assert.ok(stderr.includes('FATAL SECURITY ERROR') || stderr.includes('SESSION_SECRET'), 'Must fail with fatal security error');
  }
  assert.ok(failed, 'Should refuse to start in production without strong SESSION_SECRET');
});

test('Security 08: API error during permissions save or read does not fabricate success or grant elevated permissions', async () => {
  // Attempt to save invalid permissions payload as admin
  const loginRes = await request('POST', '/auth/login', {
    email: 'ahmed@ahdfinancial.com',
    password: 'password'
  });
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;

  // Sending corrupted scheme payload must return 400 Bad Request and not fabricate success
  const badSave = await request('PUT', '/permissions/global', { scheme: 'NOT_AN_OBJECT' }, { token });
  assert.equal(badSave.status, 400, 'Must return 400 Bad Request');
  assert.equal(badSave.data.ok, undefined, 'Must not claim ok: true');

  // Request to non-existent endpoint or server failure does not produce synthetic permissions
  const outageRes = await request('GET', '/permissions/global_nonexistent', null, { token });
  assert.equal(outageRes.status, 404);
  assert.equal(outageRes.data.canManage, undefined, 'Must never fabricate canManage: true on API failure');
});
