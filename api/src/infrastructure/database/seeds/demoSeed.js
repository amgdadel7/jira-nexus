'use strict';

/**
 * Demo data: the AHD Financial workspace (KAN, PAY, FIN), seven people, sprints,
 * releases, components, teams, goals, forms, development activity, custom
 * fields, time tracking, votes, automation, billing history and a webhook.
 *
 * `seedDemo(container, { force })` is idempotent unless forced. A forced reseed
 * rebuilds the schema but keeps live sessions, API tokens and OAuth secrets so
 * nobody is logged out of the demo.
 */

const fs = require('fs');
const path = require('path');
const { sql } = require('../sql');
const { migrate, resetSchema } = require('../migrator');
const { hashPassword } = require('../../../shared/crypto');
const { formatDuration } = require('../../../domain/duration');
const B = require('../../../domain/billing');
const { Actor } = require('../../../application/Actor');

const H = 3600;
const json = (value) => JSON.stringify(value);

/* ---------------------------------------------------------------- data ---- */

const USERS = [
  ['u1', 'Ahmed Al-Haddad', 'ahmed@ahdfinancial.com', '#0052CC', 'admin', 'Head of Finance Engineering'],
  ['u2', 'Sara Nasser', 'sara@ahdfinancial.com', '#6554C0', 'member', 'Senior Software Engineer'],
  ['u3', 'Omar Saleh', 'omar@ahdfinancial.com', '#00875A', 'member', 'Financial Controller'],
  ['u4', 'Layla Hassan', 'layla@ahdfinancial.com', '#FF5630', 'member', 'DevOps Engineer'],
  ['u5', 'Yusuf Karim', 'yusuf@ahdfinancial.com', '#FF991F', 'member', 'Payments Engineer'],
  ['u6', 'Mona Farouk', 'mona@ahdfinancial.com', '#00B8D9', 'member', 'Product Designer'],
  ['u7', 'Khalid Mansour', 'khalid@ahdfinancial.com', '#8777D9', 'member', 'External Auditor'],
];

// [type, summary, status, priority, assignee, reporter, labels, dueOffset, points, parentIdx, createdDaysAgo, description]
const KAN_ISSUES = [
  ['Epic', 'Client onboarding portal', 'In Progress', 'High', 'u1', 'u1', ['portal'], 40, null, null, 44, 'Self-service portal where new clients can submit KYC documents, sign agreements and fund their accounts.'],
  ['Epic', 'Q4 regulatory reporting', 'To Do', 'Highest', 'u3', 'u1', ['compliance'], 60, null, null, 43, 'All work needed to file Q4 regulatory reports on time.'],
  ['Epic', 'Payments platform migration', 'In Progress', 'Medium', 'u2', 'u1', ['payments', 'infra'], 75, null, null, 42, 'Move payment processing from the legacy gateway to the new provider.'],
  ['Story', 'As a client, I can upload KYC documents', 'In Progress', 'High', 'u2', 'u1', ['portal', 'kyc'], 6, 5, 0, 38, 'Support PDF, JPG and PNG files up to 10 MB. Show upload progress and validation errors.'],
  ['Story', 'As a client, I can e-sign the account agreement', 'To Do', 'Medium', 'u4', 'u1', ['portal'], 14, 8, 0, 37, 'Integrate with the e-signature provider. Store signed PDFs in the document vault.'],
  ['Task', 'Design onboarding wizard screens', 'Done', 'Medium', 'u6', 'u2', ['design', 'portal'], -5, 3, 0, 36, 'Wireframes and high-fidelity mockups for the 5-step onboarding wizard.'],
  ['Bug', 'Upload fails for files larger than 5 MB', 'In Review', 'Highest', 'u2', 'u4', ['portal', 'kyc'], 1, 2, 0, 9, 'Steps to reproduce:\n1. Open onboarding wizard\n2. Upload a 6 MB PDF\n\nExpected: upload succeeds\nActual: 413 Request Entity Too Large'],
  ['Task', 'Reconcile Q3 vendor payments', 'Done', 'High', 'u3', 'u3', ['finance'], -10, 3, null, 33, 'Match all Q3 vendor invoices against bank statements and flag discrepancies.'],
  ['Task', 'Prepare capital adequacy report draft', 'In Progress', 'Highest', 'u3', 'u1', ['compliance', 'reporting'], 9, 5, 1, 30, 'First draft for internal review before submission.'],
  ['Task', 'Collect trial balance from all branches', 'To Do', 'High', 'u5', 'u3', ['reporting'], 12, 3, 1, 29, ''],
  ['Story', 'Automate AML transaction report export', 'To Do', 'Medium', 'u1', 'u3', ['compliance', 'automation'], 25, 8, 1, 28, 'Generate the monthly AML report automatically from the transaction warehouse.'],
  ['Task', 'Set up sandbox account with new payment provider', 'Done', 'Medium', 'u2', 'u2', ['payments'], -15, 2, 2, 27, ''],
  ['Story', 'Route card payments through new gateway', 'In Progress', 'High', 'u5', 'u2', ['payments'], 18, 13, 2, 26, 'Feature-flagged rollout: 5% → 25% → 100%.'],
  ['Bug', 'Duplicate refund issued on retry', 'To Do', 'Highest', 'u5', 'u6', ['payments', 'incident'], 2, 3, 2, 6, 'When the gateway times out, our retry logic issues the refund twice. Needs idempotency keys.'],
  ['Task', 'Write runbook for payment gateway failover', 'To Do', 'Low', null, 'u2', ['payments', 'docs'], 30, 2, 2, 24, ''],
  ['Task', 'Renew SSL certificates for client portal', 'Done', 'High', 'u4', 'u4', ['infra'], -2, 1, null, 22, ''],
  ['Task', 'Enable SSO for internal accounting tools', 'In Review', 'Medium', 'u4', 'u1', ['security', 'infra'], 4, 5, null, 21, 'Use the company identity provider (SAML) for all accounting apps.'],
  ['Bug', 'Dashboard totals rounding incorrectly', 'In Progress', 'Medium', 'u6', 'u3', ['reporting'], 3, 2, null, 19, 'Totals are off by 0.01 because values are rounded before summing.'],
  ['Task', 'Quarterly access review', 'To Do', 'Medium', 'u1', 'u1', ['security', 'compliance'], 13, 2, null, 18, 'Review who has access to finance systems and revoke stale accounts.'],
  ['Story', 'Export statements as CSV', 'To Do', 'Low', 'u6', 'u4', ['portal'], 35, 3, 0, 16, ''],
  ['Task', 'Update chart of accounts mapping', 'Done', 'Low', 'u3', 'u5', ['finance'], -7, 1, null, 15, ''],
  ['Bug', 'Wrong currency symbol shown for SAR accounts', 'Done', 'Low', 'u6', 'u4', ['portal', 'i18n'], -3, 1, null, 14, ''],
  ['Task', 'Vendor due diligence for new KYC provider', 'In Progress', 'Medium', 'u1', 'u3', ['compliance', 'vendor'], 8, 3, 0, 12, ''],
  ['Task', 'Archive FY2024 ledgers', 'To Do', 'Lowest', null, 'u3', ['finance'], null, 1, null, 11, ''],
  ['Story', 'Email notifications for pending approvals', 'To Do', 'Medium', 'u4', 'u2', ['portal', 'notifications'], 21, 5, 0, 8, 'Notify approvers when an onboarding application is waiting for them for more than 24 hours.'],
  ['Task', 'Load-test new gateway at 2x peak volume', 'To Do', 'High', 'u5', 'u2', ['payments', 'performance'], 16, 3, 2, 5, ''],
  ['Bug', 'Session expires during long KYC form', 'To Do', 'High', null, 'u6', ['portal', 'kyc'], 7, 2, 0, 3, 'Users lose their progress if they take longer than 15 minutes.'],
  ['Task', 'Board meeting financial pack — October', 'In Progress', 'High', 'u3', 'u1', ['reporting'], 5, 3, null, 2, ''],
  ['Subtask', 'Add server-side file size validation', 'To Do', 'High', 'u2', 'u2', ['kyc'], 1, 1, 6, 1, ''],
  ['Subtask', 'Increase proxy body size limit', 'Done', 'High', 'u4', 'u2', ['infra'], 0, 1, 6, 1, ''],
];

