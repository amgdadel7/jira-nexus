// Run: npm test   (uses a temporary database)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers/testServer');

let srv; let base; let cookie = '';

async function api(method, url, body, { raw, headers = {}, auth = true } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(auth && cookie ? { Cookie: cookie } : {}), ...headers },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

async function loginAs(email) {
  const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'password' }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const as = (c) => ({ auth: false, headers: { Cookie: c } });

before(async () => {
  srv = await startTestServer();
  base = srv.base;
});
after(() => srv.close());

test('rejects unauthenticated requests', async () => {
  const r = await api('GET', '/search', null, { auth: false });
  assert.equal(r.status, 401);
});

test('login fails with wrong password and succeeds with the right one', async () => {
  assert.equal((await api('POST', '/auth/login', { email: 'ahmed@ahdfinancial.com', password: 'nope' })).status, 401);
  const r = await api('POST', '/auth/login', { email: 'ahmed@ahdfinancial.com', password: 'password' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'admin');
  cookie = r.headers.get('set-cookie').split(';')[0];
  const me = await api('GET', '/auth/me');
  assert.equal(me.data.user.name, 'Ahmed Al-Haddad');
});

test('JQL search: default rank order, filters, errors', async () => {
  const all = await api('GET', `/search?jql=${encodeURIComponent('project = KAN ORDER BY cf[10019] ASC')}`);
  assert.equal(all.status, 200);
  assert.equal(all.data.total, 30);
  const ranks = all.data.issues.map((i) => i.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));

  const mine = await api('GET', `/search?jql=${encodeURIComponent('assignee = currentUser() AND status != Done ORDER BY priority DESC')}`);
  assert.ok(mine.data.issues.every((i) => i.assigneeId === 'u1' && i.status !== 'Done'));
  assert.equal(mine.data.issues[0].priority === 'Highest' || mine.data.issues[0].priority === 'High', true);

  const paged = await api('GET', `/search?jql=${encodeURIComponent('project = KAN')}&startAt=10&maxResults=5`);
  assert.equal(paged.data.issues.length, 5);
  assert.equal(paged.data.total, 30);

  const watched = await api('GET', `/search?jql=${encodeURIComponent('watcher = currentUser()')}`);
  assert.ok(watched.data.total > 0);

  const cat = await api('GET', `/search?jql=${encodeURIComponent('project = KAN AND statusCategory = "In Progress"')}`);
  assert.equal(cat.status, 200);
  assert.equal(cat.data.total, 10); // In Progress (8) + In Review (2)
  const notDone = await api('GET', `/search?jql=${encodeURIComponent('project = KAN AND statusCategory != Done ORDER BY priority DESC, updated DESC')}`);
  assert.equal(notDone.data.total, 23);

  const err = await api('GET', `/search?jql=${encodeURIComponent('statsu = Done')}`);
  assert.equal(err.status, 400);
  assert.match(err.data.error, /statsu/);
});

test('create, update, history, delete a work item', async () => {
  const c = await api('POST', '/issues', { summary: 'Test item', type: 'Bug', priority: 'High', assigneeId: 'u2', labels: ['a b', 'x'] });
  assert.equal(c.status, 201);
  assert.match(c.data.key, /^KAN-\d+$/);
  assert.deepEqual(c.data.labels, ['a_b', 'x']);
  const u = await api('PATCH', `/issues/${c.data.key}`, { status: 'Done' });
  assert.equal(u.data.status, 'Done');
  assert.ok(u.data.resolved);
  const d = await api('GET', `/issues/${c.data.key}`);
  assert.ok(d.data.history.some((h) => h.field === 'status' && h.to === 'Done'));
  assert.equal((await api('PATCH', `/issues/${c.data.key}`, { summary: '' })).status, 400);
  assert.equal((await api('PATCH', `/issues/${c.data.key}`, { startDate: '2030-01-10', dueDate: '2030-01-01' })).status, 400);
  assert.equal((await api('DELETE', `/issues/${c.data.key}`)).status, 200);
  assert.equal((await api('GET', `/issues/${c.data.key}`)).status, 404);
});

