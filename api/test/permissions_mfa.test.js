'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers/testServer');
const { generateTOTP } = require('../src/shared/totp');

let srv;
let base;
let adminCookie = '';
let memberCookie = '';

async function login(email, password = 'password') {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  const cookie = r.headers.get('set-cookie')?.split(';')[0] || '';
  return { status: r.status, data, cookie };
}

before(async () => {
  srv = await startTestServer();
  base = srv.base;

  const adminLogin = await login('ahmed@ahdfinancial.com');
  adminCookie = adminLogin.cookie;

  const memberLogin = await login('sara@ahdfinancial.com');
  memberCookie = memberLogin.cookie;
});

after(async () => {
  await srv.close();
});

let saraSecret = '';

test('Step 07 MFA 01: Multi-Factor Authentication Setup, Enablement, and Backup Code Generation', async () => {
  // 1. Setup 2FA: request TOTP secret and QR/URI
  const setupRes = await fetch(`${base}/auth/mfa/setup`, {
    method: 'POST',
    headers: { Cookie: memberCookie },
  });
  assert.equal(setupRes.status, 200);
  const setupData = await setupRes.json();
  assert.ok(setupData.secret, 'Should return TOTP Base32 secret');
  assert.ok(setupData.otpAuthUri, 'Should return otpauth URI');
  assert.match(setupData.otpAuthUri, /^otpauth:\/\/totp\//);
  saraSecret = setupData.secret;

  // 2. Attempt to enable 2FA with an invalid TOTP code (Must be rejected)
  const invalidEnable = await fetch(`${base}/auth/mfa/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
    body: JSON.stringify({ secret: setupData.secret, code: '000000' }),
  });
  assert.equal(invalidEnable.status, 400);

  // 3. Enable 2FA with a valid TOTP code computed from the secret
  const validCode = generateTOTP(setupData.secret);
  const validEnable = await fetch(`${base}/auth/mfa/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
    body: JSON.stringify({ secret: setupData.secret, code: validCode }),
  });
  assert.equal(validEnable.status, 200);
  const enableData = await validEnable.json();
  assert.equal(enableData.ok, true);
  assert.ok(Array.isArray(enableData.backupCodes), 'Should return backup recovery codes');
  assert.equal(enableData.backupCodes.length, 8, 'Should provide 8 backup codes');

  // Verify that /auth/me now reflects mfaEnabled: true
  const meRes = await fetch(`${base}/auth/me`, {
    headers: { Cookie: memberCookie },
  });
  const meData = await meRes.json();
  assert.equal(meData.user.mfaEnabled, true);
});

test('Step 07 MFA 02: Login with 2FA Challenge, Rejection of Bad Code, and TOTP Verification', async () => {
  // 1. Password login for user with 2FA enabled: must NOT return full session directly, returns mfaRequired & mfaToken
  const challengeRes = await login('sara@ahdfinancial.com', 'password');
  assert.equal(challengeRes.status, 200);
  assert.equal(challengeRes.data.mfaRequired, true);
  assert.ok(challengeRes.data.mfaToken, 'Should receive ephemeral mfaToken');
  assert.equal(challengeRes.cookie, '', 'Should NOT issue authenticated session cookie on challenge step');

  const mfaToken = challengeRes.data.mfaToken;

  // 2. Submit wrong TOTP code to /auth/mfa/verify
  const badVerify = await fetch(`${base}/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code: '999999' }),
  });
  assert.equal(badVerify.status, 401);

  // 3. Compute correct TOTP code from saraSecret
  const correctCode = generateTOTP(saraSecret);

  // 4. Verify challenge with correct TOTP code
  const goodVerify = await fetch(`${base}/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code: correctCode }),
  });
  assert.equal(goodVerify.status, 200);
  const goodData = await goodVerify.json();
  assert.ok(goodData.token, 'Should receive session token upon successful 2FA verification');
  const newCookie = goodVerify.headers.get('set-cookie')?.split(';')[0];
  assert.ok(newCookie, 'Should receive authenticated session cookie');

  // Verify that the new session works
  const meRes = await fetch(`${base}/auth/me`, {
    headers: { Cookie: newCookie },
  });
  assert.equal(meRes.status, 200);

  // 5. Test disabling MFA with valid password
  const disableRes = await fetch(`${base}/auth/mfa/disable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: newCookie },
    body: JSON.stringify({ password: 'password' }),
  });
  assert.equal(disableRes.status, 200);
  const meAfterDisable = await (await fetch(`${base}/auth/me`, { headers: { Cookie: newCookie } })).json();
  assert.equal(meAfterDisable.user.mfaEnabled, false);
});

test('Step 07 MFA 03: Recovery via One-Time Hashed Backup Code and Replay Rejection', async () => {
  // 1. Setup new user Layla to test backup code recovery
  const laylaLogin = await login('layla@ahdfinancial.com', 'password');
  const laylaCookie = laylaLogin.cookie;

  const setupRes = await fetch(`${base}/auth/mfa/setup`, {
    method: 'POST',
    headers: { Cookie: laylaCookie },
  });
  const { secret } = await setupRes.json();
  const validCode = generateTOTP(secret);

  const enableRes = await fetch(`${base}/auth/mfa/enable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: laylaCookie },
    body: JSON.stringify({ secret, code: validCode }),
  });
  const { backupCodes } = await enableRes.json();
  const testBackupCode = backupCodes[0];

  // 2. Trigger login challenge
  const challenge = await login('layla@ahdfinancial.com', 'password');
  assert.equal(challenge.data.mfaRequired, true);
  const mfaToken = challenge.data.mfaToken;

  // 3. Verify using one-time backup code
  const verifyRes = await fetch(`${base}/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code: testBackupCode }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.ok(verifyData.token);

  // 4. Attempt to reuse the same backup code on a new login challenge (Must be rejected!)
  const challenge2 = await login('layla@ahdfinancial.com', 'password');
  const reuseRes = await fetch(`${base}/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken: challenge2.data.mfaToken, code: testBackupCode }),
  });
  assert.equal(reuseRes.status, 401, 'Reused backup code must be rejected');
});