const KAN_COMMENTS = [
  [3, 'u4', 'Can we also accept HEIC files from iPhones?', 30],
  [3, 'u2', 'Good idea — I will add conversion on the backend.', 29],
  [6, 'u2', 'Root cause is the nginx client_max_body_size. Fix is in review.', 2],
  [6, 'u4', 'Confirmed on staging, 8 MB file uploads fine now 👍', 1],
  [8, 'u1', 'Please share the draft with the CFO by Thursday.', 4],
  [12, 'u5', 'Flag is at 5% in production. Error rate looks normal.', 3],
  [13, 'u6', 'Customer support reported 3 more cases this morning.', 1],
  [13, 'u5', 'Working on idempotency keys now.', 0],
  [16, 'u1', 'IdP metadata has been uploaded.', 5],
  [17, 'u3', 'Finance team noticed this on the monthly report.', 10],
  [26, 'u1', 'Let us raise the timeout to 60 minutes and add autosave.', 1],
];

const KAN_SPRINTS = [
  ['KAN Sprint 1', 'Stabilise KYC uploads before the August audit', 'closed', -48, -34, 34, 50],
  ['KAN Sprint 2', 'Payments reconciliation and certificate renewals', 'closed', -34, -20, 20, 36],
  ['KAN Sprint 3', 'Ship the KYC upload fixes and close out September reporting', 'closed', -20, -7, 7, 22],
  ['KAN Sprint 4', 'Launch the onboarding portal beta and start the gateway migration', 'active', -6, 8, null, 8],
  ['KAN Sprint 5', '', 'future', null, null, null, 2],
];

// [type, summary, status, priority, assignee, points, sprint, version, dueOffset, createdDaysAgo]
const PAY_ISSUES = [
  ['Epic', 'New payment gateway', 'In Progress', 'High', 'u5', null, null, null, 30, 38],
  ['Story', 'Tokenise cards with the new gateway vault', 'Done', 'High', 'u5', 5, 'PAY Sprint 1', '2026.10', null, 16],
  ['Story', '3-D Secure 2 challenge flow', 'Done', 'High', 'u2', 3, 'PAY Sprint 1', '2026.10', null, 15],
  ['Task', 'Map gateway decline codes to customer messages', 'In Progress', 'Medium', 'u6', 3, 'PAY Sprint 2', '2026.10', 6, 10],
  ['Story', 'Payout reconciliation report', 'In Progress', 'High', 'u3', 5, 'PAY Sprint 2', '2026.10', 9, 9],
  ['Bug', 'Webhook signature check fails on retries', 'In Review', 'Highest', 'u5', 2, 'PAY Sprint 2', '2026.10', 2, 4],
  ['Task', 'Load test 3x peak checkout traffic', 'To Do', 'High', 'u4', 5, 'PAY Sprint 2', '2026.10', 10, 3],
  ['Task', 'Cut-over runbook and rollback plan', 'To Do', 'Medium', 'u4', 3, 'PAY Sprint 2', '2026.10', 11, 2],
  ['Story', 'Apple Pay and Google Pay wallets', 'To Do', 'Medium', null, 8, 'PAY Sprint 3', null, null, 2],
  ['Story', 'Partial refunds from the back office', 'To Do', 'Low', null, 5, null, null, null, 1],
];

const FIN_ISSUES = [
  ['Task', 'October bank reconciliations', 'In Progress', 'High', 'u3', null, null, null, 5, 6],
  ['Task', 'Accruals review with department heads', 'To Do', 'Medium', 'u3', null, null, null, 9, 4],
  ['Task', 'Prepare auditor PBC list', 'To Do', 'High', 'u1', null, null, null, 14, 3],
  ['Task', 'September close sign-off', 'Done', 'Highest', 'u1', null, null, null, -12, 20],
  ['Bug', 'FX revaluation posts to the wrong ledger', 'In Review', 'High', 'u2', null, null, null, 3, 5],
  ['Task', 'Update chart of accounts for new entity', 'To Do', 'Low', null, null, null, null, null, 2],
];

const COMPONENT_RULES = [
  ['KAN', /portal|onboarding|kyc|e-sign|upload|sso|wizard|session/i, 'Client Portal'],
  ['KAN', /payment|refund|gateway|card|aml/i, 'Payments'],
  ['KAN', /report|capital|trial balance|dashboard|board meeting|regulatory/i, 'Reporting'],
  ['KAN', /load-test|runbook|sandbox|nginx|server|deploy|monitor/i, 'Infrastructure'],
  ['PAY', /gateway|webhook|decline|wallet|checkout|load test|cut-over/i, 'Gateway'],
  ['PAY', /payout|refund|reconciliation/i, 'Payouts'],
];

/* ------------------------------------------------------------- helpers ---- */

function clock() {
  const today = new Date();
  today.setUTCHours(9, 0, 0, 0);
  return {
    daysAgo: (d, h = 0) => new Date(today.getTime() - d * 864e5 - h * 36e5).toISOString(),
    dateIn: (d) => new Date(today.getTime() + d * 864e5).toISOString().slice(0, 10),
  };
}

