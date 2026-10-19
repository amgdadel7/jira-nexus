// Phase 6: sign-up with email codes, OAuth social login (against a fake provider), plans & billing.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const { startTestServer } = require('./helpers/testServer');

let srv; let base; let admin; let fake; let fakeBase;
const fakeUsers = new Map(); // code -> profile

async function api(method, url, body, { cookie, headers = {}, raw } = {}) {
  const res = await fetch(base + url, {
    method, redirect: 'manual',
    headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
async function loginAs(email, password = 'password') {
  const r = await api('POST', '/auth/login', { email, password });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.headers.get('set-cookie').split(';')[0];
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

before(async () => {
  srv = await startTestServer();
  base = srv.base;
  // a tiny OpenID Connect provider
  fake = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url.startsWith('/token')) {
        const p = new URLSearchParams(body);
        const prof = fakeUsers.get(p.get('code'));
        if (!prof || p.get('client_secret') !== 'shh') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid_grant' })); }
        return res.end(JSON.stringify({ access_token: `at-${p.get('code')}`, id_token: `${b64({ alg: 'none' })}.${b64({ sub: prof.sub, aud: 'cid', nonce: prof.nonce })}.x` }));
      }
      if (req.url.startsWith('/userinfo')) {
        const code = String(req.headers.authorization || '').replace('Bearer at-', '');
        const prof = fakeUsers.get(code);
        if (!prof) { res.statusCode = 401; return res.end('{}'); }
        return res.end(JSON.stringify({ sub: prof.sub, email: prof.email, email_verified: prof.verified !== false, name: prof.name }));
      }
      res.statusCode = 404; res.end('{}');
    });
  }).listen(0);
  await new Promise((r) => fake.once('listening', r));
  fakeBase = `http://127.0.0.1:${fake.address().port}`;
  admin = await loginAs('ahmed@ahdfinancial.com');
});
after(async () => { fake.close(); await srv.close(); });

test('public auth config and plan catalogue', async () => {
  const c = await api('GET', '/auth/config');
  assert.equal(c.status, 200);
  assert.equal(c.data.siteName, 'Masar');
  assert.equal(c.data.signup, 'open');
  assert.deepEqual(Object.keys(c.data.providers).sort(), ['apple', 'google', 'microsoft', 'slack']);
  assert.equal(c.data.providers.google.enabled, false);
  const p = await api('GET', '/plans');
  assert.deepEqual(p.data.plans.map((x) => x.key), ['free', 'standard', 'premium']);
  assert.equal(p.data.plans[1].price.monthly, 753);
});

test('email sign-up: code, wrong code, complete, login', async () => {
  const ex = await api('POST', '/auth/signup/start', { email: 'SARA@ahdfinancial.com' });
  assert.equal(ex.data.exists, true);
  assert.equal((await api('POST', '/auth/signup/start', { email: 'nope' })).status, 400);
  const s = await api('POST', '/auth/signup/start', { email: 'nadia@example.org' });
  assert.equal(s.status, 200);
  assert.match(s.data.devCode, /^\d{6}$/);
  const wrong = s.data.devCode === '000000' ? '111111' : '000000';
  const w = await api('POST', '/auth/signup/verify', { email: 'nadia@example.org', code: wrong });
  assert.equal(w.status, 400);
  assert.match(w.data.error, /isn’t right/);
  const v = await api('POST', '/auth/signup/verify', { email: 'nadia@example.org', code: s.data.devCode });
  assert.equal(v.status, 200);
  assert.ok(v.data.signupToken);
  assert.equal((await api('POST', '/auth/signup/complete', { signupToken: v.data.signupToken, name: 'Nadia', password: 'short' })).status, 400);
  const c = await api('POST', '/auth/signup/complete', { signupToken: v.data.signupToken, name: 'Nadia Omar', password: 'longpassword' });
  assert.equal(c.status, 201);
  assert.ok(c.data.token);
  assert.equal(c.data.user.role, 'member');
  const me = await api('GET', '/auth/me', null, { headers: { Authorization: `Bearer ${c.data.token}` } });
  assert.equal(me.data.user.email, 'nadia@example.org');
  // token can't be reused
  assert.equal((await api('POST', '/auth/signup/complete', { signupToken: v.data.signupToken, name: 'X', password: 'longpassword' })).status, 400);
  await loginAs('nadia@example.org', 'longpassword');
  const audit = await api('GET', '/audit?action=user.signed_up', null, { cookie: admin });
  assert.equal(audit.data.entries?.[0]?.target ?? audit.data[0]?.target, 'Nadia Omar');
});

