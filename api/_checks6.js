const http = require('http');
const show = (label, r, f = (d) => JSON.stringify(d).slice(0, 160)) => console.log(r.status < 400 ? 'OK ' : 'ERR', r.status, label, r.status < 400 ? f(r.data) : JSON.stringify(r.data).slice(0, 250));
const anon = async (method, path, body) => { const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; };
show('config', await anon('GET', '/auth/config'));
let r = await anon('POST', '/auth/signup/start', { email: 'Ahmed@ahdfinancial.com' }); show('start existing', r);
r = await anon('POST', '/auth/signup/start', { email: 'new.person@example.com' }); show('start', r);
const code = r.data.devCode;
show('verify wrong', await anon('POST', '/auth/signup/verify', { email: 'new.person@example.com', code: code === '000000' ? '111111' : '000000' }));
r = await anon('POST', '/auth/signup/verify', { email: 'new.person@example.com', code }); show('verify', r);
show('complete short pw', await anon('POST', '/auth/signup/complete', { signupToken: r.data.signupToken, name: 'New Person', password: 'x' }));
r = await anon('POST', '/auth/signup/complete', { signupToken: r.data.signupToken, name: 'New Person', password: 'password123' }); show('complete', r, (d) => `${d.user.id} ${d.user.name} token=${!!d.token}`);
const newTok = r.data.token;
let me = await fetch(base + '/auth/me', { headers: { authorization: 'Bearer ' + newTok } }); console.log('me with new token', me.status);
show('site', await call('GET', '/admin/site'));
show('site domain no list', await call('PUT', '/admin/site', { signup: 'domain', allowedDomains: [] }));
show('site domain', await call('PUT', '/admin/site', { signup: 'domain', allowedDomains: 'ahdfinancial.com' }));
show('start blocked domain', await anon('POST', '/auth/signup/start', { email: 'x@gmail.com' }));
show('site open', await call('PUT', '/admin/site', { signup: 'open', allowedDomains: [] }));
show('providers', await call('GET', '/admin/auth-providers'), (d) => d.map((p) => `${p.key}:${p.enabled}:${p.redirectUri.slice(-40)}`).join(' '));
show('enable without creds', await call('PUT', '/admin/auth-providers/google', { enabled: true }));
// fake OIDC provider
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/token')) {
      const p = new URLSearchParams(b);
      const claims = { sub: 'g-123', email: 'social.user@example.com', email_verified: true, name: 'Social User', aud: 'cid', nonce: fake.nonce };
      return res.end(JSON.stringify({ access_token: 'at', id_token: 'x.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.y', code: p.get('code') }));
    }
    if (req.url.startsWith('/userinfo')) return res.end(JSON.stringify({ sub: 'g-123', email: 'social.user@example.com', name: 'Social User' }));
    res.statusCode = 404; res.end('{}');
  });
}).listen(0);
const fp = fake.address().port;
show('configure google', await call('PUT', '/admin/auth-providers/google', { clientId: 'cid', clientSecret: 'sec', enabled: true, authUrl: `http://127.0.0.1:${fp}/auth`, tokenUrl: `http://127.0.0.1:${fp}/token`, userinfoUrl: `http://127.0.0.1:${fp}/userinfo` }), (d) => `${d.enabled} ${d.configured} secret=${d.hasClientSecret}`);
r = await anon('GET', '/auth/oauth/google/start?popup=1'); show('oauth start', r, (d) => d.url.slice(0, 80));
const u = new URL(r.data.url); fake.nonce = u.searchParams.get('nonce');
let cb = await fetch(base + `/auth/oauth/google/callback?code=abc&state=${u.searchParams.get('state')}`);
let html = await cb.text(); console.log('callback', cb.status, /"token":"[0-9a-f]+"/.test(html), /"created":true/.test(html), html.match(/"error":"[^"]*"/)?.[0]);
cb = await fetch(base + `/auth/oauth/google/callback?code=abc&state=${u.searchParams.get('state')}`);
html = await cb.text(); console.log('replay', cb.status, html.match(/"error":"[^"]*"/)?.[0]);
r = await anon('GET', '/auth/oauth/google/start'); const u2 = new URL(r.data.url); fake.nonce = u2.searchParams.get('nonce');
cb = await fetch(base + `/auth/oauth/google/callback?code=abc&state=${u2.searchParams.get('state')}`); html = await cb.text();
const tok2 = html.match(/"token":"([0-9a-f]+)"/)?.[1]; console.log('second login', cb.status, /"created":false/.test(html));
const ids = await fetch(base + '/auth/identities', { headers: { authorization: 'Bearer ' + tok2 } }); console.log('identities', ids.status, JSON.stringify(await ids.json()));
const un = await fetch(base + '/auth/identities/google', { method: 'DELETE', headers: { authorization: 'Bearer ' + tok2 } }); console.log('unlink only method', un.status, JSON.stringify(await un.json()));
show('disable google', await call('PUT', '/admin/auth-providers/google', { enabled: false, clientId: '', clientSecret: null, authUrl: '', tokenUrl: '', userinfoUrl: '' }), (d) => `${d.enabled} ${d.configured}`);
cb = await fetch(base + '/auth/oauth/google/start?popup=1'); console.log('start disabled html', cb.status, (await cb.text()).includes('isn’t set up'));
fake.close();