async function lookups(db) {
  const byName = async (table) => new Map((await db.many(sql`SELECT id, name FROM ${sql.ident(table)}`)).map((r) => [r.name, r.id]));
  return {
    types: await byName('issue_types'),
    statuses: await byName('statuses'),
    priorities: await byName('priorities'),
    resolutions: await byName('resolutions'),
    workflowId: await db.value(sql`SELECT id FROM workflows WHERE is_default LIMIT 1`),
  };
}

const insert = (db, table, fields) => db.value(sql`INSERT INTO ${sql.ident(table)} ${sql.insertValues(fields)} RETURNING ${sql.raw(table === 'projects' ? 'key' : 'id')}`);
const insertPlain = (db, table, fields) => db.query(sql`INSERT INTO ${sql.ident(table)} ${sql.insertValues(fields)} ON CONFLICT DO NOTHING`);
const history = (db, issueId, authorId, field, from, to, at) => insertPlain(db, 'history', {
  issue_id: issueId, author_id: authorId, field, from_value: from, to_value: to, created_at: at,
});

/* --------------------------------------------------------------- steps ---- */

async function seedPeople(db, config, { daysAgo }) {
  const password = hashPassword(config.demoPassword);
  for (const [id, name, email, color, role, title] of USERS) {
    await insertPlain(db, 'users', {
      id, name, email, color, role, title, password_hash: password, signup_source: 'seed', email_verified: true, created_at: daysAgo(60),
    });
  }
  await insertPlain(db, 'organizations', {
    id: 'default-org', name: 'Default Organization', slug: 'default', plan: 'enterprise', owner_id: 'u1',
  });
  await insertPlain(db, 'workspaces', {
    id: 'default-ws', org_id: 'default-org', name: 'Main Workspace', slug: 'main',
  });
  for (const [id, , , , role] of USERS) {
    await insertPlain(db, 'organization_members', {
      org_id: 'default-org', user_id: id, role: role === 'admin' ? 'owner' : 'member',
    });
    await insertPlain(db, 'workspace_members', {
      workspace_id: 'default-ws', user_id: id, role: role === 'admin' ? 'admin' : 'member',
    });
  }
}

async function seedProjects(db, ref, { daysAgo }) {
  const project = (key, name, type, description, leadId, color, category, access, created) => insert(db, 'projects', {
    key, name, type, description, lead_id: leadId, color, category, access, workflow_id: ref.workflowId, org_id: 'default-org', created_at: daysAgo(created),
  });
  await project('KAN', 'AHD Financial', 'software', 'Finance engineering work for AHD Financial: client portal, payments and regulatory reporting.', 'u1', '#FFAB00', 'Engineering', 'limited', 90);
  await project('PAY', 'Payments Platform', 'software', 'Card processing, payouts and the new payment gateway.', 'u5', '#0C66E4', 'Engineering', 'open', 40);
  await project('FIN', 'Finance Close', 'business', 'Month-end close, reconciliations and audit requests.', 'u3', '#22A06B', 'Finance', 'private', 30);

  const member = (key, userId, role, by, d) => insertPlain(db, 'project_members', { project_key: key, user_id: userId, role, added_by: by, added_at: daysAgo(d) });
  for (const [u, r] of [['u2', 'admin'], ['u3', 'member'], ['u4', 'member'], ['u5', 'member'], ['u6', 'member']]) await member('KAN', u, r, 'u1', 80);
  for (const [u, r] of [['u2', 'member'], ['u4', 'member'], ['u6', 'viewer']]) await member('PAY', u, r, 'u5', 40);
  for (const [u, r] of [['u1', 'admin'], ['u6', 'member']]) await member('FIN', u, r, 'u3', 30);
  await member('FIN', 'u7', 'viewer', 'u3', 10); // external auditor: KAN viewer via the access level, explicit viewer in FIN

  for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) await insertPlain(db, 'project_stars', { user_id: u, project_key: 'KAN' });
  await insertPlain(db, 'project_stars', { user_id: 'u5', project_key: 'PAY' });
  await insertPlain(db, 'project_stars', { user_id: 'u3', project_key: 'FIN' });

  for (const [status, limit] of [['In Progress', 6], ['In Review', 3]]) {
    await insertPlain(db, 'board_column_limits', { project_key: 'KAN', status_id: ref.statuses.get(status), wip_limit: limit });
  }
}

async function seedSprints(db, { daysAgo, dateIn }) {
  const ids = new Map();
  const add = async (projectKey, [name, goal, state, start, end, completed, created], position, extra = {}) => {
    ids.set(name, await insert(db, 'sprints', {
      project_key: projectKey, name, goal, state, position, created_at: daysAgo(created),
      start_date: start == null ? null : dateIn(start), end_date: end == null ? null : dateIn(end),
      completed_at: completed == null ? null : daysAgo(completed), ...extra,
    }));
  };
  for (const [i, s] of KAN_SPRINTS.entries()) await add('KAN', s, i);
  await add('PAY', ['PAY Sprint 1', 'Gateway sandbox integration', 'closed', -17, -3, 3, 18], 10, { committed_points: 13, committed_count: 3, completed_points: 8, completed_count: 2 });
  await add('PAY', ['PAY Sprint 2', 'Go live with card payments on the new gateway', 'active', -3, 11, null, 4], 11, { committed_points: 21, committed_count: 5 });
  await add('PAY', ['PAY Sprint 3', '', 'future', null, null, null, 1], 12);
  return ids;
}

async function seedVersions(db, { daysAgo, dateIn }) {
  const ids = new Map();
  const add = async (projectKey, name, description, status, start, release, releasedAgo, position, created) => {
    ids.set(`${projectKey}:${name}`, await insert(db, 'versions', {
      project_key: projectKey, name, description, status, start_date: dateIn(start), release_date: dateIn(release),
      released_at: releasedAgo == null ? null : daysAgo(releasedAgo), position, created_at: daysAgo(created),
    }));
  };
  await add('KAN', '1.1.0', 'Portal hardening and audit fixes', 'archived', -60, -40, 40, 0, 70);
  await add('KAN', '1.2.0', 'KYC uploads, certificates and September reporting', 'released', -40, -7, 7, 1, 45);
  await add('KAN', '1.3.0', 'Client onboarding portal beta', 'unreleased', -7, 8, null, 2, 10);
  await add('KAN', '1.4.0', 'Payments gateway migration', 'unreleased', 8, 36, null, 3, 3);
  await add('PAY', '2026.10', 'October gateway launch', 'unreleased', -10, 12, null, 0, 12);
  return ids;
}

