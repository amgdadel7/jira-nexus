// Phase 7: time tracking, votes, preferences + avatars, automation rules, outgoing webhooks, CSV import.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const { startTestServer } = require('./helpers/testServer');

let khalid; let srv; let base; let admin; let sara; let omar; let sink; let sinkBase;
const received = []; // deliveries captured by the fake receiver
let sinkStatus = 200;

async function api(method, url, body, { cookie, headers = {}, raw } = {}) {
  const res = await fetch(base + url, {
    method,
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await wait(25); }
  return fn();
}

before(async () => {
  srv = await startTestServer();
  base = srv.base;
  sink = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { received.push({ headers: req.headers, body, json: JSON.parse(body || '{}') }); res.statusCode = sinkStatus; res.end('ok'); });
  }).listen(0);
  await new Promise((r) => sink.once('listening', r));
  sinkBase = `http://127.0.0.1:${sink.address().port}`;
  admin = await loginAs('ahmed@ahdfinancial.com');
  sara = await loginAs('sara@ahdfinancial.com');
  omar = await loginAs('omar@ahdfinancial.com');
  khalid = await loginAs('khalid@ahdfinancial.com');
});
after(async () => { sink.close(); await srv.close(); });

test('time tracking: estimates, log work with each adjust mode, edit, delete, JQL and history', async () => {
  const c = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Time tracking test', originalEstimate: '1d 2h' }, { cookie: sara });
  assert.equal(c.status, 201);
  assert.equal(c.data.originalEstimate, 10 * 3600);
  assert.equal(c.data.remainingEstimate, 10 * 3600, 'remaining defaults to the original estimate');
  const key = c.data.key;

  assert.equal((await api('POST', `/issues/${key}/worklogs`, { timeSpent: 'abc' }, { cookie: sara })).status, 400);
  let w = await api('POST', `/issues/${key}/worklogs`, { timeSpent: '3h 30m', comment: 'first pass', started: '2026-10-15T09:00:00Z' }, { cookie: sara });
  assert.equal(w.status, 201, JSON.stringify(w.data));
  assert.equal(w.data.issue.timeSpent, 3.5 * 3600);
  assert.equal(w.data.issue.remainingEstimate, 6.5 * 3600, 'auto adjust reduces remaining');
  const wid = w.data.worklog.id;

  w = await api('POST', `/issues/${key}/worklogs`, { timeSpent: '1h', adjustEstimate: 'leave' }, { cookie: omar });
  assert.equal(w.status, 201);
  assert.equal(w.data.issue.remainingEstimate, 6.5 * 3600, 'leave keeps remaining');
  w = await api('POST', `/issues/${key}/worklogs`, { timeSpent: '30m', adjustEstimate: 'new', newEstimate: '2h' }, { cookie: omar });
  assert.equal(w.data.issue.remainingEstimate, 2 * 3600);
  assert.equal(w.data.issue.timeSpent, 5 * 3600);
  const omarLog = w.data.worklog.id;

  // Sara (KAN admin) may edit anyone's worklog; Omar may not edit Sara's
  assert.equal((await api('PATCH', `/worklogs/${wid}`, { comment: 'nope' }, { cookie: omar })).status, 403);
  const e = await api('PATCH', `/worklogs/${wid}`, { timeSpent: '4h' }, { cookie: sara });
  assert.equal(e.status, 200);
  assert.equal(e.data.issue.timeSpent, 5.5 * 3600);
  assert.equal(e.data.issue.remainingEstimate, 1.5 * 3600, 'editing +30m reduces remaining by 30m');

  const d = await api('DELETE', `/worklogs/${omarLog}`, null, { cookie: omar });
  assert.equal(d.status, 200);
  assert.equal(d.data.issue.timeSpent, 5 * 3600);
  assert.equal(d.data.issue.remainingEstimate, 2 * 3600, 'deleting gives the time back');

  const list = await api('GET', `/issues/${key}/worklogs`, null, { cookie: sara });
  assert.equal(list.data.worklogs.length, 2);
  assert.equal(list.data.worklogs.find((x) => x.id === wid).timeSpentText, '4h');

  const detail = await api('GET', `/issues/${key}`, null, { cookie: sara });
  assert.ok(detail.data.worklogs.length === 2);
  assert.ok(detail.data.history.some((h) => h.field === 'time spent'));
  const pe = await api('PATCH', `/issues/${key}`, { originalEstimate: '2d' }, { cookie: sara });
  assert.equal(pe.data.originalEstimate, 16 * 3600);
  assert.equal(pe.data.remainingEstimate, 2 * 3600, 'remaining is kept once work is logged');
  const d2 = await api('GET', `/issues/${key}`, null, { cookie: sara });
  assert.ok(d2.data.history.some((h) => h.field === 'original estimate' && h.from === '1d 2h' && h.to === '2d'));
  assert.equal((await api('PATCH', `/issues/${key}`, { originalEstimate: 'soon' }, { cookie: sara })).status, 400);

  let s = await api('GET', `/search?jql=${encodeURIComponent(`key = ${key} AND timeSpent >= 5h AND originalEstimate = 2d`)}`, null, { cookie: sara });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  assert.equal(s.data.issues.length, 1);
  s = await api('GET', `/search?jql=${encodeURIComponent(`key = ${key} AND worklogAuthor = omar@ahdfinancial.com`)}`, null, { cookie: sara });
  assert.equal(s.data.issues.length, 1, 'omar still has a worklog');
  s = await api('GET', `/search?jql=${encodeURIComponent('worklogDate = 2026-10-15 AND project = KAN')}`, null, { cookie: sara });
  assert.ok(s.data.issues.some((i) => i.key === key));
  assert.equal((await api('GET', `/search?jql=${encodeURIComponent('timeSpent > banana')}`, null, { cookie: sara })).status, 400);

  // Khalid is a viewer in KAN: can browse but not log work
  const khalid = await loginAs('khalid@ahdfinancial.com');
  assert.equal((await api('POST', `/issues/${key}/worklogs`, { timeSpent: '1h' }, { cookie: khalid })).status, 403);

  const ts = await api('GET', '/reports/timesheet?project=KAN&from=2026-10-01&to=2026-10-31', null, { cookie: sara });
  assert.equal(ts.status, 200);
  assert.equal(ts.data.days.length, 31);
  assert.ok(ts.data.users.find((u) => u.userId === 'u2').days['2026-10-15'] >= 4 * 3600);
  assert.ok(ts.data.issues.some((i) => i.key === key));
});

