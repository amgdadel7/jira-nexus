'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startTestServer } = require('./helpers/testServer');
const { createBackup, restoreBackup } = require('../src/cli/backup');

let srv;
let base;
let cookie = '';
let omarCookie = '';

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
  cookie = await loginAs('ahmed@ahdfinancial.com');
  omarCookie = await loginAs('omar@ahdfinancial.com');
});

after(async () => {
  await srv.close();
});

test('Operations 01: Health check returns 200 with database engine info', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'healthy');
  assert.ok(data.database === 'postgres' || data.database === 'pglite');
  assert.ok(data.time);
});

test('Operations 02: Readiness probe returns 200 ready when database is connected', async () => {
  const res = await fetch(`${base}/ready`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ready');
  assert.equal(data.database, 'connected');
});

test('Operations 03: Request-ID middleware propagates existing ID and generates UUID when missing', async () => {
  // Test generated ID
  const res1 = await fetch(`${base}/health`);
  assert.equal(res1.status, 200);
  const reqId1 = res1.headers.get('x-request-id');
  assert.ok(reqId1, 'X-Request-Id header must be present');
  assert.match(reqId1, /^[0-9a-fA-F-]+$/);

  // Test custom incoming ID propagation
  const customId = 'req-trace-prod-test-9988';
  const res2 = await fetch(`${base}/health`, {
    headers: { 'X-Request-Id': customId },
  });
  assert.equal(res2.status, 200);
  assert.equal(res2.headers.get('x-request-id'), customId);
});

test('Operations 04: Attachment download access control: unauthorized download is rejected', async () => {
  // 1. Upload an attachment as Ahmed in KAN
  const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');
  const upRes = await fetch(`${base}/issues/KAN-1/attachments`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'image/png',
      'X-Filename': 'security-audit.png',
    },
    body: png,
  });
  assert.equal(upRes.status, 201);
  const attData = await upRes.json();
  const attId = attData.id;

  // 2. Unauthenticated download attempt MUST be rejected with 401
  const unauthRes = await fetch(`${base}/attachments/${attId}`);
  assert.equal(unauthRes.status, 401);

  // 3. Authenticated download by member succeeds
  const authRes = await fetch(`${base}/attachments/${attId}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authRes.status, 200);
  assert.equal(authRes.headers.get('content-type'), 'image/png');
  assert.match(authRes.headers.get('content-disposition'), /security-audit\.png/);
});

test('Operations 05: Isolated Backup and Restore Exercise: DB and Asset consistency verification', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'masar-backup-test-'));
  const backupDir = path.join(tempDir, 'backup');
  const uploadsDir = srv.container.config.uploadDir;

  const backupStart = Date.now();
  // 1. Create full backup
  const manifest = await createBackup({
    db: srv.container.db,
    uploadDir: uploadsDir,
    outDir: backupDir,
  });
  const backupDurationMs = Date.now() - backupStart;

  assert.ok(manifest.database.totalRecords > 0);
  assert.ok(manifest.files.count >= 1);
  assert.ok(fs.existsSync(path.join(backupDir, 'manifest.json')));
  assert.ok(fs.existsSync(path.join(backupDir, 'database.json')));

  // Count records before restore
  const preRestoreUserCount = await srv.container.db.value('SELECT COUNT(*) FROM users');
  const preRestoreIssueCount = await srv.container.db.value('SELECT COUNT(*) FROM issues');
  assert.ok(preRestoreUserCount > 0);

  // 2. Simulate complete data wipe (disaster simulation)
  await srv.container.db.exec('DELETE FROM attachments');
  await srv.container.db.exec('DELETE FROM issues');
  const wipedCount = await srv.container.db.value('SELECT COUNT(*) FROM issues');
  assert.equal(wipedCount, 0, 'Issues must be zero after wipe');

  // Remove files in uploads
  if (fs.existsSync(uploadsDir)) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }

  // 3. Execute Restore
  const restoreStart = Date.now();
  const restoreReport = await restoreBackup({
    db: srv.container.db,
    uploadDir: uploadsDir,
    backupDir,
  });
  const restoreDurationMs = Date.now() - restoreStart;

  assert.equal(restoreReport.success, true);
  assert.equal(restoreReport.fileReport.verifiedSha256, manifest.files.count);

  // 4. Verify post-restore data consistency
  const postRestoreUserCount = await srv.container.db.value('SELECT COUNT(*) FROM users');
  const postRestoreIssueCount = await srv.container.db.value('SELECT COUNT(*) FROM issues');

  assert.equal(postRestoreUserCount, preRestoreUserCount, 'User count must match pre-backup exactly');
  assert.equal(postRestoreIssueCount, preRestoreIssueCount, 'Issue count must match pre-backup exactly');

  // Verify can insert new issue without sequence collision
  const newIssueId = await srv.container.db.one(
    "INSERT INTO issues (project_key, issue_type_id, num, key, summary, status_id, priority_id, rank) VALUES ('KAN', 1, 9999, 'KAN-9999', 'Post restore task', 1, 1, 99999) RETURNING id"
  );
  assert.ok(newIssueId.id > 0);

  // Clean up test temp files
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log(`[Backup/Restore Exercise Results] Backup: ${backupDurationMs}ms | Restore: ${restoreDurationMs}ms | RTO target: < 5 min | RPO target: <= 1 hour`);
});