/** Inserts one work item with its creation / status history; returns the id. */
async function addIssue(db, ref, repo, item) {
  const { projectKey, num, type, status, priority, labels = [], created, updated, statusAt } = item;
  const id = await insert(db, 'issues', {
    key: `${projectKey}-${num}`, num, project_key: projectKey,
    issue_type_id: ref.types.get(type), status_id: ref.statuses.get(status), priority_id: ref.priorities.get(priority),
    resolution_id: status === 'Done' ? ref.resolutions.get('Done') : null,
    summary: item.summary, description: item.description || '',
    assignee_id: item.assignee || null, reporter_id: item.reporter, parent_id: item.parentId ?? null,
    sprint_id: item.sprintId ?? null, fix_version_id: item.versionId ?? null,
    due_date: item.due ?? null, start_date: item.start ?? null, story_points: item.points ?? null, rank: item.rank,
    created_at: created, updated_at: updated, resolved_at: status === 'Done' ? updated : null,
  });
  if (labels.length) await repo.setLabels(id, labels);
  const actorId = item.assignee || item.reporter;
  await history(db, id, item.reporter, 'created', null, null, created);
  if (status !== 'To Do') await history(db, id, actorId, 'status', 'To Do', status === 'Done' ? 'In Progress' : status, statusAt);
  if (status === 'Done') await history(db, id, actorId, 'status', 'In Progress', 'Done', updated);
  return id;
}

async function seedKanIssues(db, ref, repo, sprintIds, { daysAgo, dateIn }) {
  let doneSeen = 0;
  const sprintFor = (type, status, priority) => {
    if (type === 'Epic') return null;
    if (status === 'Done') return `KAN Sprint ${1 + (doneSeen++ % 3)}`;
    if (status !== 'To Do' || ['Highest', 'High'].includes(priority)) return 'KAN Sprint 4';
    if (priority === 'Medium') return 'KAN Sprint 5';
    return null;
  };
  const ids = [];
  for (const [i, row] of KAN_ISSUES.entries()) {
    const [type, summary, status, priority, assignee, reporter, labels, due, points, parentIdx, created, description] = row;
    const sprint = sprintFor(type, status, priority);
    ids.push(await addIssue(db, ref, repo, {
      projectKey: 'KAN', num: i + 1, type, summary, description, status, priority, assignee, reporter, labels, points,
      parentId: parentIdx == null ? null : ids[parentIdx], sprintId: sprint ? sprintIds.get(sprint) : null,
      due: due == null ? null : dateIn(due),
      start: due == null ? null : type === 'Epic' ? dateIn(-created + 2) : dateIn(due - Math.max(3, Math.round((points || 2) * 1.5))),
      rank: (i + 1) * 1000 + ((i * 7919) % 1000) - 500 * (i % 3 === 0 ? 1 : 0) + (i % 5) * 37,
      created: daysAgo(created, i % 7), updated: daysAgo(Math.max(0, Math.floor(created / 3)), (i * 3) % 11), statusAt: daysAgo(Math.floor(created / 2)),
    }));
  }
  await db.query(sql`UPDATE projects SET next_num = ${KAN_ISSUES.length + 1} WHERE key = 'KAN'`);
  for (const [idx, author, body, d] of KAN_COMMENTS) {
    const at = daysAgo(d, 2);
    await insertPlain(db, 'comments', { issue_id: ids[idx], author_id: author, body, created_at: at, updated_at: at });
  }
  // deterministic but slightly shuffled order compared with key order
  await db.query(sql`
    UPDATE issues SET rank = r.n * 1024
    FROM (SELECT id, row_number() OVER (ORDER BY rank, id) AS n FROM issues) r WHERE r.id = issues.id`);
  return ids;
}

async function seedOtherProjectIssues(db, ref, repo, sprintIds, versionIds, { daysAgo, dateIn }) {
  let rank = (await db.value(sql`SELECT max(rank) FROM issues`)) + 1024;
  for (const [projectKey, list] of [['PAY', PAY_ISSUES], ['FIN', FIN_ISSUES]]) {
    for (const [i, [type, summary, status, priority, assignee, points, sprint, version, due, created]] of list.entries()) {
      await addIssue(db, ref, repo, {
        projectKey, num: i + 1, type, summary, status, priority, assignee, reporter: 'u1', points,
        sprintId: sprint ? sprintIds.get(sprint) : null, versionId: version ? versionIds.get(`${projectKey}:${version}`) : null,
        due: due == null ? null : dateIn(due), rank: (rank += 1024),
        created: daysAgo(created), updated: daysAgo(Math.floor(created / 2)), statusAt: daysAgo(Math.floor(created * 0.7)),
      });
    }
    await db.query(sql`UPDATE projects SET next_num = ${list.length + 1} WHERE key = ${projectKey}`);
  }
}