test('votes: vote, unvote, no voting on own or done work, JQL votes/voter', async () => {
  const c = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Vote for me' }, { cookie: sara });
  const key = c.data.key;
  assert.equal((await api('POST', `/issues/${key}/votes`, null, { cookie: sara })).status, 400, 'reporter cannot vote');
  let v = await api('POST', `/issues/${key}/votes`, null, { cookie: omar });
  assert.equal(v.status, 200);
  assert.deepEqual(v.data, { votes: 1, hasVoted: true });
  v = await api('POST', `/issues/${key}/votes`, null, { cookie: admin });
  assert.equal(v.data.votes, 2);
  const g = await api('GET', `/issues/${key}/votes`, null, { cookie: omar });
  assert.equal(g.data.hasVoted, true);
  assert.deepEqual(g.data.voters.map((x) => x.userId).sort(), ['u1', 'u3']);
  const s = await api('GET', `/search?jql=${encodeURIComponent(`key = ${key} AND votes >= 2 AND voter = currentUser()`)}`, null, { cookie: omar });
  assert.equal(s.data.issues.length, 1);
  assert.equal(s.data.issues[0].votes, 2);
  v = await api('DELETE', `/issues/${key}/votes`, null, { cookie: omar });
  assert.deepEqual(v.data, { votes: 1, hasVoted: false });
  await api('PATCH', `/issues/${key}`, { status: 'Done' }, { cookie: sara });
  assert.equal((await api('POST', `/issues/${key}/votes`, null, { cookie: omar })).status, 400, 'no votes on done work');
});

