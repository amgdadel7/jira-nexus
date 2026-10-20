'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { bootstrap } = require('../src/main');

let server;
let proxyServer;
let apiPort;
let proxyPort;

before(async () => {
  // 1. Boot the approved unified entry point (src/main.js with in-memory PostgreSQL engine)
  const bootResult = await bootstrap({
    listen: true,
    serveClient: false,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PGLITE_DIR: 'memory://',
      PORT: '0',
      HOST: '127.0.0.1'
    }
  });

  server = bootResult.server;
  apiPort = server.address().port;

  // 2. Start a lightweight HTTP reverse-proxy simulating Vite dev proxy / Render proxy
  // Proxies requests from /api/* to the approved backend server at 127.0.0.1:apiPort
  proxyServer = http.createServer((clientReq, clientRes) => {
    const options = {
      hostname: '127.0.0.1',
      port: apiPort,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `127.0.0.1:${apiPort}`,
        'x-forwarded-for': clientReq.socket.remoteAddress,
        'x-forwarded-proto': 'http',
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes, { end: true });
    });

    proxyReq.on('error', (err) => {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Proxy Gateway Error', message: err.message }));
    });

    clientReq.pipe(proxyReq, { end: true });
  });

  await new Promise((resolve) => proxyServer.listen(0, '127.0.0.1', resolve));
  proxyPort = proxyServer.address().port;
});

after(async () => {
  if (proxyServer) {
    proxyServer.closeAllConnections?.();
    await new Promise((resolve) => proxyServer.close(resolve));
  }
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Smoke 01: Health check on unified backend entry point', async () => {
  // Test direct backend endpoint
  const res = await fetch(`http://127.0.0.1:${apiPort}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.database === 'postgres' || data.database === 'pglite');
});

test('Smoke 02: Health check routed through proxy (/api relative target)', async () => {
  // Test proxied endpoint
  const res = await fetch(`http://127.0.0.1:${proxyPort}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});

test('Smoke 03: End-to-end user login through proxy', async () => {
  const loginRes = await fetch(`http://127.0.0.1:${proxyPort}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ahmed@ahdfinancial.com',
      password: 'password'
    })
  });

  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.token, 'Must return session token');
  assert.equal(loginData.user.email, 'ahmed@ahdfinancial.com');
  assert.equal(loginData.user.role, 'admin');

  // Verify cookie is set
  const cookieHeader = loginRes.headers.get('set-cookie');
  assert.ok(cookieHeader && cookieHeader.includes('jc_session='));
});

test('Smoke 04: Create and read a work item resource through proxy with authenticated session', async () => {
  // 1. Authenticate through proxy
  const loginRes = await fetch(`http://127.0.0.1:${proxyPort}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ahmed@ahdfinancial.com',
      password: 'password'
    })
  });
  const { token } = await loginRes.json();
  assert.ok(token);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Create resource (Issue/Task)
  const createRes = await fetch(`http://127.0.0.1:${proxyPort}/api/issues`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      projectKey: 'KAN',
      summary: 'Automated smoke test work item',
      type: 'Task',
      priority: 'High',
      description: 'Created via smoke test verifying unified backend runtime through proxy'
    })
  });

  assert.equal(createRes.status, 201, `Create issue failed with status ${createRes.status}`);
  const createdIssue = await createRes.json();
  assert.ok(createdIssue.key, 'Created issue must have a key');
  assert.equal(createdIssue.summary, 'Automated smoke test work item');

  // 3. Read back the created resource
  const readRes = await fetch(`http://127.0.0.1:${proxyPort}/api/issues/${createdIssue.key}`, {
    method: 'GET',
    headers: authHeaders
  });

  assert.equal(readRes.status, 200, `Read issue failed with status ${readRes.status}`);
  const fetchedIssue = await readRes.json();
  assert.equal(fetchedIssue.key, createdIssue.key);
  assert.equal(fetchedIssue.summary, 'Automated smoke test work item');
  assert.equal(fetchedIssue.type, 'Task');
  assert.equal(fetchedIssue.priority, 'High');
});