test('sign-up policy: invite-only and domain restricted', async () => {
  assert.equal((await api('PUT', '/admin/site', { signup: 'invite' }, { cookie: admin })).status, 200);
  const r = await api('POST', '/auth/signup/start', { email: 'new1@example.org' });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'invite_only');
  assert.equal((await api('PUT', '/admin/site', { signup: 'domain', allowedDomains: 'ahdfinancial.com, masar.io' }, { cookie: admin })).data.allowedDomains.length, 2);
  assert.equal((await api('POST', '/auth/signup/start', { email: 'new1@example.org' })).status, 403);
  assert.equal((await api('POST', '/auth/signup/start', { email: 'new1@masar.io' })).status, 200);
  const omar = await loginAs('omar@ahdfinancial.com');
  assert.equal((await api('PUT', '/admin/site', { signup: 'open' }, { cookie: omar })).status, 403);
  await api('PUT', '/admin/site', { signup: 'open' }, { cookie: admin });
});

test('OAuth: not configured, configure, sign up via provider, link existing account', async () => {
  const nc = await api('GET', '/auth/oauth/google/start', null, { headers: { Accept: 'application/json' } });
  assert.equal(nc.status, 400);
  assert.equal(nc.data.code, 'provider_not_configured');
  const bad = await api('PUT', '/admin/auth-providers/google', { enabled: true, clientId: 'cid' }, { cookie: admin });
  assert.equal(bad.status, 400);
  const ok = await api('PUT', '/admin/auth-providers/google', { enabled: true, clientId: 'cid', clientSecret: 'shh', authUrl: `${fakeBase}/authorize`, tokenUrl: `${fakeBase}/token`, userinfoUrl: `${fakeBase}/userinfo` }, { cookie: admin });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.enabled, true);
  assert.equal(ok.data.hasClientSecret, true);
  assert.equal(ok.data.clientSecret, undefined);
  assert.match(ok.data.redirectUri, /\/api\/auth\/oauth\/google\/callback$/);
  assert.equal((await api('GET', '/auth/config')).data.providers.google.enabled, true);

  async function flow(profile) {
    const st = await api('GET', '/auth/oauth/google/start?popup=1');
    assert.equal(st.status, 302);
    const loc = new URL(st.headers.get('location'));
    assert.equal(loc.origin + loc.pathname, `${fakeBase}/authorize`);
    assert.equal(loc.searchParams.get('client_id'), 'cid');
    const code = crypto.randomBytes(6).toString('hex');
    fakeUsers.set(code, { ...profile, nonce: loc.searchParams.get('nonce') });
    return api('GET', `/auth/oauth/google/callback?code=${code}&state=${loc.searchParams.get('state')}`);
  }
  const r1 = await flow({ sub: 'g-1', email: 'hana@gmail.com', name: 'Hana Ali' });
  assert.equal(r1.status, 200);
  assert.match(r1.data, /masar-oauth/);
  const token = r1.data.match(/"token":"([a-f0-9]+)"/)[1];
  const me = await api('GET', '/auth/me', null, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.data.user.name, 'Hana Ali');
  // same subject again → same user, not a duplicate
  const r2 = await flow({ sub: 'g-1', email: 'hana@gmail.com', name: 'Hana Ali' });
  assert.match(r2.data, /"created":false/);
  // existing Masar account gets linked by verified email
  const r3 = await flow({ sub: 'g-2', email: 'omar@ahdfinancial.com', name: 'Omar' });
  const t3 = r3.data.match(/"token":"([a-f0-9]+)"/)[1];
  assert.equal((await api('GET', '/auth/me', null, { headers: { Authorization: `Bearer ${t3}` } })).data.user.id, 'u3');
  // unverified email is refused; replayed state is refused
  const r4 = await flow({ sub: 'g-3', email: 'evil@ahdfinancial.com', verified: false });
  assert.equal(r4.status, 400);
  assert.match(r4.data, /isn’t verified/);
  const replay = await api('GET', '/auth/oauth/google/callback?code=x&state=deadbeef');
  assert.match(replay.data, /expired/);
  const list = await api('GET', '/admin/auth-providers', null, { cookie: admin });
  assert.equal(list.data.find((p) => p.key === 'google').users, 2);
});