test('preferences + notification opt-out + avatar upload', async () => {
  let p = await api('GET', '/auth/me/preferences', null, { cookie: omar });
  assert.equal(p.data.theme, 'light');
  assert.equal(p.data.notify.assigned, true);
  assert.equal((await api('PATCH', '/auth/me/preferences', { theme: 'neon' }, { cookie: omar })).status, 400);
  p = await api('PATCH', '/auth/me/preferences', { theme: 'dark', notify: { assigned: false } }, { cookie: omar });
  assert.equal(p.status, 200);
  assert.equal(p.data.theme, 'dark');
  assert.equal(p.data.notify.assigned, false);
  assert.equal(p.data.notify.comment, true);

  const before = (await api('GET', '/notifications', null, { cookie: omar })).data;
  const beforeCount = (before.notifications || before).length;
  await api('POST', '/issues', { projectKey: 'KAN', summary: 'Assigned while muted', assigneeId: 'u3' }, { cookie: sara });
  const afterN = (await api('GET', '/notifications', null, { cookie: omar })).data;
  assert.equal((afterN.notifications || afterN).length, beforeCount, 'assignment notifications are switched off');
  await api('PATCH', '/auth/me/preferences', { notify: { assigned: true } }, { cookie: omar });

  // avatar: rejects non-images, accepts a PNG, serves it publicly, then removes it
  const bad = await api('POST', '/auth/me/avatar', Buffer.from('hello'), { cookie: omar, raw: true, headers: { 'Content-Type': 'application/octet-stream' } });
  assert.equal(bad.status, 400);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const up = await api('POST', '/auth/me/avatar', png, { cookie: omar, raw: true, headers: { 'Content-Type': 'image/png' } });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  assert.match(up.data.user.avatarUrl, /^\/api\/avatars\/u3-[0-9a-f]+\.png$/);
  const img = await fetch(base.replace('/api', '') + up.data.user.avatarUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  const meta = await api('GET', '/meta', null, { cookie: sara });
  assert.equal(meta.data.users.find((u) => u.id === 'u3').avatarUrl, up.data.user.avatarUrl);
  const del = await api('DELETE', '/auth/me/avatar', null, { cookie: omar });
  assert.equal(del.data.user.avatarUrl, null);
  assert.equal((await fetch(base.replace('/api', '') + up.data.user.avatarUrl)).status, 404);
  // the automation bot is not listed in user administration
  const users = await api('GET', '/users', null, { cookie: admin });
  assert.ok(!users.data.some((u) => u.id === 'automation'));
});

test('automation: create rules, triggers, JQL condition, smart values, no loops, audit log, permissions', async () => {
  assert.equal((await api('GET', '/projects/KAN/automation', null, { cookie: omar })).status, 403, 'members cannot manage automation');
  const lst = await api('GET', '/projects/KAN/automation', null, { cookie: sara });
  assert.equal(lst.status, 200);
  assert.equal(lst.data.rules.length, 3);
  assert.ok(lst.data.templates.length >= 5);
  assert.equal(lst.data.usage.limit, null, 'premium has unlimited runs');

  assert.equal((await api('POST', '/projects/KAN/automation', { name: 'x', trigger: { type: 'nope' }, actions: [{ type: 'transition', status: 'Done' }] }, { cookie: sara })).status, 400);
  assert.equal((await api('POST', '/projects/KAN/automation', { name: 'x', trigger: { type: 'issue_created' }, condition: 'foo = bar', actions: [{ type: 'transition', status: 'Done' }] }, { cookie: sara })).status, 400);

  const rule = await api('POST', '/projects/KAN/automation', {
    name: 'Tag spikes', trigger: { type: 'issue_created' }, condition: 'summary ~ spike',
    actions: [{ type: 'add_label', label: 'research' }, { type: 'set_priority', priority: 'Low' }, { type: 'comment', body: 'Hi {{initiator.displayName}}, {{issue.key}} was tagged.' }],
  }, { cookie: sara });
  assert.equal(rule.status, 201, JSON.stringify(rule.data));

  const hit = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Spike: try a new chart lib', type: 'Task' }, { cookie: omar });
  assert.deepEqual(hit.data.labels, ['research'], 'the response already includes automation changes');
  assert.equal(hit.data.priority, 'Low');
  const det = await api('GET', `/issues/${hit.data.key}`, null, { cookie: omar });
  const botComment = det.data.comments.find((c) => c.authorId === 'automation');
  assert.equal(botComment.body, `Hi Omar Saleh, ${hit.data.key} was tagged.`);
  assert.ok(det.data.history.some((h) => h.authorId === 'automation' && h.field === 'labels'));

  const miss = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Regular task' }, { cookie: omar });
  assert.deepEqual(miss.data.labels, []);
  let runs = await api('GET', `/automation/${rule.data.id}/runs`, null, { cookie: sara });
  assert.equal(runs.data[0].status, 'no_actions');
  assert.equal(runs.data[1].status, 'success');
  assert.equal(runs.data[1].issueKey, hit.data.key);

  // transition trigger with from/to + a rule that would loop if bot changes re-triggered rules
  const t = await api('POST', '/projects/KAN/automation', {
    name: 'Review → assign reporter', trigger: { type: 'issue_transitioned', from: 'In Progress', to: 'In Review' },
    actions: [{ type: 'assign', to: 'reporter' }, { type: 'transition', status: 'In Progress' }],
  }, { cookie: sara });
  assert.equal(t.status, 201);
  await api('PATCH', `/issues/${miss.data.key}`, { status: 'In Progress' }, { cookie: omar });
  const after = await api('PATCH', `/issues/${miss.data.key}`, { status: 'In Review' }, { cookie: omar });
  assert.equal(after.data.assigneeId, 'u3', 'assigned to the reporter (omar)');
  assert.equal(after.data.status, 'In Progress', 'bot transition did not re-trigger the rule (no loop)');
  runs = await api('GET', `/automation/${t.data.id}/runs`, null, { cookie: sara });
  assert.equal(runs.data.length, 1);

  // field-changed trigger from the seeded rule (priority → Highest adds the urgent label)
  const pr = await api('PATCH', `/issues/${miss.data.key}`, { priority: 'Highest' }, { cookie: omar });
  assert.ok(pr.data.labels.includes('urgent'));

  // disable + manual run + audit + delete
  const off = await api('PATCH', `/automation/${t.data.id}`, { enabled: false }, { cookie: sara });
  assert.equal(off.data.enabled, false);
  const man = await api('POST', `/automation/${rule.data.id}/run`, { issueKey: hit.data.key }, { cookie: sara });
  assert.equal(man.data.status, 'success');
  const audit = await api('GET', '/projects/KAN/automation/audit?limit=100', null, { cookie: sara });
  assert.ok(audit.data.length >= 5);
  assert.ok(audit.data.every((x) => x.ruleName));
  assert.equal((await api('DELETE', `/automation/${t.data.id}`, null, { cookie: sara })).status, 200);
  assert.equal((await api('GET', `/automation/${t.data.id}`, null, { cookie: sara })).status, 404);
});

test('automation: plan limit throttles runs on the Free plan', async () => {
  const { db, sql, container } = srv;
  const prev = await db.value(sql`SELECT plan FROM subscription WHERE id = 1`);
  await db.query(sql`UPDATE subscription SET plan = 'free' WHERE id = 1`); container.billing.invalidate();
  const ruleId = await db.value(sql`SELECT id FROM automation_rules WHERE name = 'Tag spikes'`);
  await db.query(sql`INSERT INTO automation_runs (rule_id, issue_key, status, message, actions, duration_ms)
    SELECT ${ruleId}, 'KAN-1', 'success', '', '[]'::jsonb, 1 FROM generate_series(1, 100)`);
  const c = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Spike while throttled' }, { cookie: omar });
  assert.deepEqual(c.data.labels, [], 'no actions once the monthly limit is used up');
  const last = await waitFor(async () => (await db.one(sql`SELECT status FROM automation_runs WHERE rule_id = ${ruleId} ORDER BY id DESC LIMIT 1`))?.status);
  assert.equal(last, 'throttled');
  await db.query(sql`DELETE FROM automation_runs WHERE issue_key = 'KAN-1' AND message = ''`);
  await db.query(sql`UPDATE subscription SET plan = ${prev} WHERE id = 1`); container.billing.invalidate();
});

test('webhooks: admin-only CRUD, signed deliveries, JQL filter, test ping, retries and redelivery', async () => {
  assert.equal((await api('GET', '/admin/webhooks', null, { cookie: sara })).status, 403);
  const list = await api('GET', '/admin/webhooks', null, { cookie: admin });
  assert.equal(list.data.webhooks.length, 1);
  assert.ok(list.data.events['jira:issue_created']);
  assert.equal((await api('POST', '/admin/webhooks', { name: 'x', url: 'ftp://x', events: ['jira:issue_created'] }, { cookie: admin })).status, 400);
  assert.equal((await api('POST', '/admin/webhooks', { name: 'x', url: sinkBase, events: ['bogus'] }, { cookie: admin })).status, 400);

  const w = await api('POST', '/admin/webhooks', {
    name: 'Sink', url: `${sinkBase}/hook`, secret: 's3cret', jql: 'project = KAN AND type = Bug',
    events: ['jira:issue_created', 'jira:issue_updated', 'comment_created', 'worklog_created'],
  }, { cookie: admin });
  assert.equal(w.status, 201, JSON.stringify(w.data));
  assert.equal(w.data.hasSecret, true);
  assert.equal(w.data.secret, undefined, 'secret is never returned');

  received.length = 0;
  await api('POST', '/issues', { projectKey: 'KAN', summary: 'Not a bug (filtered out)', type: 'Task' }, { cookie: sara });
  const bug = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Webhook bug', type: 'Bug', assigneeId: 'u4' }, { cookie: sara });
  const created = await waitFor(() => received.find((x) => x.json.webhookEvent === 'jira:issue_created' && x.json.issue.key === bug.data.key));
  assert.ok(created, 'issue_created delivered');
  assert.ok(!received.some((x) => x.json.issue?.fields?.summary === 'Not a bug (filtered out)'), 'JQL filter applied');
  const expected = `sha256=${crypto.createHmac('sha256', 's3cret').update(created.body).digest('hex')}`;
  assert.equal(created.headers['x-hub-signature'], expected);
  assert.equal(created.json.issue.fields.issuetype.name, 'Bug');
  assert.equal(created.json.user.accountId, 'u2');

  await api('PATCH', `/issues/${bug.data.key}`, { status: 'In Progress' }, { cookie: sara });
  const upd = await waitFor(() => received.find((x) => x.json.webhookEvent === 'jira:issue_updated' && x.json.issue.key === bug.data.key && x.json.changelog.items.some((i) => i.field === 'status')));
  assert.ok(upd);
  assert.deepEqual(upd.json.changelog.items.find((i) => i.field === 'status'), { field: 'status', fromString: 'To Do', toString: 'In Progress' });

  await api('POST', `/issues/${bug.data.key}/comments`, { body: 'Hook me' }, { cookie: sara });
  assert.ok(await waitFor(() => received.find((x) => x.json.webhookEvent === 'comment_created' && x.json.comment.body === 'Hook me')));
  await api('POST', `/issues/${bug.data.key}/worklogs`, { timeSpent: '45m' }, { cookie: sara });
  const wl = await waitFor(() => received.find((x) => x.json.webhookEvent === 'worklog_created'));
  assert.equal(wl.json.worklog.timeSpentSeconds, 2700);

  const ping = await api('POST', `/admin/webhooks/${w.data.id}/test`, null, { cookie: admin });
  assert.equal(ping.data.ok, true);
  assert.equal(ping.data.status, 200);

  // failing receiver: retried with the same delivery id, then redelivered manually
  sinkStatus = 503; received.length = 0;
  await api('PATCH', `/issues/${bug.data.key}`, { priority: 'High' }, { cookie: sara });
  await waitFor(() => received.filter((x) => x.json.webhookEvent === 'jira:issue_updated').length >= 3, 4000);
  const tries = received.filter((x) => x.json.webhookEvent === 'jira:issue_updated');
  assert.equal(tries.length, 3, 'three attempts');
  assert.equal(new Set(tries.map((x) => x.headers['x-masar-delivery'])).size, 1, 'same delivery id on retries');
  sinkStatus = 200;
  await wait(50);
  const dl = await api('GET', `/admin/webhooks/${w.data.id}/deliveries`, null, { cookie: admin });
  const failed = dl.data.find((d) => !d.ok && d.status === 503);
  assert.ok(failed);
  const full = await api('GET', `/admin/webhook-deliveries/${failed.id}`, null, { cookie: admin });
  assert.equal(full.data.payload.webhookEvent, 'jira:issue_updated');
  const re = await api('POST', `/admin/webhook-deliveries/${failed.id}/redeliver`, null, { cookie: admin });
  assert.equal(re.data.ok, true);
  assert.ok(re.data.delivery.attempt >= 4);

  const off = await api('PATCH', `/admin/webhooks/${w.data.id}`, { enabled: false }, { cookie: admin });
  assert.equal(off.data.enabled, false);
  received.length = 0;
  await api('PATCH', `/issues/${bug.data.key}`, { priority: 'Low' }, { cookie: sara });
  await wait(150);
  assert.equal(received.length, 0, 'disabled webhooks do not fire');
  assert.equal((await api('DELETE', `/admin/webhooks/${w.data.id}`, null, { cookie: admin })).status, 200);
});

test('CSV import: dry run preview with errors, then import', async () => {
  const bad = 'Summary,Issue Type,Priority,Assignee,Labels,Story Points,Due Date,Original Estimate\n'
    + 'Import one,Story,High,sara@ahdfinancial.com,"alpha beta",3,2026-11-01,4h\n'
    + '"Import, two",Bug,Urgent,,,,,\n'
    + 'Import three,Task,Low,nobody@example.com,,,,\n';
  assert.equal((await api('POST', '/projects/KAN/import', { csv: bad }, { cookie: khalidCookie() })).status, 403);
  const dry = await api('POST', '/projects/KAN/import', { csv: bad, dryRun: true }, { cookie: sara });
  assert.equal(dry.status, 200, JSON.stringify(dry.data));
  assert.equal(dry.data.total, 3);
  assert.equal(dry.data.valid, 1);
  assert.deepEqual(dry.data.errors.map((e) => e.line), [3, 4]);
  assert.match(dry.data.errors[0].error, /Unknown priority/);
  assert.equal(dry.data.preview[0].summary, 'Import one');
  assert.deepEqual(dry.data.preview[0].labels, ['alpha', 'beta']);
  assert.equal((await api('POST', '/projects/KAN/import', { csv: bad }, { cookie: sara })).status, 400, 'all-or-nothing');

  const good = 'Summary,Issue Type,Priority,Assignee,Labels,Story Points,Due Date,Original Estimate\n'
    + 'Import one,Story,High,sara@ahdfinancial.com,"alpha beta",3,2026-11-01,4h\n'
    + '"Import, two",Bug,Highest,Omar Saleh,,,,\n';
  const imp = await api('POST', '/projects/KAN/import', good, { cookie: sara, raw: true, headers: { 'Content-Type': 'text/csv' } });
  assert.equal(imp.status, 201, JSON.stringify(imp.data));
  assert.equal(imp.data.count, 2);
  const one = await api('GET', `/issues/${imp.data.created[0]}`, null, { cookie: sara });
  assert.equal(one.data.type, 'Story');
  assert.equal(one.data.assigneeId, 'u2');
  assert.equal(one.data.originalEstimate, 4 * 3600);
  assert.equal(one.data.dueDate, '2026-11-01');
  const two = await api('GET', `/issues/${imp.data.created[1]}`, null, { cookie: sara });
  assert.equal(two.data.summary, 'Import, two');
});

function khalidCookie() { return khalid; }

test('trash keeps worklogs and votes on restore', async () => {
  const c = await api('POST', '/issues', { projectKey: 'KAN', summary: 'Trash with time' }, { cookie: sara });
  await api('POST', `/issues/${c.data.key}/worklogs`, { timeSpent: '2h' }, { cookie: sara });
  await api('POST', `/issues/${c.data.key}/votes`, null, { cookie: omar });
  const del = await api('DELETE', `/issues/${c.data.key}`, null, { cookie: sara });
  assert.equal(del.status, 200);
  const res = await api('POST', `/trash/${del.data.trashId}/restore`, null, { cookie: sara });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const d = await api('GET', `/issues/${c.data.key}`, null, { cookie: sara });
  assert.equal(d.data.worklogs.length, 1);
  assert.equal(d.data.timeSpent, 7200);
  assert.equal(d.data.votes, 1);
});
