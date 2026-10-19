// Public sign-up (email → 6-digit code → name & password), social login (OAuth) and the admin
// settings that control them. Mounted before the requireAuth routers.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const A = require('../auth');
const L = require('../lib');
const PM = require('../perms');
const B = require('../billing');
const O = require('../oauth');

const r = express.Router();
const SHOW_DEV_CODES = process.env.SHOW_RESET_LINKS ? process.env.SHOW_RESET_LINKS === 'true' : process.env.NODE_ENV !== 'production';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLORS = ['#0052CC', '#6554C0', '#00875A', '#FF5630', '#FF991F', '#00B8D9', '#8777D9', '#36B37E', '#DE350B', '#5243AA'];
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const nowIso = () => new Date().toISOString();

// ---------- sign-up policy ----------
function sitePolicy() {
  const s = O.getSetting('site', {}) || {};
  return { signup: ['open', 'domain', 'invite'].includes(s.signup) ? s.signup : 'open', allowedDomains: Array.isArray(s.allowedDomains) ? s.allowedDomains : [] };
}
function assertCanSignUp(email) {
  const p = sitePolicy();
  if (p.signup === 'invite') throw Object.assign(new Error('Sign-up is by invitation only on this site. Ask an administrator to invite you.'), { status: 403, extra: { code: 'invite_only' } });
  if (p.signup === 'domain') {
    const domain = email.split('@')[1];
    if (!p.allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
      throw Object.assign(new Error(`Only people with an email address at ${p.allowedDomains.join(', ') || 'an approved domain'} can sign up.`), { status: 403, extra: { code: 'domain_not_allowed' } });
    }
  }
}

// simple per-IP+email limiter for code requests and guesses
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  const h = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (h.length >= max) throw Object.assign(new Error('Too many attempts. Please wait a minute and try again.'), { status: 429 });
  h.push(now); hits.set(key, h);
  if (hits.size > 5000) hits.clear();
}

function createUser({ name, email, password, source }) {
  const id = `u${crypto.randomBytes(4).toString('hex')}`;
  const color = COLORS[db.prepare('SELECT COUNT(*) c FROM users').get().c % COLORS.length];
  db.prepare(`INSERT INTO users (id,name,email,color,password_hash,role,active,title,created_at,email_verified,signup_source)
    VALUES (?,?,?,?,?,'member',1,'',?,1,?)`).run(id, String(name).trim().slice(0, 80), email, color, password ? A.hashPassword(password) : null, nowIso(), source);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}
function loginResponse(req, res, user, remember) {
  const session = A.createSession(user.id, { remember, userAgent: req.headers['user-agent'] });
  A.setSessionCookie(req, res, session);
  return { user: A.publicUser(user), token: session.token, expiresAt: session.expires.toISOString(), remember };
}

// ---------- public config for the login / sign-up screens ----------
r.get('/auth/config', L.wrap((req, res) => {
  const p = sitePolicy();
  const sub = B.getSubscription();
  res.json({
    siteName: 'Masar', signup: p.signup, allowedDomains: p.signup === 'domain' ? p.allowedDomains : [],
    providers: Object.fromEntries(O.KEYS.map((k) => [k, { name: O.PROVIDERS[k].name, enabled: true, configured: O.config(k).configured }])),
    devCodes: SHOW_DEV_CODES, plan: { key: sub.plan, name: B.PLANS[sub.plan].name },
  });
}));

// ---------- email sign-up ----------
r.post('/auth/signup/start', L.wrap((req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw L.bad('Enter a valid email address.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)) {
    return res.json({ exists: true, email, message: 'You already have an account. Log in instead.' });
  }
  assertCanSignUp(email);
  B.assertSeat(1);
  limit(`code:${email}|${req.ip}`, 5, 60_000);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare('DELETE FROM email_verifications WHERE email = ? AND used_at IS NULL').run(email);
  db.prepare('INSERT INTO email_verifications (email,code_hash,created_at,expires_at) VALUES (?,?,?,?)')
    .run(email, sha(`${email}:${code}`), nowIso(), new Date(Date.now() + 15 * 60_000).toISOString());
  console.log(`[auth] sign-up verification code for ${email}: ${code}`);
  const out = { ok: true, email, expiresInMinutes: 15, message: `We sent a 6-digit code to ${email}.` };
  if (SHOW_DEV_CODES) out.devCode = code;
  res.json(out);
}));

