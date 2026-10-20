'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers/testServer');

let srv;
let base;
let cookieA = '';
let cookieB = '';
let orgAId = 'default-org';
let orgBId = '';

async function loginAs(email) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password' }),
  });
  return r.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  srv = await startTestServer();
  base = srv.base;

  // Ahmed (u1, admin) belongs to default-org
  cookieA = await loginAs('ahmed@ahdfinancial.com');
  // Omar (u2, member) belongs to default-org
  cookieB = await loginAs('omar@ahdfinancial.com');
});

after(async () => {
  await srv.close();
});

test('Step 06 Tenant 01: Default organization and workspace exist and are populated', async () => {
  const res = await fetch(`${base}/organizations/current`, {
    headers: { Cookie: cookieA },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.id, 'default-org');
  assert.equal(data.slug, 'default');
  assert.ok(data.myRole);

  const orgListRes = await fetch(`${base}/organizations`, {
    headers: { Cookie: cookieA },
  });
  assert.equal(orgListRes.status, 200);
  const orgList = await orgListRes.json();
  assert.ok(orgList.length >= 1);
  assert.equal(orgList[0].id, 'default-org');
});

test('Step 06 Tenant 02: User can create a new organization with dedicated workspace and isolated ownership', async () => {
  // Omar creates a separate organization "Apex Innovations"
  const createRes = await fetch(`${base}/organizations`, {
    method: 'POST',
    headers: {
      Cookie: cookieB,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Apex Innovations',
      slug: 'apex-corp',
    }),
  });
  assert.equal(createRes.status, 201);
  const newOrg = await createRes.json();
  assert.ok(newOrg.id.startsWith('org-'));
  assert.equal(newOrg.slug, 'apex-corp');
  assert.equal(newOrg.myRole, 'owner');
  orgBId = newOrg.id;

  // Verify workspaces created for new organization
  const wsRes = await fetch(`${base}/organizations/${orgBId}/workspaces`, {
    headers: {
      Cookie: cookieB,
      'X-Organization-Id': orgBId,
    },
  });
  assert.equal(wsRes.status, 200);
  const workspaces = await wsRes.json();
  assert.ok(workspaces.length >= 1);
  assert.equal(workspaces[0].slug, 'main');
});

test('Step 06 Tenant 03: Client header is verified: unauthorized X-Organization-Id header is safely ignored', async () => {
  // Ahmed is in default-org, NOT in Apex (orgBId)
  // Ahmed sends X-Organization-Id: orgBId attempting to access Apex's current details
  const spoofRes = await fetch(`${base}/organizations/current`, {
    headers: {
      Cookie: cookieA,
      'X-Organization-Id': orgBId,
    },
  });
  assert.equal(spoofRes.status, 200);
  const data = await spoofRes.json();
  // Server MUST NOT trust spoofed header and must remain on Ahmed's verified organization
  assert.equal(data.id, 'default-org');
  assert.notEqual(data.id, orgBId);
});

test('Step 06 Tenant 04: Cross-Tenant Project Isolation: Projects in Org B are completely invisible to Org A', async () => {
  // 1. Omar creates Project "APX" inside Apex (orgBId)
  const projRes = await fetch(`${base}/projects`, {
    method: 'POST',
    headers: {
      Cookie: cookieB,
      'Content-Type': 'application/json',
      'X-Organization-Id': orgBId,
    },
    body: JSON.stringify({
      key: 'APX',
      name: 'Apex Core Platform',
      type: 'software',
    }),
  });
  assert.equal(projRes.status, 201);

  // 2. Omar lists projects in Apex: sees APX
  const omarListRes = await fetch(`${base}/projects`, {
    headers: {
      Cookie: cookieB,
      'X-Organization-Id': orgBId,
    },
  });
  assert.equal(omarListRes.status, 200);
  const omarProjects = await omarListRes.json();
  const apxInOmar = omarProjects.find((p) => p.key === 'APX');
  assert.ok(apxInOmar, 'Omar in Apex must see APX project');

  // 3. Ahmed in default-org lists projects: MUST NOT see APX
  const ahmedListRes = await fetch(`${base}/projects`, {
    headers: {
      Cookie: cookieA,
      'X-Organization-Id': orgAId,
    },
  });
  assert.equal(ahmedListRes.status, 200);
  const ahmedProjects = await ahmedListRes.json();
  const apxInAhmed = ahmedProjects.find((p) => p.key === 'APX');
  assert.equal(apxInAhmed, undefined, 'Ahmed in default-org must NEVER see APX project');

  // 4. Ahmed directly probes APX via GET /projects/APX: MUST return 404 (without leaking existence)
  const probeRes = await fetch(`${base}/projects/APX`, {
    headers: {
      Cookie: cookieA,
      'X-Organization-Id': orgAId,
    },
  });
  assert.equal(probeRes.status, 404, 'Probing foreign project must return 404');
});

test('Step 06 Tenant 05: Cross-Tenant Work Item & Attachment Isolation: Issues in Org B cannot be found or downloaded by Org A', async () => {
  // 1. Omar creates an issue in APX
  const issueRes = await fetch(`${base}/issues`, {
    method: 'POST',
    headers: {
      Cookie: cookieB,
      'Content-Type': 'application/json',
      'X-Organization-Id': orgBId,
    },
    body: JSON.stringify({
      projectKey: 'APX',
      summary: 'Confidential Apex Roadmap Item',
      type: 'Task',
    }),
  });
  assert.equal(issueRes.status, 201);
  const issueData = await issueRes.json();
  assert.equal(issueData.key, 'APX-1');

  // 2. Omar uploads an attachment to APX-1
  const secretContent = Buffer.from('Apex proprietary source code and formulas', 'utf8');
  const upRes = await fetch(`${base}/issues/APX-1/attachments`, {
    method: 'POST',
    headers: {
      Cookie: cookieB,
      'Content-Type': 'text/plain',
      'X-Filename': 'apex-secrets.txt',
      'X-Organization-Id': orgBId,
    },
    body: secretContent,
  });
  assert.equal(upRes.status, 201);
  const attData = await upRes.json();
  const attId = attData.id;

  // 3. Ahmed searches issues via JQL: MUST NOT find APX-1
  const searchRes = await fetch(`${base}/search?jql=project+%3D+APX`, {
    headers: {
      Cookie: cookieA,
      'X-Organization-Id': orgAId,
    },
  });
  assert.equal(searchRes.status, 200);
  const searchResults = await searchRes.json();
  assert.equal(searchResults.total, 0);
  assert.equal(searchResults.issues.length, 0);

  // 4. Ahmed probes direct issue URL GET /issues/APX-1: MUST return 404
  const probeIssueRes = await fetch(`${base}/issues/APX-1`, {
    headers: {
      Cookie: cookieA,
      'X-Organization-Id': orgAId,
    },
  });
  assert.equal(probeIssueRes.status, 404, 'Direct probe of foreign issue must return 404');

  // 5. Ahmed probes attachment download GET /attachments/:id: MUST return 404
  const probeAttRes = await fetch(`${base}/attachments/${attId}`, {
    headers: {
      Cookie: cookieA,
      'X-Organization-Id': orgAId,
    },
  });
  assert.equal(probeAttRes.status, 404, 'Direct probe of foreign attachment must return 404');
});