async function seedCollaboration(db, ref, ids, { daysAgo, dateIn }) {
  await db.query(sql`
    INSERT INTO watchers (issue_id, user_id)
    SELECT id, reporter_id FROM issues WHERE reporter_id IS NOT NULL
    UNION SELECT id, assignee_id FROM issues WHERE assignee_id IS NOT NULL
    UNION SELECT issue_id, author_id FROM comments WHERE author_id IS NOT NULL
    ON CONFLICT DO NOTHING`);

  const t0 = daysAgo(5);
  for (const [a, b, type, by] of [[13, 25, 'blocks', 'u5'], [6, 3, 'blocks', 'u2'], [26, 24, 'relates', 'u6'], [9, 10, 'blocks', 'u3'], [17, 7, 'relates', 'u3'], [21, 3, 'duplicates', 'u6'], [11, 18, 'relates', 'u1']]) {
    await insertPlain(db, 'issue_links', { source_id: ids[a], target_id: ids[b], type, created_by: by, created_at: t0 });
  }

  const filter = (name, description, jql, owner, starred) => insertPlain(db, 'filters', { name, description, jql, owner_id: owner, starred, created_at: t0, updated_at: t0 });
  await filter('My open work', 'Everything assigned to me that is not done', 'project = KAN AND assignee = currentUser() AND status != Done ORDER BY priority DESC', 'u1', true);
  await filter('Payments incidents', 'Bugs and incidents for the payments platform', 'project = KAN AND labels in (payments, incident) AND type = Bug ORDER BY created DESC', 'u1', true);
  await filter('Overdue', 'Work items past their due date', 'project = KAN AND duedate < now() AND status != Done ORDER BY duedate ASC', 'u1', false);
  await filter('Unassigned backlog', '', 'project = KAN AND assignee IS EMPTY ORDER BY cf[10019] ASC', 'u2', false);

  const goal = (name, description, status, owner, target, created, updated) => insert(db, 'goals', {
    name, description, status, owner_id: owner, target_date: dateIn(target), created_at: daysAgo(created), updated_at: daysAgo(updated),
  });
  const g1 = await goal('Launch self-service client onboarding', 'Cut new-client onboarding time from 5 days to under 1 day by moving KYC and agreements online.', 'on_track', 'u1', 45, 40, 3);
  const g2 = await goal('File Q4 regulatory reports on time', 'Zero late or amended submissions to the regulator in Q4.', 'at_risk', 'u3', 60, 40, 1);
  const g3 = await goal('Migrate 100% of card volume to the new gateway', 'Retire the legacy payment gateway before the contract renewal.', 'off_track', 'u2', 75, 38, 2);
  const g4 = await goal('Pass the annual security audit', 'No high findings in the external audit.', 'pending', 'u4', 120, 10, 10);
  for (const [g, i] of [[g1, 0], [g2, 1], [g3, 2], [g4, 16], [g4, 18], [g4, 15]]) await insertPlain(db, 'goal_issues', { goal_id: g, issue_id: ids[i] });

  const form = (projectKey, name, description, type, fields, labels, assignee, active, submissions, by, created) => insertPlain(db, 'forms', {
    project_key: projectKey, name, description, issue_type_id: ref.types.get(type), fields: json(fields), default_labels: labels,
    default_assignee_id: assignee, active, submissions, created_by: by, created_at: daysAgo(created), updated_at: daysAgo(created),
  });
  await form('KAN', 'Report a bug', 'Found something broken in the client portal or internal tools? Tell us here.', 'Bug', ['summary', 'description', 'priority', 'dueDate'], ['form', 'triage'], 'u2', true, 4, 'u1', 30);
  await form('KAN', 'Finance data request', 'Request a report, export or reconciliation from the finance team.', 'Task', ['summary', 'description', 'dueDate', 'labels'], ['form', 'finance'], 'u3', true, 2, 'u3', 20);
  await form('KAN', 'Access request', 'Ask for access to a finance system.', 'Task', ['summary', 'description', 'priority'], ['form', 'security'], 'u4', false, 0, 'u4', 8);
  await form('FIN', 'Expense report query', 'Questions about an expense claim or reimbursement.', 'Task', ['summary', 'description', 'dueDate'], ['form', 'expenses'], 'u3', true, 1, 'u3', 15);

  const dev = [
    [6, 'branch', 'client-portal', 'KAN-7-upload-fails-for-large-files', null, 'active', 'u2', 3],
    [6, 'commit', 'client-portal', 'KAN-7 Increase nginx client_max_body_size to 12m', 'a3f9c21', null, 'u4', 2],
    [6, 'commit', 'client-portal', 'KAN-7 Validate file size on the server', '7be01d4', null, 'u2', 2],
    [6, 'pr', 'client-portal', 'KAN-7: Fix uploads larger than 5 MB', '142', 'open', 'u2', 2],
    [3, 'branch', 'client-portal', 'KAN-4-kyc-document-upload', null, 'active', 'u2', 20],
    [3, 'pr', 'client-portal', 'KAN-4: KYC document upload step', '131', 'merged', 'u2', 12],
    [12, 'branch', 'payments-service', 'KAN-13-route-card-payments', null, 'active', 'u5', 15],
    [12, 'commit', 'payments-service', 'KAN-13 Add feature flag for new gateway routing', 'c81d0aa', null, 'u5', 9],
    [12, 'pr', 'payments-service', 'KAN-13: Route 5% of card traffic to new gateway', '88', 'merged', 'u5', 6],
    [13, 'branch', 'payments-service', 'KAN-14-idempotent-refunds', null, 'active', 'u5', 1],
    [13, 'commit', 'payments-service', 'KAN-14 Add idempotency keys to refund requests', 'f00ba12', null, 'u5', 0],
    [16, 'pr', 'infra', 'KAN-17: SAML SSO for accounting apps', '57', 'open', 'u4', 4],
    [15, 'pr', 'infra', 'KAN-16: Renew portal certificates', '55', 'merged', 'u4', 6],
    [17, 'pr', 'reporting', 'KAN-18: Sum before rounding on dashboard totals', '23', 'declined', 'u6', 5],
  ];
  for (const [i, kind, repo, name, refName, status, author, d] of dev) {
    await insertPlain(db, 'dev_items', { issue_id: ids[i], kind, repo, name, ref: refName, status, author_id: author, created_at: daysAgo(d, 3) });
  }

  const notify = (actor, idx, type, message, read, at) => insertPlain(db, 'notifications', { user_id: 'u1', actor_id: actor, issue_id: ids[idx], type, message, read, created_at: at });
  await notify('u5', 13, 'comment', 'commented on KAN-14: “Working on idempotency keys now.”', false, daysAgo(0, 2));
  await notify('u4', 16, 'status', 'changed KAN-17 to In Review', false, daysAgo(1));
  await notify('u3', 26, 'assigned', 'mentioned you on KAN-27', true, daysAgo(2));
  await notify('u2', 6, 'comment', 'commented on KAN-7: “Root cause is the nginx client_max_body_size.”', true, daysAgo(2, 4));
}