test('rank: move an item before another', async () => {
  await api('POST', '/issues/KAN-3/rank', { beforeKey: 'KAN-1' });
  const all = await api('GET', `/search?jql=${encodeURIComponent('project = KAN ORDER BY cf[10019] ASC')}`);
  const keys = all.data.issues.map((i) => i.key);
  assert.ok(keys.indexOf('KAN-3') < keys.indexOf('KAN-1'));
});

test('comments, mentions and notifications', async () => {
  const c = await api('POST', '/issues/KAN-5/comments', { body: 'Hey @Sara can you look?' });
  assert.equal(c.status, 201);
  // log in as Sara and check her notifications
  const login = await api('POST', '/auth/login', { email: 'sara@ahdfinancial.com', password: 'password' }, { auth: false });
  const saraCookie = login.headers.get('set-cookie').split(';')[0];
  const n = await fetch(`${base}/notifications`, { headers: { Cookie: saraCookie } }).then((r) => r.json());
  assert.ok(n.items.some((x) => x.type === 'mention' && x.key === 'KAN-5'));
  // a regular member (Omar) cannot edit Ahmed's comment (Sara is a KAN project admin, so she could)
  const omarCookie = await loginAs('omar@ahdfinancial.com');
  const e = await fetch(`${base}/comments/${c.data.id}`, { method: 'PATCH', headers: { Cookie: omarCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'x' }) });
  assert.equal(e.status, 403);
});

test('links, watchers, attachments, clone', async () => {
  const l = await api('POST', '/issues/KAN-10/links', { type: 'blocks', targetKey: 'KAN-11' });
  assert.equal(l.status, 409); // seeded already
  assert.equal((await api('POST', '/issues/KAN-20/links', { type: 'blocks', targetKey: 'KAN-11' })).status, 201);
  const d = await api('GET', '/issues/KAN-11');
  assert.ok(d.data.links.some((x) => x.key === 'KAN-20' && x.label === 'is blocked by'));
  assert.equal((await api('POST', '/issues/KAN-10/links', { type: 'blocks', targetKey: 'KAN-10' })).status, 400);

  await api('DELETE', '/issues/KAN-11/watch');
  assert.equal((await api('GET', '/issues/KAN-11')).data.watching, false);
  await api('POST', '/issues/KAN-11/watch');
  assert.equal((await api('GET', '/issues/KAN-11')).data.watching, true);

  const up = await api('POST', '/issues/KAN-11/attachments', Buffer.from('hello world'), { raw: true, headers: { 'Content-Type': 'text/plain', 'X-Filename': 'notes.txt' } });
  assert.equal(up.status, 201);
  const dl = await fetch(`${base}/attachments/${up.data.id}`, { headers: { Cookie: cookie } });
  assert.equal(await dl.text(), 'hello world');
  assert.equal((await api('DELETE', `/attachments/${up.data.id}`)).status, 200);

  const cl = await api('POST', '/issues/KAN-11/clone');
  assert.equal(cl.status, 201);
  assert.match(cl.data.summary, /^CLONE - /);
});

test('saved filters validate JQL', async () => {
  assert.equal((await api('POST', '/filters', { name: 'Bad', jql: 'nope = 1' })).status, 400);
  const f = await api('POST', '/filters', { name: 'Bugs', jql: 'type = Bug' });
  assert.equal(f.status, 201);
  const s = await api('PATCH', `/filters/${f.data.id}`, { starred: true });
  assert.equal(s.data.starred, true);
  assert.equal((await api('DELETE', `/filters/${f.data.id}`)).status, 200);
});

test('goals with progress', async () => {
  const g = await api('POST', '/goals', { name: 'Test goal', targetDate: '2030-01-01' });
  assert.equal(g.status, 201);
  const linked = await api('POST', `/goals/${g.data.id}/issues`, { key: 'KAN-1' });
  assert.equal(linked.data.issues.length, 1);
  assert.ok(linked.data.progress.total >= 1);
  assert.equal((await api('PATCH', `/goals/${g.data.id}`, { status: 'bogus' })).status, 400);
});