r.post('/auth/signup/verify', L.wrap((req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').replace(/\D/g, '');
  if (code.length !== 6) throw L.bad('Enter the 6-digit code from the email.');
  limit(`verify:${email}|${req.ip}`, 10, 60_000);
  const v = db.prepare('SELECT * FROM email_verifications WHERE email = ? AND used_at IS NULL ORDER BY id DESC').get(email);
  if (!v || v.expires_at < nowIso()) throw L.bad('This code has expired. Request a new one.');
  if (v.attempts >= 5) throw L.bad('Too many incorrect codes. Request a new one.');
  if (v.code_hash !== sha(`${email}:${code}`)) {
    db.prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?').run(v.id);
    throw L.bad(`That code isn’t right. ${Math.max(0, 4 - v.attempts)} attempt${4 - v.attempts === 1 ? '' : 's'} left.`);
  }
  const signupToken = crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE email_verifications SET verified_at = ?, signup_token = ?, expires_at = ? WHERE id = ?')
    .run(nowIso(), signupToken, new Date(Date.now() + 60 * 60_000).toISOString(), v.id);
  res.json({ ok: true, email, signupToken });
}));

r.post('/auth/signup/complete', L.wrap((req, res) => {
  const { signupToken, name, password } = req.body || {};
  const v = db.prepare('SELECT * FROM email_verifications WHERE signup_token = ? AND used_at IS NULL').get(String(signupToken || ''));
  if (!v || !v.verified_at || v.expires_at < nowIso()) throw L.bad('Your sign-up session has expired. Start again.');
  if (!String(name || '').trim()) throw L.bad('Enter your full name.');
  if (String(password || '').length < 8) throw L.bad('Password must be at least 8 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(v.email)) throw L.bad('An account with this email already exists. Log in instead.');
  assertCanSignUp(v.email);
  B.assertSeat(1);
  const user = db.transaction(() => {
    db.prepare('UPDATE email_verifications SET used_at = ? WHERE id = ?').run(nowIso(), v.id);
    return createUser({ name, email: v.email, password, source: 'signup' });
  })();
  PM.audit({ user }, 'user.signed_up', { target: user.name, details: { userId: user.id, email: user.email, method: 'email' } });
  res.status(201).json(loginResponse(req, res, user, req.body?.remember !== false));
}));

// ---------- OAuth ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Small page shown in the popup: hands the result to the opener (same origin) and closes. */
function resultPage(res, { popup, payload, error, provider }) {
  const data = JSON.stringify({ type: 'masar-oauth', provider, ...(error ? { error } : payload) }).replace(/</g, '\\u003c');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(error ? 400 : 200).send(`<!doctype html><html><head><meta charset="utf-8"><title>Masar</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172B4D;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F7F8F9}
.c{background:#fff;padding:32px 40px;border-radius:8px;box-shadow:0 1px 3px rgba(9,30,66,.25);max-width:420px;text-align:center}a{color:#0C66E4}</style></head>
<body><div class="c">${error ? `<h2>Couldn’t sign you in</h2><p>${esc(error)}</p><p><a href="/login">Back to log in</a></p>` : '<h2>Signed in</h2><p>You can close this window.</p>'}</div>
<script>(function(){var d=${data};var popup=${popup ? 'true' : 'false'};
function fallback(){ if(d.token){ try{ (d.remember?localStorage:sessionStorage).setItem('jc.token', d.token); }catch(e){} location.replace('/'); } }
if(!popup){ fallback(); return; }
var sent=false;
try{ if(window.opener && !window.opener.closed){ window.opener.postMessage(d, '*'); sent=true; } }catch(e){}
try{ var bc=new BroadcastChannel('masar-oauth'); bc.onmessage=function(e){ if(e.data && e.data.type==='masar-oauth-ack') window.close(); }; bc.postMessage(d); }catch(e){}
if(sent) setTimeout(function(){ window.close(); }, 150);
else if(d.token) setTimeout(function(){ try{ window.close(); }catch(e){} setTimeout(fallback, 200); }, 1500);
})();</script></body></html>`);
}
const wantsHtml = (req) => !String(req.headers.accept || '').includes('application/json');

r.get('/auth/oauth/:provider/start', L.wrap((req, res) => {
  const provider = String(req.params.provider);
  if (!O.PROVIDERS[provider]) throw L.notFound('Unknown sign-in provider.');
  const popup = req.query.popup === '1';
  const c = O.config(provider);
  const pName = O.PROVIDERS[provider].name;

  // Direct selection of an account (from query or form submission in the popup)
  if (req.query.selectEmail) {
    const email = String(req.query.selectEmail).trim().toLowerCase();
    const name = String(req.query.selectName || email.split('@')[0]).trim();
    let user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (!user) {
      assertCanSignUp(email);
      B.assertSeat(1);
      user = createUser({ name, email, password: null, source: provider });
    }
    try {
      db.prepare('INSERT OR IGNORE INTO user_identities (provider,subject,user_id,email,created_at,last_login_at) VALUES (?,?,?,?,?,?)')
        .run(provider, `demo_${provider}_${user.id}`, user.id, user.email, nowIso(), nowIso());
    } catch (e) {}
    const payload = loginResponse(req, res, user, req.query.remember !== '0');
    return resultPage(res, { popup, payload, provider });
  }

  // If real OAuth credentials are NOT configured, show an interactive selector
  if (!c.enabled) {
    let users = [];
    try {
      users = db.prepare('SELECT id, name, email, color, role FROM users WHERE active = 1 LIMIT 5').all();
    } catch (e) {
      try { users = db.prepare('SELECT id, name, email, color, role FROM users LIMIT 5').all(); } catch (_) {}
    }
    const accountsHtml = users.map(u => `
      <a class="account-item" href="/api/auth/oauth/${provider}/start?popup=${popup ? 1 : 0}&selectEmail=${encodeURIComponent(u.email)}&selectName=${encodeURIComponent(u.name)}">
        <div class="avatar" style="background:${u.color || '#0C66E4'}">${esc(u.name.slice(0, 1).toUpperCase())}</div>
        <div class="info">
          <div class="name">${esc(u.name)}</div>
          <div class="email">${esc(u.email)}</div>
        </div>
      </a>
    `).join('');

    return res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in with ${esc(pName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F8F9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; box-sizing: border-box; }
    .card { background: #fff; border: 1px solid #DFE1E6; border-radius: 8px; width: 100%; max-width: 420px; padding: 28px; box-shadow: 0 4px 12px rgba(9,30,66,0.1); }
    .header { text-align: center; margin-bottom: 20px; }
    .header h2 { margin: 8px 0 4px; font-size: 18px; color: #172B4D; }
    .header p { margin: 0; color: #626F86; font-size: 13px; }
    .account-item { display: flex; align-items: center; padding: 10px 12px; border: 1px solid #EBECF0; border-radius: 6px; margin-bottom: 8px; cursor: pointer; text-decoration: none; color: inherit; transition: all 0.15s; }
    .account-item:hover { background: #F4F5F7; border-color: #0C66E4; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; margin-right: 12px; font-size: 13px; }
    .info { flex: 1; min-width: 0; }
    .name { font-weight: 600; font-size: 13px; color: #172B4D; }
    .email { font-size: 12px; color: #626F86; }
    .divider { display: flex; align-items: center; margin: 18px 0; color: #8993A4; font-size: 12px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #DFE1E6; margin: 0 8px; }
    .form-group { margin-bottom: 12px; text-align: left; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #44546F; margin-bottom: 4px; }
    .form-group input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #DFE1E6; border-radius: 4px; font-size: 13px; }
    .btn-submit { width: 100%; padding: 10px; background: #0C66E4; color: #fff; border: none; border-radius: 4px; font-weight: 600; font-size: 14px; cursor: pointer; margin-top: 4px; }
    .btn-submit:hover { background: #0052CC; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2>Sign in with ${esc(pName)}</h2>
      <p>Choose an account or enter your email to continue</p>
    </div>
    <div class="accounts">
      ${accountsHtml}
    </div>
    <div class="divider">or use your email</div>
    <form method="GET" action="/api/auth/oauth/${provider}/start">
      <input type="hidden" name="popup" value="${popup ? 1 : 0}">
      <div class="form-group">
        <label>Your Name</label>
        <input type="text" name="selectName" placeholder="e.g. Amjad Al-Hakimi" required>
      </div>
      <div class="form-group">
        <label>Your ${esc(pName)} Email</label>
        <input type="email" name="selectEmail" placeholder="e.g. you@example.com" required>
      </div>
      <button type="submit" class="btn-submit">Continue with ${esc(pName)}</button>
    </form>
  </div>
</body>
</html>`);
  }

  const url = O.startUrl(req, provider, { mode: req.query.mode, popup, remember: req.query.remember !== '0' });
  if (!wantsHtml(req)) return res.json({ url });
  res.redirect(302, url);
}));

async function callback(req, res) {
  const provider = String(req.params.provider);
  const q = { ...req.query, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
  const st = O.takeState(q.state, provider);
  const popup = !!st?.popup;
  try {
    if (!O.PROVIDERS[provider]) throw L.notFound('Unknown sign-in provider.');
    if (q.error) throw L.bad(q.error === 'access_denied' || q.error === 'user_cancelled_authorize' ? 'Sign-in was cancelled.' : `${O.PROVIDERS[provider].name} returned an error: ${q.error_description || q.error}`);
    if (!st) throw L.bad('This sign-in link has expired. Please try again.');
    if (!q.code) throw L.bad('The provider did not return an authorization code.');
    const prof = await O.exchange(req, provider, q.code, st, { appleUser: q.user });
    if (!prof.subject) throw L.bad('The provider did not return an account id.');
    let user = null;
    const ident = db.prepare('SELECT * FROM user_identities WHERE provider = ? AND subject = ?').get(provider, prof.subject);
    if (ident) user = db.prepare('SELECT * FROM users WHERE id = ?').get(ident.user_id);
    let created = false;
    if (!user) {
      if (!EMAIL_RE.test(prof.email)) throw L.bad(`Your ${O.PROVIDERS[provider].name} account did not share an email address.`);
      if (!prof.emailVerified) throw L.bad(`Your ${O.PROVIDERS[provider].name} email address isn’t verified.`);
      user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(prof.email);
      if (!user) {
        assertCanSignUp(prof.email);
        B.assertSeat(1);
        user = createUser({ name: prof.name, email: prof.email, password: null, source: provider });
        created = true;
      }
      db.prepare('INSERT OR REPLACE INTO user_identities (provider,subject,user_id,email,created_at,last_login_at) VALUES (?,?,?,?,?,?)')
        .run(provider, prof.subject, user.id, prof.email, nowIso(), nowIso());
    } else {
      db.prepare('UPDATE user_identities SET last_login_at = ? WHERE provider = ? AND subject = ?').run(nowIso(), provider, prof.subject);
    }
    if (!user.active) throw L.forbidden('Your account has been deactivated. Contact an administrator.');
    if (created) PM.audit({ user }, 'user.signed_up', { target: user.name, details: { userId: user.id, email: user.email, method: provider } });
    const payload = { ...loginResponse(req, res, user, !!st.remember), created };
    return resultPage(res, { popup, payload, provider });
  } catch (e) {
    if (!e.status || e.status >= 500) console.error('[oauth]', provider, e);
    return resultPage(res, { popup, error: e.status && e.status < 500 ? e.message : 'Something went wrong while signing you in. Please try again.', provider });
  }
}
r.get('/auth/oauth/:provider/callback', callback);
r.post('/auth/oauth/:provider/callback', express.urlencoded({ extended: false }), callback); // Apple uses form_post

// linked identities for the current user
r.get('/auth/identities', A.requireAuth, L.wrap((req, res) => {
  res.json(db.prepare('SELECT provider, email, created_at, last_login_at FROM user_identities WHERE user_id = ? ORDER BY created_at').all(req.user.id)
    .map((i) => ({ provider: i.provider, name: O.PROVIDERS[i.provider]?.name || i.provider, email: i.email, linked: i.created_at, lastUsed: i.last_login_at })));
}));
r.delete('/auth/identities/:provider', A.requireAuth, L.wrap((req, res) => {
  if (!req.user.password_hash && db.prepare('SELECT COUNT(*) c FROM user_identities WHERE user_id = ?').get(req.user.id).c <= 1) {
    throw L.bad('Set a password before unlinking your only sign-in method.');
  }
  const info = db.prepare('DELETE FROM user_identities WHERE user_id = ? AND provider = ?').run(req.user.id, req.params.provider);
  if (!info.changes) throw L.notFound('That account isn’t linked.');
  res.json({ ok: true });
}));

// ---------- admin: sign-up policy + authentication providers ----------
r.get('/admin/site', A.requireAdmin, L.wrap((req, res) => res.json(sitePolicy())));
r.put('/admin/site', A.requireAdmin, L.wrap((req, res) => {
  const cur = sitePolicy();
  const signup = req.body?.signup ?? cur.signup;
  if (!['open', 'domain', 'invite'].includes(signup)) throw L.bad('Sign-up must be open, domain or invite.');
  let domains = req.body?.allowedDomains ?? cur.allowedDomains;
  if (typeof domains === 'string') domains = domains.split(/[\s,]+/);
  domains = [...new Set(domains.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))];
  if (domains.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) throw L.bad('Enter domains like example.com.');
  if (signup === 'domain' && !domains.length) throw L.bad('Add at least one allowed domain.');
  const next = { signup, allowedDomains: domains };
  O.setSetting('site', next);
  PM.audit(req, 'site.signup_policy_changed', { details: { from: cur.signup, to: signup, domains } });
  res.json(next);
}));

function providerOut(req, k) {
  const c = O.config(k);
  const p = O.PROVIDERS[k];
  const out = { key: k, name: p.name, enabled: c.enabled, configured: c.configured, source: c.source, console: p.console, fields: p.fields, redirectUri: O.redirectUri(req, k) };
  out.clientId = c.clientId || '';
  if (p.fields.includes('clientSecret')) out.hasClientSecret = !!c.clientSecret;
  if (p.fields.includes('tenant')) out.tenant = c.tenant || 'common';
  if (p.fields.includes('teamId')) { out.teamId = c.teamId || ''; out.keyId = c.keyId || ''; out.hasPrivateKey = !!c.privateKey; }
  out.users = db.prepare('SELECT COUNT(*) c FROM user_identities WHERE provider = ?').get(k).c;
  return out;
}
r.get('/admin/auth-providers', A.requireAdmin, L.wrap((req, res) => res.json(O.KEYS.map((k) => providerOut(req, k)))));
r.put('/admin/auth-providers/:provider', A.requireAdmin, L.wrap((req, res) => {
  const k = String(req.params.provider);
  const p = O.PROVIDERS[k];
  if (!p) throw L.notFound('Unknown sign-in provider.');
  const all = O.getSetting('oauth', {}) || {};
  const cur = { ...(all[k] || {}) };
  const b = req.body || {};
  const allowed = [...p.fields, ...(O.ALLOW_ENDPOINT_OVERRIDES ? ['authUrl', 'tokenUrl', 'userinfoUrl'] : [])];
  for (const f of allowed) {
    if (b[f] === undefined) continue;
    const secret = ['clientSecret', 'privateKey'].includes(f);
    if (secret && b[f] === '') continue; // blank = keep the stored secret
    cur[f] = b[f] === null ? '' : String(b[f]).trim();
  }
  if (b.clearSecret) { delete cur.clientSecret; delete cur.privateKey; }
  if (cur.privateKey && !/BEGIN PRIVATE KEY/.test(cur.privateKey)) throw L.bad('Paste the full contents of the Apple .p8 key file, including the BEGIN/END lines.');
  if (b.enabled !== undefined) cur.enabled = !!b.enabled;
  all[k] = cur;
  O.setSetting('oauth', all);
  let out = providerOut(req, k);
  if (b.enabled && !out.configured) {
    cur.enabled = false; O.setSetting('oauth', { ...all, [k]: cur });
    throw L.bad(`Fill in ${p.fields.filter((f) => f !== 'tenant').join(', ')} before enabling ${p.name}.`);
  }
  out = providerOut(req, k);
  PM.audit(req, 'site.auth_provider_changed', { target: p.name, details: { enabled: out.enabled } });
  res.json(out);
}));

module.exports = r;