/** Sprint carry-over history, realistic estimates, velocity numbers and fix versions. */
async function seedPlanning(db, ref, sprintIds, versionIds, { daysAgo }) {
  const sprint4 = sprintIds.get('KAN Sprint 4');
  const carried = await db.many(sql`
    SELECT id FROM issue_view WHERE sprint_id = ${sprint4} AND status_category <> 'todo' AND story_points <= 2 ORDER BY rank`);
  const chain = [['KAN Sprint 2', 'KAN Sprint 3', 20], ['KAN Sprint 3', 'KAN Sprint 4', 7]];
  for (const [n, item] of carried.slice(0, 3).entries()) {
    for (const [from, to, d] of n === 0 ? chain : [chain[1]]) await history(db, item.id, 'u1', 'sprint', from, to, daysAgo(d));
  }
  for (const item of carried.slice(3, 4)) {
    await history(db, item.id, 'u1', 'sprint', 'KAN Sprint 1', 'KAN Sprint 2', daysAgo(34));
    await history(db, item.id, 'u1', 'sprint', 'KAN Sprint 2', 'KAN Sprint 4', daysAgo(8));
  }

  const estimates = [8, 5, 8, 13, 5, 8, 5, 3];
  const done = await db.many(sql`SELECT id FROM issue_view WHERE project_key = 'KAN' AND status_category = 'done' AND hierarchy_level < 1 ORDER BY id`);
  for (const [i, item] of done.entries()) await db.query(sql`UPDATE issues SET story_points = ${estimates[i % estimates.length]} WHERE id = ${item.id}`);

  for (const s of await db.many(sql`SELECT id, name, state FROM sprints WHERE project_key = 'KAN' AND state <> 'future'`)) {
    const totals = (where) => db.one(sql`SELECT count(*)::int AS c, coalesce(sum(story_points), 0)::float AS p FROM issue_view WHERE ${where}`);
    const now = await totals(sql`sprint_id = ${s.id} AND hierarchy_level < 1`);
    const finished = await totals(sql`sprint_id = ${s.id} AND hierarchy_level < 1 AND status_category = 'done'`);
    const out = await db.one(sql`
      SELECT count(DISTINCT i.id)::int AS c, coalesce(sum(i.story_points), 0)::float AS p
      FROM history h JOIN issues i ON i.id = h.issue_id WHERE h.field = 'sprint' AND h.from_value = ${s.name}`);
    const fields = s.state === 'closed'
      ? { committed_points: now.p + out.p, committed_count: now.c + out.c, completed_points: finished.p, completed_count: finished.c }
      : { committed_points: now.p, committed_count: now.c };
    await db.query(sql`UPDATE sprints SET ${sql.set(fields)} WHERE id = ${s.id}`);
  }

  const v = (name) => versionIds.get(`KAN:${name}`);
  await db.query(sql`UPDATE issues SET fix_version_id = ${v('1.2.0')} WHERE id IN (SELECT id FROM issue_view WHERE project_key = 'KAN' AND status_category = 'done' AND hierarchy_level < 1)`);
  await db.query(sql`UPDATE issues SET fix_version_id = ${v('1.3.0')} WHERE id IN (SELECT id FROM issue_view WHERE sprint_id = ${sprint4} AND hierarchy_level < 1)`);
  await db.query(sql`UPDATE issues SET fix_version_id = ${v('1.4.0')} WHERE id IN (SELECT id FROM issue_view WHERE sprint_id = ${sprintIds.get('KAN Sprint 5')} AND hierarchy_level < 1)`);
  // one finished item shipped late in 1.3.0 so its progress bar is not empty
  await db.query(sql`UPDATE issues SET fix_version_id = ${v('1.3.0')} WHERE id = (
    SELECT id FROM issue_view WHERE project_key = 'KAN' AND status_category = 'done' AND hierarchy_level < 1 ORDER BY resolved_at DESC LIMIT 1)`);
}

async function seedComponentsAndTeams(db, repo, { daysAgo }) {
  const componentIds = new Map();
  const component = async (projectKey, name, description, lead, defaultAssignee, created) => {
    componentIds.set(`${projectKey}:${name}`, await insert(db, 'components', {
      project_key: projectKey, name, description, lead_id: lead, default_assignee: defaultAssignee, created_at: daysAgo(created),
    }));
  };
  await component('KAN', 'Client Portal', 'Customer-facing onboarding and self-service portal.', 'u2', 'component_lead', 70);
  await component('KAN', 'Payments', 'Card processing, refunds and the new gateway.', 'u5', 'component_lead', 70);
  await component('KAN', 'Reporting', 'Regulatory and management reporting.', 'u3', 'component_lead', 70);
  await component('KAN', 'Infrastructure', 'Environments, CI/CD and observability.', 'u4', 'unassigned', 60);
  await component('PAY', 'Gateway', 'Integration with the new payment gateway.', 'u5', 'component_lead', 40);
  await component('PAY', 'Payouts', 'Merchant payouts and reconciliation.', 'u3', 'project_lead', 40);

  const team = (name, description, color, by, created) => insert(db, 'teams', { name, description, color, created_by: by, created_at: daysAgo(created) });
  const platform = await team('Platform', 'Portal, infrastructure and developer experience.', '#0C66E4', 'u1', 75);
  const payments = await team('Payments Squad', 'Gateway migration, refunds and payouts.', '#E2483D', 'u5', 45);
  const finops = await team('Finance Ops', 'Month-end close, reconciliations and reporting.', '#22A06B', 'u3', 35);
  for (const [teamId, members] of [[platform, ['u1', 'u2', 'u4', 'u6']], [payments, ['u5', 'u2']], [finops, ['u3', 'u1']]]) {
    for (const u of members) await insertPlain(db, 'team_members', { team_id: teamId, user_id: u });
  }

  for (const row of await db.many(sql`SELECT id, project_key, summary FROM issues ORDER BY id`)) {
    const names = [...new Set(COMPONENT_RULES.filter(([pk, re]) => pk === row.project_key && re.test(row.summary)).map((r) => r[2]))].slice(0, 2);
    if (names.length) await repo.setComponents(row.id, names.map((n) => componentIds.get(`${row.project_key}:${n}`)));
    const teamId = row.project_key === 'FIN' || names.includes('Reporting') ? finops
      : row.project_key === 'PAY' || names.includes('Payments') ? payments
        : names.includes('Client Portal') || names.includes('Infrastructure') ? platform : null;
    if (teamId) await db.query(sql`UPDATE issues SET team_id = ${teamId} WHERE id = ${row.id}`);
  }
}

/** Custom fields on KAN (none required) with values on a few items. */
async function seedCustomFields(c, admin, ids) {
  const create = (body) => c.customFields.create(admin, { ...body, projects: ['KAN'] });
  const impact = await create({ name: 'Customer impact', type: 'select', description: 'How strongly customers are affected.', options: ['None', 'Low', 'Medium', 'High', 'Critical'] });
  const deadline = await create({ name: 'Regulatory deadline', type: 'date', description: 'Date the regulator expects this to be done.' });
  const value = await create({ name: 'Business value', type: 'number', description: 'Relative value score (1–100).' });
  const cab = await create({ name: 'Requires CAB approval', type: 'checkbox', description: 'Change advisory board sign-off needed before release.' });
  const option = (name) => impact.options.find((o) => o.value === name).id;
  const values = [
    [6, { [impact.id]: option('High'), [value.id]: 60 }],
    [8, { [deadline.id]: clock().dateIn(14), [value.id]: 90, [cab.id]: true }],
    [10, { [deadline.id]: clock().dateIn(30), [value.id]: 70 }],
    [12, { [impact.id]: option('Medium'), [value.id]: 80, [cab.id]: true }],
    [13, { [impact.id]: option('Critical'), [value.id]: 95 }],
    [26, { [impact.id]: option('High'), [value.id]: 40 }],
  ];
  for (const [idx, fields] of values) {
    await c.customFields.applyValues(admin, { id: ids[idx], project_key: 'KAN' }, fields, { recordHistory: false });
  }
}