test('billing: summary, checkout with mock cards, invoices, proration', async () => {
  const b = await api('GET', '/billing', null, { cookie: admin });
  assert.equal(b.status, 200);
  assert.equal(b.data.subscription.plan, 'premium');
  assert.equal(b.data.paymentMethod.last4, '4242');
  assert.equal(b.data.canManage, true);
  const omar = await loginAs('omar@ahdfinancial.com');
  const ob = await api('GET', '/billing', null, { cookie: omar });
  assert.equal(ob.data.canManage, false);
  assert.equal(ob.data.paymentMethod, undefined);
  assert.equal((await api('POST', '/billing/checkout', { plan: 'standard', cycle: 'annual', useSaved: true }, { cookie: omar })).status, 403);

  const card = { holder: 'Ahmed', number: '4242 4242 4242 4241', exp: '12/30', cvc: '123' };
  const luhn = await api('POST', '/billing/checkout', { plan: 'standard', cycle: 'annual', card }, { cookie: admin });
  assert.equal(luhn.status, 400);
  assert.equal(luhn.data.field, 'number');
  const dec = await api('POST', '/billing/checkout', { plan: 'standard', cycle: 'annual', card: { ...card, number: '4000000000000002' } }, { cookie: admin });
  assert.equal(dec.status, 402);
  assert.equal(dec.data.code, 'card_declined');
  const exp = await api('POST', '/billing/checkout', { plan: 'standard', cycle: 'annual', card: { ...card, number: '4242424242424242', exp: '01/20' } }, { cookie: admin });
  assert.equal(exp.data.field, 'exp');

  const q = await api('GET', '/billing/quote?plan=standard&cycle=annual', null, { cookie: admin });
  assert.ok(q.data.lines.some((l) => l.amount < 0), 'credit line for unused premium time');
  const co = await api('POST', '/billing/checkout', { plan: 'standard', cycle: 'annual', card: { ...card, number: '5555555555554444' } }, { cookie: admin });
  assert.equal(co.status, 201, JSON.stringify(co.data));
  assert.equal(co.data.subscription.plan, 'standard');
  assert.equal(co.data.subscription.cycle, 'annual');
  assert.equal(co.data.invoice.total, q.data.total);
  const inv = await api('GET', '/billing/invoices', null, { cookie: admin });
  assert.equal(inv.data.length, 4);
  assert.equal(inv.data[0].card, 'Mastercard •••• 4444');
  const html = await api('GET', `/billing/invoices/${inv.data[0].id}/html`, null, { cookie: admin });
  assert.match(html.data, /Invoice/);
  assert.match(html.data, new RegExp(inv.data[0].number));
});