test('forms create work items', async () => {
  const f = await api('POST', '/forms', { name: 'Intake', issueType: 'Story', fields: ['summary', 'priority'], defaultLabels: ['intake'] });
  assert.equal(f.status, 201);
  const s = await api('POST', `/forms/${f.data.id}/submit`, { values: { summary: 'From form', priority: 'Low' } });
  assert.equal(s.status, 201);
  assert.equal(s.data.type, 'Story');
  assert.equal(s.data.priority, 'Low');
  assert.deepEqual(s.data.labels, ['intake']);
  assert.equal((await api('GET', `/forms/${f.data.id}`)).data.submissions, 1);
});

test('development info and commit webhook', async () => {
  const b = await api('POST', '/issues/KAN-9/dev', { kind: 'branch', repo: 'reporting', name: 'KAN-9-draft' });
  assert.equal(b.status, 201);
  const w = await api('POST', '/webhooks/commits', { repo: 'reporting', commits: [{ id: 'abc1234', message: 'KAN-9 KAN-10 update numbers' }] });
  assert.equal(w.data.linked, 2);
  const list = await api('GET', '/dev?repo=reporting');
  assert.ok(list.data.length >= 3);
});

test('user admin: create, deactivate; members cannot administer', async () => {
  const u = await api('POST', '/users', { name: 'New Person', email: 'new@ahdfinancial.com', password: 'longpassword' });
  assert.equal(u.status, 201);
  const login = await api('POST', '/auth/login', { email: 'new@ahdfinancial.com', password: 'longpassword' }, { auth: false });
  assert.equal(login.status, 200);
  const memberCookie = login.headers.get('set-cookie').split(';')[0];
  const denied = await fetch(`${base}/users`, { method: 'POST', headers: { Cookie: memberCookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 403);
  assert.equal((await api('DELETE', `/users/${u.data.id}`)).status, 200);
  const after = await fetch(`${base}/auth/me`, { headers: { Cookie: memberCookie } });
  assert.equal(after.status, 401);
});

test('auth: bearer token, iframe-safe cookie, remember me, attachment access token', async () => {
  const r = await api('POST', '/auth/login', { email: 'sara@ahdfinancial.com', password: 'password', remember: false }, { auth: false });
  assert.equal(r.status, 200);
  assert.match(r.data.token, /^[a-f0-9]{64}$/);
  // no Expires → browser-session cookie; plain http → SameSite=Lax
  const c = r.headers.get('set-cookie');
  assert.ok(!/Expires=/.test(c));
  assert.match(c, /SameSite=Lax/);
  // works with only the bearer header (cookies blocked in a cross-site iframe)
  const me = await api('GET', '/auth/me', null, { auth: false, headers: { Authorization: `Bearer ${r.data.token}` } });
  assert.equal(me.data.user.email, 'sara@ahdfinancial.com');
  // behind an HTTPS proxy the cookie is SameSite=None; Secure; Partitioned
  const https = await api('POST', '/auth/login', { email: 'sara@ahdfinancial.com', password: 'password' }, { auth: false, headers: { 'X-Forwarded-Proto': 'https' } });
  assert.match(https.headers.get('set-cookie'), /SameSite=None; Secure; Partitioned; Expires=/);
  // Fallbacks for proxies that strip Authorization and iframes that block cookies:
  // the X-JC-Auth header and ?access_token both work on any route.
  const q = await api('GET', `/auth/me?access_token=${r.data.token}`, null, { auth: false });
  assert.equal(q.status, 200);
  const xh = await api('GET', '/search?jql=project%20%3D%20KAN', null, { auth: false, headers: { 'X-JC-Auth': r.data.token } });
  assert.equal(xh.status, 200);
  // API responses must never be cached by browsers or proxies
  assert.match(xh.headers.get('cache-control'), /no-store/);
  assert.equal(xh.headers.get('etag'), null);
  // 401s explain why: nothing arrived vs. a session the server doesn't know
  const none = await api('GET', '/search', null, { auth: false });
  assert.equal(none.data.reason, 'no_credentials');
  assert.match(none.headers.get('cache-control'), /no-store/);
  const bad = await api('GET', '/search', null, { auth: false, headers: { Authorization: `Bearer ${'0'.repeat(64)}` } });
  assert.equal(bad.data.reason, 'unknown_session');
  assert.equal(bad.data.seen.authorization, true);
  const up = await api('POST', '/issues/KAN-2/attachments', 'hello', { raw: true, auth: false, headers: { Authorization: `Bearer ${r.data.token}`, 'X-Filename': 'a.txt', 'Content-Type': 'text/plain' } });
  assert.equal(up.status, 201);
  const id = (up.data.attachments || [up.data]).map((a) => a.id).filter(Boolean).pop();
  const dl = await api('GET', `/attachments/${id}?access_token=${r.data.token}`, null, { auth: false });
  assert.equal(dl.status, 200);
  assert.equal(dl.data, 'hello');
  // garbage tokens are ignored, not errors
  assert.equal((await api('GET', '/auth/me', null, { auth: false, headers: { Authorization: 'Bearer nope', Cookie: 'jc_session=%E0%A4%A' } })).status, 401);
});

test('auth: sessions list and sign out other sessions', async () => {
  const a = await api('POST', '/auth/login', { email: 'omar@ahdfinancial.com', password: 'password' }, { auth: false });
  const b = await api('POST', '/auth/login', { email: 'omar@ahdfinancial.com', password: 'password' }, { auth: false });
  const H = (t) => ({ auth: false, headers: { Authorization: `Bearer ${t}` } });
  const list = await api('GET', '/auth/sessions', null, H(a.data.token));
  assert.ok(list.data.length >= 2);
  assert.equal(list.data.filter((x) => x.current).length, 1);
  const out = await api('DELETE', '/auth/sessions', null, H(a.data.token));
  assert.ok(out.data.removed >= 1);
  assert.equal((await api('GET', '/auth/me', null, H(b.data.token))).status, 401);
  assert.equal((await api('GET', '/auth/me', null, H(a.data.token))).status, 200);
});

test('auth: forgot and reset password', async () => {
  const unknown = await api('POST', '/auth/forgot', { email: 'nobody@example.com' }, { auth: false });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.resetPath, undefined); // does not reveal whether the account exists
  const f = await api('POST', '/auth/forgot', { email: 'layla@ahdfinancial.com' }, { auth: false });
  const token = new URL(f.data.resetPath, 'http://x').searchParams.get('token');
  assert.ok(token);
  assert.equal((await api('GET', `/auth/reset/${token}`, null, { auth: false })).data.email, 'layla@ahdfinancial.com');
  assert.equal((await api('POST', '/auth/reset', { token, password: 'short' }, { auth: false })).status, 400);
  assert.equal((await api('POST', '/auth/reset', { token, password: 'new-password-1' }, { auth: false })).status, 200);
  assert.equal((await api('POST', '/auth/reset', { token, password: 'new-password-2' }, { auth: false })).status, 400); // single use
  assert.equal((await api('POST', '/auth/login', { email: 'layla@ahdfinancial.com', password: 'password' }, { auth: false })).status, 401);
  assert.equal((await api('POST', '/auth/login', { email: 'layla@ahdfinancial.com', password: 'new-password-1' }, { auth: false })).status, 200);
});

test('sprints: plan, start, complete, JQL functions', async () => {
  const list = await api('GET', '/sprints?project=KAN');
  assert.deepEqual([...new Set(list.data.map((s) => s.state))], ['active', 'future', 'closed']);
  const active = list.data[0];
  assert.ok(active.stats.total > 0);
  // only one active sprint
  const s3 = list.data[1];
  assert.match((await api('POST', `/sprints/${s3.id}/start`)).data.error, /still active/);
  // open sprints JQL
  const open = await api('GET', `/search?jql=${encodeURIComponent('project = KAN AND sprint in openSprints()')}`);
  assert.equal(open.data.total, active.stats.total);
  const backlog = await api('GET', `/search?jql=${encodeURIComponent('sprint IS EMPTY AND type != Epic')}`);
  assert.ok(backlog.data.total > 0);
  // create a sprint, move items in, closed sprints reject new work
  const created = await api('POST', '/sprints', { goal: 'Test goal' });
  assert.equal(created.status, 201);
  assert.equal(created.data.name, 'KAN Sprint 6');
  const key = backlog.data.issues[0].key;
  assert.equal((await api('POST', '/sprints/move', { keys: [key], sprintId: created.data.id })).data.moved, 1);
  assert.equal((await api('GET', `/issues/${key}`)).data.sprint, 'KAN Sprint 6');
  assert.equal((await api('PATCH', `/issues/${key}`, { sprint: 'KAN Sprint 1' })).status, 400);
  assert.equal((await api('PATCH', `/issues/${key}`, { sprint: 'Nope' })).status, 400);
  // rename keeps issues attached
  await api('PATCH', `/sprints/${created.data.id}`, { name: 'Hardening' });
  assert.equal((await api('GET', `/issues/${key}`)).data.sprint, 'Hardening');
  // complete the active sprint → open work moves to the new sprint
  const openCount = active.stats.total - active.stats.done;
  const done = await api('POST', `/sprints/${active.id}/complete`, { moveTo: created.data.id });
  assert.equal(done.status, 200);
  assert.equal(done.data.moved, openCount);
  assert.equal(done.data.sprint.state, 'closed');
  // start the next one
  const started = await api('POST', `/sprints/${created.data.id}/start`, { startDate: '2026-10-19', endDate: '2026-11-02' });
  assert.equal(started.data.state, 'active');
  assert.equal((await api('GET', '/meta')).data.activeSprint.name, 'Hardening');
  // a started sprint cannot be deleted; a future one can, and its work returns to the backlog
  assert.equal((await api('DELETE', `/sprints/${created.data.id}`)).status, 400);
  assert.equal((await api('DELETE', `/sprints/${s3.id}`)).status, 200);
});

test('projects: create, per-project keys, isolation and delete', async () => {
  const bad = await api('POST', '/projects', { key: '9x', name: 'Bad' });
  assert.equal(bad.status, 400);
  const p = await api('POST', '/projects', { key: 'ops', name: 'Operations', type: 'software' });
  assert.equal(p.status, 201);
  assert.equal(p.data.key, 'OPS');
  assert.equal((await api('POST', '/projects', { key: 'OPS', name: 'Again' })).status, 400);
  const list = await api('GET', '/projects');
  assert.ok(list.data.some((x) => x.key === 'PAY') && list.data.some((x) => x.key === 'OPS'));
  // first issue in a new project gets OPS-1 and the meta endpoint is scoped
  const i = await api('POST', '/issues', { projectKey: 'OPS', summary: 'Set up on-call rota' });
  assert.equal(i.data.key, 'OPS-1');
  const meta = await api('GET', '/meta?project=OPS');
  assert.equal(meta.data.project.key, 'OPS');
  assert.deepEqual(meta.data.sprints, ['OPS Sprint 1']);
  assert.ok(meta.data.projects.length >= 4);
  // cannot use another project's sprint or parent
  assert.equal((await api('PATCH', '/issues/OPS-1', { sprint: 'KAN Sprint 5' })).status, 400);
  assert.equal((await api('PATCH', '/issues/OPS-1', { parentKey: 'KAN-1' })).status, 400);
  assert.equal((await api('PATCH', '/issues/OPS-1', { sprint: 'OPS Sprint 1' })).status, 200);
  const search = await api('GET', `/search?jql=${encodeURIComponent('project = OPS')}`);
  assert.equal(search.data.total, 1);
  // star toggling
  assert.equal((await api('DELETE', '/projects/OPS/star')).data.starred, false);
  // delete (admin) removes the project's work
  const del = await api('DELETE', '/projects/OPS', { confirm: 'OPS' });
  assert.equal(del.status, 200);
  assert.equal(del.data.removedIssues, 1);
  assert.equal((await api('GET', '/issues/OPS-1')).status, 404);
});

test('releases: fix versions, release with carry-over, JQL', async () => {
  const vs = await api('GET', '/versions?project=KAN');
  assert.ok(vs.data.find((v) => v.name === '1.3.0').stats.total > 0);
  const v = await api('POST', '/versions', { projectKey: 'KAN', name: '9.9.0', releaseDate: '2026-12-01' });
  assert.equal(v.status, 201);
  assert.equal((await api('POST', '/versions', { projectKey: 'KAN', name: '9.9.0' })).status, 400);
  const key = (await api('POST', '/issues', { projectKey: 'KAN', summary: 'Ship it', fixVersion: '9.9.0' })).data.key;
  assert.equal((await api('GET', `/issues/${key}`)).data.fixVersion, '9.9.0');
  assert.equal((await api('PATCH', `/issues/${key}`, { fixVersion: 'nope' })).status, 400);
  const jql = await api('GET', `/search?jql=${encodeURIComponent('fixVersion = "9.9.0"')}`);
  assert.equal(jql.data.total, 1);
  const unrel = await api('GET', `/search?jql=${encodeURIComponent('project = KAN AND fixVersion in unreleasedVersions()')}`);
  assert.ok(unrel.data.total >= 1);
  // rename keeps issues attached
  await api('PATCH', `/versions/${v.data.id}`, { name: '9.9.1' });
  assert.equal((await api('GET', `/issues/${key}`)).data.fixVersion, '9.9.1');
  // release moving unresolved work to 1.4.0
  const target = vs.data.find((x) => x.name === '1.4.0');
  const rel = await api('POST', `/versions/${v.data.id}/release`, { moveUnresolvedTo: target.id });
  assert.equal(rel.data.version.status, 'released');
  assert.equal(rel.data.moved, 1);
  assert.equal((await api('GET', `/issues/${key}`)).data.fixVersion, '1.4.0');
  assert.equal((await api('POST', `/versions/${v.data.id}/release`)).status, 400);
  assert.equal((await api('DELETE', `/versions/${v.data.id}`)).status, 200);
});

test('reports: velocity, cumulative flow and sprint report', async () => {
  const vel = await api('GET', '/reports/velocity?project=KAN');
  assert.equal(vel.status, 200);
  assert.ok(vel.data.sprints.length >= 3);
  assert.ok(vel.data.sprints.every((s) => s.committed >= s.completed));
  const cfd = await api('GET', '/reports/cfd?project=KAN&days=14');
  assert.equal(cfd.data.dates.length, 14);
  const lastTotal = cfd.data.statuses.reduce((t, s) => t + cfd.data.series[s].at(-1), 0);
  const nonEpics = await api('GET', `/search?jql=${encodeURIComponent('project = KAN AND type != Epic')}&maxResults=1`);
  assert.equal(lastTotal, nonEpics.data.total);
  const sprint = (await api('GET', '/sprints?project=KAN&state=closed')).data[0];
  const rep = await api('GET', `/reports/sprint/${sprint.id}`);
  assert.equal(rep.status, 200);
  assert.ok(Array.isArray(rep.data.completed) && rep.data.burndown.points.length > 0);
});

test('personal API tokens authenticate but cannot manage tokens', async () => {
  const t = await api('POST', '/auth/tokens', { name: 'CI', expiresInDays: 30 });
  assert.equal(t.status, 201);
  assert.match(t.data.token, /^jcpat_[a-f0-9]{48}$/);
  const bearer = { Authorization: `Bearer ${t.data.token}` };
  const me = await api('GET', '/auth/me', null, { auth: false, headers: bearer });
  assert.equal(me.data.user.email, 'ahmed@ahdfinancial.com');
  assert.equal((await api('GET', '/auth/tokens', null, { auth: false, headers: bearer })).status, 403);
  const list = await api('GET', '/auth/tokens');
  assert.ok(list.data.some((x) => x.id === t.data.id && !('token' in x)));
  await api('DELETE', `/auth/tokens/${t.data.id}`);
  assert.equal((await api('GET', '/auth/me', null, { auth: false, headers: bearer })).status, 401);
});

test('live events stream broadcasts writes; API docs are public', async () => {
  const spec = await api('GET', '/openapi.json', null, { auth: false });
  assert.equal(spec.data.openapi, '3.0.3');
  assert.ok(spec.data.paths['/versions/{id}/release']);
  const docs = await api('GET', '/docs', null, { auth: false });
  assert.match(docs.data, /REST API reference/);
  const ctrl = new AbortController();
  const res = await fetch(`${base}/events`, { headers: { Cookie: cookie }, signal: ctrl.signal });
  assert.equal(res.headers.get('content-type').split(';')[0], 'text/event-stream');
  const reader = res.body.getReader();
  let buf = '';
  const waitFor = async (re) => { while (!re.test(buf)) { const { value } = await reader.read(); buf += new TextDecoder().decode(value); } };
  await waitFor(/event: hello/);
  await api('POST', '/issues', { projectKey: 'KAN', summary: 'Live update check' });
  await waitFor(/event: change\ndata: .*"topic":"issues"/);
  ctrl.abort();
});

test('re-seeding demo data keeps existing logins and API tokens valid', async () => {
  const login = await api('POST', '/auth/login', { email: 'sara@ahdfinancial.com', password: 'password' }, { auth: false });
  const bearer = { Authorization: `Bearer ${login.data.token}` };
  const pat = await api('POST', '/auth/tokens', { name: 'reseed', expiresInDays: 30 }, { headers: bearer, auth: false });
  assert.equal(pat.status, 201);
  await srv.reseed();
  const me = await api('GET', '/auth/me', null, { headers: bearer, auth: false });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, 'sara@ahdfinancial.com');
  const viaPat = await api('GET', '/auth/me', null, { headers: { Authorization: `Bearer ${pat.data.token}` }, auth: false });
  assert.equal(viaPat.status, 200);
  // the admin's cookie session from earlier tests also survives
  assert.equal((await api('GET', '/auth/me')).status, 200);
});