/** One work item already in the recycle bin, created and deleted through the real use cases. */
async function seedTrash(c, { daysAgo }) {
  const sara = new Actor(await c.userRepo.findById('u2'));
  const spike = await c.issueService.create(sara, {
    projectKey: 'KAN', type: 'Task', summary: 'Spike: evaluate PDF rendering libraries', description: 'Superseded by the e-sign vendor decision.', assigneeId: 'u6', labels: ['spike'],
  });
  await c.issueService.delete(sara, spike.key);
  await c.db.query(sql`UPDATE trash SET deleted_at = ${daysAgo(3)} WHERE issue_key = ${spike.key}`);
  await c.db.query(sql`DELETE FROM notifications WHERE type = 'assigned' AND user_id = 'u6' AND created_at > now() - interval '1 minute'`);
  return spike.key;
}

async function seedAuditAndSettings(c, { daysAgo }, spikeKey, keptOauth) {
  const { db } = c;
  await db.query(sql`DELETE FROM audit_log`);
  const audit = (actor, action, project, target, details, d) => insertPlain(db, 'audit_log', {
    actor_id: actor, action, project_key: project, target, details: json(details), created_at: typeof d === 'number' ? daysAgo(d) : d,
  });
  await audit('u1', 'project.created', 'KAN', 'KAN', { name: 'AHD Financial', type: 'software' }, 90);
  await audit('u5', 'project.created', 'PAY', 'PAY', { name: 'Payments Platform', type: 'software' }, 45);
  await audit('u3', 'project.created', 'FIN', 'FIN', { name: 'Finance Close', type: 'business' }, 35);
  await audit('u3', 'project.access_changed', 'FIN', 'FIN', { access: { from: 'open', to: 'private' } }, 34);
  await audit('u1', 'project.access_changed', 'KAN', 'KAN', { access: { from: 'open', to: 'limited' } }, 20);
  await audit('u1', 'member.role_changed', 'KAN', 'Sara Nasser', { userId: 'u2', from: 'member', to: 'admin' }, 19);
  await audit('u5', 'member.role_changed', 'PAY', 'Mona Farouk', { userId: 'u6', from: null, to: 'viewer' }, 15);
  await audit('u3', 'member.added', 'FIN', 'Khalid Mansour', { userId: 'u7', role: 'viewer' }, 10);
  await audit('u1', 'user.invited', null, 'Khalid Mansour', { userId: 'u7', email: 'khalid@ahdfinancial.com', role: 'member' }, 10);
  await audit('u2', 'issue.deleted', 'KAN', spikeKey, { summary: 'Spike: evaluate PDF rendering libraries' }, 3);
  await audit('u1', 'custom_field.created', null, 'Customer impact', { type: 'select' }, 25);

  if (keptOauth) await insertPlain(db, 'site_settings', { key: 'oauth', value: json(keptOauth) });
  await insertPlain(db, 'site_settings', { key: 'site', value: json({ signup: 'open', allowedDomains: ['ahdfinancial.com'] }) });

  // Billing: Premium monthly with a saved Visa card and three months of invoices.
  const monthsBack = (iso, n) => {
    const d = new Date(iso);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString();
  };
  const start = daysAgo(10);
  const seats = await db.value(sql`SELECT count(*)::int FROM users WHERE active AND NOT bot`);
  await insertPlain(db, 'payment_methods', { brand: 'Visa', last4: '4242', exp_month: 8, exp_year: new Date().getUTCFullYear() + 3, holder: 'Ahmed Al-Haddad', is_default: true, created_at: monthsBack(start, 2) });
  for (const [n, plan] of [[2, 'standard'], [1, 'standard'], [0, 'premium']]) {
    const periodStart = monthsBack(start, n);
    const unit = B.PLANS[plan].price.monthly;
    await c.billing.createInvoice({
      created: periodStart, periodStart, periodEnd: B.addCycle(periodStart, 'monthly'), plan, cycle: 'monthly', seats, status: 'paid', card: 'Visa •••• 4242',
      lines: [{ description: `${B.PLANS[plan].name} plan (monthly) – ${seats} users × ${B.money(unit)}`, amount: unit * seats }],
    });
  }
  await db.query(sql`UPDATE subscription SET ${sql.set({
    plan: 'premium', cycle: 'monthly', status: 'active', trial_used: true, current_period_start: start, current_period_end: B.addCycle(start, 'monthly'),
    cancel_at_period_end: false, billing_email: 'billing@ahdfinancial.com', company: 'AHD Financial', updated_at: start,
  })} WHERE id = 1`);
  await audit('u1', 'billing.plan_changed', null, 'Premium', { from: 'standard', to: 'premium', cycle: 'monthly' }, start);
}