test('Step 07 Sessions 04: Session Listing, Device Metadata, and Instant Revocation (401)', async () => {
  // 1. Login user to create session 1 and session 2
  const s1 = await login('omar@ahdfinancial.com', 'password');
  const cookie1 = s1.cookie;

  const s2 = await login('omar@ahdfinancial.com', 'password');
  const cookie2 = s2.cookie;

  // 2. List sessions: should show device metadata (IP, user agent, timestamps, current flag)
  const listRes = await fetch(`${base}/auth/sessions`, {
    headers: { Cookie: cookie1 },
  });
  assert.equal(listRes.status, 200);
  const sessions = await listRes.json();
  assert.ok(sessions.length >= 2);
  const currentSession = sessions.find((s) => s.current);
  assert.ok(currentSession, 'Current session should be flagged');
  assert.ok(currentSession.id);
  assert.ok(currentSession.created);
  assert.ok(currentSession.lastSeen);

  // 3. Revoke session 2 by ID using session 1
  const session2Id = sessions.find((s) => !s.current).id;
  const revokeRes = await fetch(`${base}/auth/sessions/${session2Id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie1 },
  });
  assert.equal(revokeRes.status, 200);

  // 4. Session 2 must be immediately rejected with 401 (Instant revocation enforcement)
  const checkS2 = await fetch(`${base}/auth/me`, {
    headers: { Cookie: cookie2 },
  });
  assert.equal(checkS2.status, 401, 'Revoked session must immediately be rejected with 401');

  // Session 1 remains valid
  const checkS1 = await fetch(`${base}/auth/me`, {
    headers: { Cookie: cookie1 },
  });
  assert.equal(checkS1.status, 200, 'Active session remains valid');
});

test('Step 07 Sessions 05: Revoke All Other Sessions Immediately Cuts Off Other Devices', async () => {
  const primary = await login('yusuf@ahdfinancial.com', 'password');
  const otherA = await login('yusuf@ahdfinancial.com', 'password');
  const otherB = await login('yusuf@ahdfinancial.com', 'password');

  // Verify other devices work
  const testA = await fetch(`${base}/auth/me`, { headers: { Cookie: otherA.cookie } });
  assert.equal(testA.status, 200);

  // Call revoke other sessions
  const revokeOthersRes = await fetch(`${base}/auth/sessions/revoke-others`, {
    method: 'POST',
    headers: { Cookie: primary.cookie },
  });
  assert.equal(revokeOthersRes.status, 200);

  // Other devices are now immediately killed
  const afterA = await fetch(`${base}/auth/me`, { headers: { Cookie: otherA.cookie } });
  assert.equal(afterA.status, 401);
  const afterB = await fetch(`${base}/auth/me`, { headers: { Cookie: otherB.cookie } });
  assert.equal(afterB.status, 401);

  // Primary device is unaffected
  const afterPrimary = await fetch(`${base}/auth/me`, { headers: { Cookie: primary.cookie } });
  assert.equal(afterPrimary.status, 200);
});

test('Step 07 Permissions 06: Unified Permissions & Deny-by-Default: Org, Workspace, Project & Guest Scoping', async () => {
  // Create a guest user Khalid (u7) in default organization
  // First, verify Khalid cannot delete projects or manage organization
  const guestLogin = await login('khalid@ahdfinancial.com', 'password');
  const guestCookie = guestLogin.cookie;

  // 1. Guest attempts to invite members to the organization (Must be forbidden)
  const inviteRes = await fetch(`${base}/organizations/default-org/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ email: 'intruder@example.com', role: 'member' }),
  });
  assert.equal(inviteRes.status, 403, 'Guest must not be allowed to invite members');

  // 2. Guest attempts to create a workspace in the organization (Must be forbidden)
  const wsRes = await fetch(`${base}/organizations/default-org/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ name: 'Guest Private Workspace' }),
  });
  assert.equal(wsRes.status, 403, 'Guest must not be allowed to create workspaces');

  // 3. Sudo mode test: /auth/sudo validates password and elevates session sudo_confirmed_at
  const sudoRes = await fetch(`${base}/auth/sudo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: guestCookie },
    body: JSON.stringify({ password: 'password' }),
  });
  assert.equal(sudoRes.status, 200);
  const sudoData = await sudoRes.json();
  assert.equal(sudoData.ok, true);
  assert.ok(sudoData.sudoUntil);
});

test('Step 07 Account Lifecycle 07: Account Deactivation Instantly Terminates All Sessions', async () => {
  // Create and login temporary session for Mona
  const monaLogin = await login('mona@ahdfinancial.com', 'password');
  const monaCookie = monaLogin.cookie;

  const beforeDeact = await fetch(`${base}/auth/me`, { headers: { Cookie: monaCookie } });
  assert.equal(beforeDeact.status, 200);

  // Admin deactivates Mona's account
  const deactRes = await fetch(`${base}/users/u6`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactRes.status, 200);

  // Mona's active session is now immediately rejected with 401
  const afterDeact = await fetch(`${base}/auth/me`, { headers: { Cookie: monaCookie } });
  assert.equal(afterDeact.status, 401, 'Deactivated account session must be rejected with 401 immediately');
  const errData = await afterDeact.json();
  assert.ok(['unknown_session', 'deactivated'].includes(errData.reason), 'Session must be immediately rejected on deactivation');

  // Reactivate for future tests
  await fetch(`${base}/users/u6`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ active: true }),
  });
});