// ======================= phase 5: permissions =======================
test('viewer role: can browse and comment but not edit (limited project)', async () => {
  const khalid = await loginAs('khalid@ahdfinancial.com');
  assert.equal((await api('GET', '/issues/KAN-1', null, as(khalid))).status, 200);
  const edit = await api('PATCH', '/issues/KAN-1', { summary: 'hacked' }, as(khalid));
  assert.equal(edit.status, 403);
  assert.equal((await api('POST', '/issues/KAN-1/comments', { body: 'Audit note' }, as(khalid))).status, 201);
  assert.equal((await api('POST', '/issues', { projectKey: 'KAN', summary: 'nope' }, as(khalid))).status, 403);
  assert.equal((await api('DELETE', '/issues/KAN-1', null, as(khalid))).status, 403);
  const mine = await api('GET', '/mypermissions?project=KAN', null, as(khalid));
  assert.equal(mine.data.role, 'viewer');
  assert.ok(mine.data.permissions.includes('BROWSE_PROJECT') && !mine.data.permissions.includes('EDIT_ISSUES'));
});

test('private project is invisible to non-members (404, filtered from lists and search)', async () => {
  const sara = await loginAs('sara@ahdfinancial.com');
  assert.equal((await api('GET', '/issues/FIN-1', null, as(sara))).status, 404);
  const projects = await api('GET', '/projects', null, as(sara));
  assert.ok(!projects.data.some((p) => p.key === 'FIN'));
  const s = await api('GET', '/search?jql=' + encodeURIComponent('project = FIN'), null, as(sara));
  assert.equal(s.data.total, 0);
  const all = await api('GET', '/search?jql=' + encodeURIComponent('ORDER BY created DESC'), null, as(sara));
  assert.ok(all.data.issues.every((i) => !i.key.startsWith('FIN-')));
  // the admin still sees it
  assert.equal((await api('GET', '/issues/FIN-1')).status, 200);
});