test('plan limits: Standard locks the audit log, Free locks permissions and caps seats', async () => {
  const a = await api('GET', '/audit', null, { cookie: admin });
  assert.equal(a.status, 402);
  assert.equal(a.data.code, 'plan_limit');
  assert.equal(a.data.upgradeTo, 'premium');
  // permissions still work on Standard
  const k = await loginAs('khalid@ahdfinancial.com');
  assert.equal((await api('GET', '/mypermissions?project=FIN', null, { cookie: k })).data.role, 'viewer');

  // cancel → still Standard until period end; resume works
  const c = await api('POST', '/billing/cancel', null, { cookie: admin });
  assert.equal(c.data.subscription.cancelAtPeriodEnd, true);
  assert.equal((await api('POST', '/billing/resume', null, { cookie: admin })).data.subscription.cancelAtPeriodEnd, false);
  await api('POST', '/billing/cancel', null, { cookie: admin });
  // fast-forward: end the period now
  const { db, sql, container } = srv;
  await db.query(sql`UPDATE subscription SET current_period_end = ${new Date(Date.now() - 1000).toISOString()} WHERE id = 1`);
  container.billing.invalidate();
  const after = await api('GET', '/billing', null, { cookie: admin });
  assert.equal(after.data.subscription.plan, 'free');
  // Free: access levels & viewer roles no longer apply, custom permissions locked
  assert.equal((await api('GET', '/mypermissions?project=FIN', null, { cookie: k })).data.role, 'member');
  const perm = await api('PUT', '/projects/KAN/permissions', { scheme: {} }, { cookie: admin });
  assert.equal(perm.status, 402);
  assert.equal(perm.data.upgradeTo, 'standard');
  assert.equal((await api('PATCH', '/projects/PAY', { access: 'private' }, { cookie: admin })).status, 402);
  assert.equal((await api('GET', '/meta', null, { cookie: admin })).data.plan.key, 'free');
  assert.equal((await api('GET', '/trash?project=KAN', null, { cookie: admin })).data.retentionDays, 7);
  // seats: 7 seeded + Nadia + Hana = 9 → one more fits, then the 11th is refused
  const u1 = await api('POST', '/users', { name: 'Ten', email: 'ten@ahdfinancial.com', password: 'password1' }, { cookie: admin });
  assert.equal(u1.status, 201, JSON.stringify(u1.data));
  const u2 = await api('POST', '/users', { name: 'Eleven', email: 'eleven@ahdfinancial.com', password: 'password1' }, { cookie: admin });
  assert.equal(u2.status, 402);
  assert.equal(u2.data.limit, 'users');
  const su = await api('POST', '/auth/signup/start', { email: 'twelve@example.org' });
  assert.equal(su.status, 402);
  // trial
  const tr = await api('POST', '/billing/trial', { plan: 'premium' }, { cookie: admin });
  assert.equal(tr.status, 400, 'seeded site already used its trial');
  await db.query(sql`UPDATE subscription SET trial_used = false WHERE id = 1`); container.billing.invalidate();
  const tr2 = await api('POST', '/billing/trial', { plan: 'premium' }, { cookie: admin });
  assert.equal(tr2.data.subscription.status, 'trialing');
  assert.equal((await api('POST', '/users', { name: 'Eleven', email: 'eleven@ahdfinancial.com', password: 'password1' }, { cookie: admin })).status, 201);
  assert.equal((await api('GET', '/audit', null, { cookie: admin })).status, 200);
});

test('storage limit on attachments', async () => {
  const { db, sql, container } = srv;
  await container.billing.update({ plan: 'free', status: 'active', current_period_end: null });
  await db.query(sql`UPDATE users SET active = false WHERE email IN ('ten@ahdfinancial.com', 'eleven@ahdfinancial.com')`);
  const issueId = await db.value(sql`SELECT id FROM issues WHERE key = 'KAN-1'`);
  await db.query(sql`INSERT INTO attachments (issue_id, filename, mime, size, stored_name, uploader_id) VALUES (${issueId}, 'big.bin', 'application/octet-stream', ${2 * 1024 ** 3 - 10}, 'none', 'u1')`);
  const r = await api('POST', '/issues/KAN-1/attachments', Buffer.alloc(100, 1), { cookie: admin, raw: true, headers: { 'X-Filename': 'x.bin', 'Content-Type': 'application/octet-stream' } });
  assert.equal(r.status, 402);
  assert.equal(r.data.limit, 'storage');
});