/** Estimates and worklogs, votes, automation rules with run history, a sample webhook. */
async function seedProductivity(db, { daysAgo }) {
  const items = await db.many(sql`SELECT * FROM issue_view WHERE project_key = 'KAN' AND hierarchy_level < 1 ORDER BY num`);
  const notes = ['Implementation', 'Code review fixes', 'Pairing session', 'Investigated root cause', 'Wrote tests', 'Updated documentation', 'Deployed to staging', ''];
  const at = (d, hour) => {
    const x = new Date(daysAgo(d));
    x.setUTCHours(hour, 0, 0, 0);
    return x.toISOString();
  };
  for (const [n, i] of items.entries()) {
    if (i.story_points == null && n % 3 === 2) continue; // a few items stay unestimated
    const original = Math.max(1, Math.round((i.story_points || 2) * 4)) * H;
    let spent = 0;
    if (i.assignee_id && i.status !== 'To Do') {
      const logs = i.status === 'Done' ? 3 : i.status === 'In Review' ? 2 : 1 + (n % 2);
      for (let k = 0; k < logs; k += 1) {
        const seconds = (((n + k) % 4) + 1) * H + (k % 2 ? 30 * 60 : 0);
        const started = at(1 + ((n * 2 + k * 3) % 12), 6 + ((n + k) % 7));
        await insertPlain(db, 'worklogs', { issue_id: i.id, author_id: i.assignee_id, started_at: started, time_spent: seconds, comment: notes[(n + k) % notes.length], created_at: started, updated_at: started });
        spent += seconds;
      }
    }
    const remaining = i.status === 'Done' ? 0 : Math.max(0, original - spent);
    await db.query(sql`UPDATE issues SET original_estimate = ${original}, remaining_estimate = ${remaining}, time_spent = ${spent} WHERE id = ${i.id}`);
    await history(db, i.id, i.reporter_id, 'original estimate', null, formatDuration(original), i.created_at);
  }
  await db.query(sql`
    UPDATE issues SET original_estimate = story_points * 4 * ${H}, remaining_estimate = story_points * 4 * ${H}, time_spent = 0
    WHERE project_key = 'PAY' AND story_points IS NOT NULL`);

  const voters = ['u2', 'u3', 'u4', 'u5', 'u6'];
  for (const [n, i] of items.filter((x) => x.status !== 'Done').slice(0, 12).entries()) {
    for (const [k, u] of voters.slice(0, (n % 4) + 1).entries()) {
      if (u !== i.reporter_id) await insertPlain(db, 'votes', { issue_id: i.id, user_id: u, created_at: daysAgo(2 + k + (n % 5)) });
    }
  }

  const t0 = daysAgo(20);
  const rule = (name, description, enabled, trigger, condition, actions, by) => insert(db, 'automation_rules', {
    project_key: 'KAN', name, description, enabled, trigger: json(trigger), condition, actions: json(actions), created_by: by, created_at: t0, updated_at: t0,
  });
  const r1 = await rule('Assign new bugs using balanced workload', 'Spreads incoming bugs across the team.', true, { type: 'issue_created' }, 'type = Bug AND assignee IS EMPTY',
    [{ type: 'assign', to: 'balanced' }, { type: 'comment', body: 'Assigned to {{issue.assignee.displayName}} automatically (balanced workload).' }], 'u2');
  const r2 = await rule('Label urgent work when priority becomes Highest', '', true, { type: 'field_changed', field: 'priority' }, 'priority = Highest',
    [{ type: 'add_label', label: 'urgent' }, { type: 'add_watcher', userId: 'u2' }], 'u2');
  const r3 = await rule('When work moves to In Review, comment for the reporter', '', false, { type: 'issue_transitioned', to: 'In Review' }, '',
    [{ type: 'comment', body: '{{issue.key}} is ready for review, {{issue.reporter.displayName}}.' }], 'u1');
  const run = (ruleId, key, status, message, actions, ms, d) => insertPlain(db, 'automation_runs', {
    rule_id: ruleId, issue_key: key, status, message, actions: json(actions), duration_ms: ms, created_at: daysAgo(d),
  });
  await run(r1, 'KAN-27', 'success', 'Assign work item: Assigned to Layla Hassan · Comment on work item: Comment added', [{ type: 'assign', ok: true, detail: 'Assigned to Layla Hassan' }, { type: 'comment', ok: true, detail: 'Comment added' }], 41, 6);
  await run(r1, 'KAN-29', 'no_actions', 'The work item didn’t match the rule’s condition.', [], 6, 4);
  await run(r2, 'KAN-12', 'success', 'Add label: Added label urgent · Add watcher: Added Sara Nasser as a watcher', [{ type: 'add_label', ok: true, detail: 'Added label urgent' }, { type: 'add_watcher', ok: true, detail: 'Added Sara Nasser as a watcher' }], 23, 2);
  await run(r3, 'KAN-8', 'success', 'Comment on work item: Comment added', [{ type: 'comment', ok: true, detail: 'Comment added' }], 18, 9);

  await insertPlain(db, 'webhooks', {
    name: 'Finance data warehouse sync', url: 'https://hooks.example.com/masar/issues', secret: 'change-me',
    events: ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted'], jql: 'project = KAN', enabled: false,
    created_by: 'u1', created_at: daysAgo(15), updated_at: daysAgo(15),
  });
}

/* ---------------------------------------------------------------- main ---- */

async function keepLogins(db) {
  const exists = await db.value(sql`SELECT to_regclass('public.sessions') IS NOT NULL`);
  if (!exists) return { sessions: [], apiTokens: [], oauth: null };
  return {
    sessions: await db.many(sql`SELECT * FROM sessions WHERE expires_at > now()`),
    apiTokens: await db.many(sql`SELECT * FROM api_tokens WHERE expires_at IS NULL OR expires_at > now()`),
    oauth: (await db.one(sql`SELECT value FROM site_settings WHERE key = 'oauth'`))?.value || null,
  };
}

async function restoreLogins(db, kept) {
  for (const [table, rows] of [['sessions', kept.sessions], ['api_tokens', kept.apiTokens]]) {
    for (const row of rows) {
      const active = await db.value(sql`SELECT 1 FROM users WHERE id = ${row.user_id} AND active`);
      if (active) await insertPlain(db, table, row);
    }
  }
  await db.query(sql`SELECT setval(pg_get_serial_sequence('api_tokens', 'id'), greatest((SELECT max(id) FROM api_tokens), 1))`);
}

function resetUploads(config) {
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(config.uploadDir, 'avatars'), { recursive: true });
}

function invalidateCaches(c) {
  for (const service of [c.catalog, c.customFields, c.billing, c.access]) service?.invalidate?.();
}

async function seedDemo(c, { force = false, logger = console } = {}) {
  const { db, config } = c;
  const hasData = await db.value(sql`SELECT to_regclass('public.issues') IS NOT NULL AND EXISTS (SELECT 1 FROM issues) AND EXISTS (SELECT 1 FROM users WHERE password_hash IS NOT NULL)`);
  if (hasData && !force) return false;

  const kept = await keepLogins(db);
  if (force) {
    await resetSchema(db);
    await migrate(db, { logger: { info() {}, warn() {} } });
  }
  invalidateCaches(c);
  resetUploads(config);

  const time = clock();
  const ref = await lookups(db);
  // 1) work items and everything around them; the spike goes through the real use cases,
  //    so its domain events fire on commit (before any automation rule exists).
  const spikeKey = await db.tx(async () => {
    await seedPeople(db, config, time);
    await seedProjects(db, ref, time);
    const sprintIds = await seedSprints(db, time);
    const versionIds = await seedVersions(db, time);
    const ids = await seedKanIssues(db, ref, c.issueRepo, sprintIds, time);
    await seedOtherProjectIssues(db, ref, c.issueRepo, sprintIds, versionIds, time);
    await seedCollaboration(db, ref, ids, time);
    await seedPlanning(db, ref, sprintIds, versionIds, time);
    await seedComponentsAndTeams(db, c.issueRepo, time);
    invalidateCaches(c);
    const admin = new Actor(await c.userRepo.findById('u1'));
    await seedCustomFields(c, admin, ids);
    return seedTrash(c, time);
  });
  // 2) time tracking, votes, automation, webhooks, audit history, billing and kept logins.
  await db.tx(async () => {
    await seedProductivity(db, time);
    await seedAuditAndSettings(c, time, spikeKey, kept.oauth);
    await restoreLogins(db, kept);
  });
  invalidateCaches(c);
  logger.log?.('Seeded demo data.');
  return true;
}

module.exports = { seedDemo };