test('project people & roles: add, promote and remove a member', async () => {
  const yusuf = await loginAs('yusuf@ahdfinancial.com');
  assert.equal((await api('GET', '/issues/FIN-2', null, as(yusuf))).status, 404);
  const add = await api('POST', '/projects/FIN/members', { userId: 'u5', role: 'viewer' });
  assert.equal(add.status, 201);
  assert.ok(add.data.people.some((p) => p.user.id === 'u5' && p.role === 'viewer'));
  assert.equal((await api('GET', '/issues/FIN-2', null, as(yusuf))).status, 200);
  assert.equal((await api('PATCH', '/issues/FIN-2', { priority: 'Low' }, as(yusuf))).status, 403);
  // a non-admin cannot manage people
  assert.equal((await api('PATCH', '/projects/FIN/members/u5', { role: 'admin' }, as(yusuf))).status, 403);
  assert.equal((await api('PATCH', '/projects/FIN/members/u5', { role: 'member' })).status, 200);
  assert.equal((await api('PATCH', '/issues/FIN-2', { priority: 'Low' }, as(yusuf))).status, 200);
  assert.equal((await api('DELETE', '/projects/FIN/members/u5')).status, 200);
  assert.equal((await api('GET', '/issues/FIN-2', null, as(yusuf))).status, 404);
});

test('permission scheme: locked admin rights, custom rules and reset', async () => {
  const bad = await api('PUT', '/projects/KAN/permissions', { scheme: { ADMINISTER_PROJECT: ['member'] } });
  assert.equal(bad.status, 400);
  const omar = await loginAs('omar@ahdfinancial.com');
  assert.equal((await api('PATCH', '/issues/KAN-2', { priority: 'High' }, as(omar))).status, 200);
  const ok = await api('PUT', '/projects/KAN/permissions', { scheme: { EDIT_ISSUES: ['admin'] } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.isDefault, false);
  assert.equal((await api('PATCH', '/issues/KAN-2', { priority: 'Low' }, as(omar))).status, 403);
  // members cannot change the scheme
  assert.equal((await api('PUT', '/projects/KAN/permissions', { scheme: { EDIT_ISSUES: ['admin', 'member'] } }, as(omar))).status, 403);
  const reset = await api('POST', '/projects/KAN/permissions/reset');
  assert.equal(reset.data.isDefault, true);
  assert.equal((await api('PATCH', '/issues/KAN-2', { priority: 'Low' }, as(omar))).status, 200);
});

test('recycle bin: delete moves to trash, restore brings everything back', async () => {
  const before = await api('GET', '/issues/KAN-3');
  const del = await api('DELETE', '/issues/KAN-3');
  assert.equal(del.status, 200);
  assert.equal(del.data.recycleBin, true);
  assert.equal((await api('GET', '/issues/KAN-3')).status, 404);
  const bin = await api('GET', '/trash?project=KAN');
  const entry = bin.data.items.find((x) => x.key === 'KAN-3');
  assert.ok(entry);
  assert.equal((await api('POST', `/trash/${entry.id}/restore`)).status, 200);
  const after = await api('GET', '/issues/KAN-3');
  assert.equal(after.status, 200);
  assert.equal(after.data.summary, before.data.summary);
  assert.equal(after.data.comments.length, before.data.comments.length);
  const audit = await api('GET', '/audit?project=KAN');
  assert.ok(audit.data.some((a) => a.action === 'issue.deleted' && a.target === 'KAN-3'));
  assert.ok(audit.data.some((a) => a.action === 'issue.restored' && a.target === 'KAN-3'));
  // non-admins cannot read the audit log
  const omar = await loginAs('omar@ahdfinancial.com');
  assert.equal((await api('GET', '/audit?project=KAN', null, as(omar))).status, 403);
});

test('components: default assignee and JQL', async () => {
  const c = await api('POST', '/components', { project: 'KAN', name: 'QA Automation', leadId: 'u4', defaultAssignee: 'component_lead' });
  assert.equal(c.status, 201);
  const i = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Flaky e2e test', components: ['QA Automation'] });
  assert.equal(i.status, 201);
  assert.equal(i.data.assigneeId, 'u4');
  const s = await api('GET', '/search?jql=' + encodeURIComponent('component = "QA Automation"'));
  assert.deepEqual(s.data.issues.map((x) => x.key), [i.data.key]);
  const t = await api('GET', '/search?jql=' + encodeURIComponent('team = "Payments Squad" AND project = PAY'));
  assert.ok(t.data.total > 0);
});

test('global permissions: only site admins can change them', async () => {
  const omar = await loginAs('omar@ahdfinancial.com');
  assert.equal((await api('PUT', '/permissions/global', { scheme: { CREATE_PROJECTS: [] } }, as(omar))).status, 403);
  assert.equal((await api('PUT', '/permissions/global', { scheme: { CREATE_PROJECTS: ['admin'] } })).status, 200);
  const denied = await api('POST', '/projects', { key: 'NOPE', name: 'Nope' }, as(omar));
  assert.equal(denied.status, 403);
  assert.equal((await api('PUT', '/permissions/global', { scheme: { CREATE_PROJECTS: ['admin', 'member'] } })).status, 200);
  const ok = await api('POST', '/projects', { key: 'OMR', name: 'Omar test', access: 'private' }, as(omar));
  assert.equal(ok.status, 201);
  assert.equal(ok.data.myRole, 'admin');
});

test('logout invalidates the session', async () => {
  await api('POST', '/auth/logout');
  assert.equal((await api('GET', '/auth/me')).status, 401);
});
