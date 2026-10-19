// Seeds the database with a sample KAN project. Run: node seed.js [--force]
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { UPLOAD_DIR } = require('./db');
const { hashPassword } = require('./auth');

function seed({ force = false } = {}) {
  const count = db.prepare('SELECT COUNT(*) c FROM issues').get().c;
  const hasPasswords = db.prepare('SELECT COUNT(*) c FROM users WHERE password_hash IS NOT NULL').get().c > 0;
  if (count > 0 && hasPasswords && !force) return false;

  // Keep people logged in across a demo-data reset: remember live sessions and API tokens,
  // then restore the ones whose user still exists after re-seeding.
  const nowIso = new Date().toISOString();
  const kept = {
    sessions: db.prepare('SELECT * FROM sessions WHERE expires_at > ?').all(nowIso),
    api_tokens: db.prepare('SELECT * FROM api_tokens WHERE expires_at IS NULL OR expires_at > ?').all(nowIso),
  };
  // OAuth provider credentials survive a reseed (they are real secrets entered by an admin)
  const keptOauth = db.prepare("SELECT value FROM site_settings WHERE key = 'oauth'").get();
  db.pragma('foreign_keys = OFF');
  db.exec('DELETE FROM webhook_deliveries; DELETE FROM webhooks; DELETE FROM automation_runs; DELETE FROM automation_rules; DELETE FROM votes; DELETE FROM worklogs;');
  db.exec(`DELETE FROM team_members; DELETE FROM teams; DELETE FROM trash; DELETE FROM components; DELETE FROM audit_log; DELETE FROM project_members; DELETE FROM site_settings;
    DELETE FROM email_verifications; DELETE FROM user_identities; DELETE FROM oauth_states; DELETE FROM subscription; DELETE FROM payment_methods; DELETE FROM invoices;
    DELETE FROM api_tokens; DELETE FROM project_stars; DELETE FROM versions; DELETE FROM dev_items; DELETE FROM sprints; DELETE FROM password_resets; DELETE FROM goal_issues; DELETE FROM goals; DELETE FROM forms; DELETE FROM filters;
    DELETE FROM notifications; DELETE FROM attachments; DELETE FROM issue_links; DELETE FROM watchers;
    DELETE FROM history; DELETE FROM comments; DELETE FROM issues; DELETE FROM sessions; DELETE FROM users; DELETE FROM projects;`);
  db.exec("DELETE FROM sqlite_sequence");
  db.pragma('foreign_keys = ON');
  for (const f of fs.readdirSync(UPLOAD_DIR)) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true, recursive: true });
  fs.mkdirSync(path.join(UPLOAD_DIR, "avatars"), { recursive: true });

  const users = [
    ['u1', 'Ahmed Al-Haddad', 'ahmed@ahdfinancial.com', '#0052CC', 'admin', 'Head of Finance Engineering'],
    ['u2', 'Sara Nasser', 'sara@ahdfinancial.com', '#6554C0', 'member', 'Senior Software Engineer'],
    ['u3', 'Omar Saleh', 'omar@ahdfinancial.com', '#00875A', 'member', 'Financial Controller'],
    ['u4', 'Layla Hassan', 'layla@ahdfinancial.com', '#FF5630', 'member', 'DevOps Engineer'],
    ['u5', 'Yusuf Karim', 'yusuf@ahdfinancial.com', '#FF991F', 'member', 'Payments Engineer'],
    ['u6', 'Mona Farouk', 'mona@ahdfinancial.com', '#00B8D9', 'member', 'Product Designer'],
    ['u7', 'Khalid Mansour', 'khalid@ahdfinancial.com', '#8777D9', 'member', 'External Auditor'],
  ];
  const pw = hashPassword(process.env.DEMO_PASSWORD || 'password');
  const insUser = db.prepare('INSERT INTO users (id,name,email,color,role,title,password_hash,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)');
  users.forEach((u) => insUser.run(...u, pw, new Date(Date.now() - 60 * 864e5).toISOString()));

  db.prepare('INSERT INTO projects (key,name,type,description,lead_id,next_num,color,category,created_at) VALUES (?,?,?,?,?,1,?,?,?)')
    .run('KAN', 'AHD Financial', 'software', 'Finance engineering work for AHD Financial: client portal, payments and regulatory reporting.', 'u1', '#FFAB00', 'Engineering', new Date(Date.now() - 90 * 864e5).toISOString());

  const today = new Date(); today.setUTCHours(9, 0, 0, 0);
  const daysAgo = (d, h = 0) => new Date(today.getTime() - d * 864e5 - h * 36e5).toISOString();
  const dateIn = (d) => new Date(today.getTime() + d * 864e5).toISOString().slice(0, 10);

  // [type, summary, status, priority, assignee, reporter, labels, dueOffset, points, parentIdx, createdDaysAgo, description]
  const data = [
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

  const insIssue = db.prepare(`INSERT INTO issues
    (key,num,project_key,type,summary,description,status,priority,assignee_id,reporter_id,parent_id,labels,due_date,start_date,story_points,sprint,rank,created_at,updated_at,resolved_at)
    VALUES (@key,@num,'KAN',@type,@summary,@description,@status,@priority,@assignee,@reporter,@parent,@labels,@due,@start,@points,@sprint,@rank,@created,@updated,@resolved)`);
  const insComment = db.prepare('INSERT INTO comments (issue_id,author_id,body,created_at,updated_at) VALUES (?,?,?,?,?)');
  const insHist = db.prepare('INSERT INTO history (issue_id,author_id,field,from_value,to_value,created_at) VALUES (?,?,?,?,?,?)');

  // Sprints 1–3 are closed (done work is spread across them), Sprint 4 is active, Sprint 5 is planned;
  // low-priority work stays in the backlog.
  let doneSeen = 0;
  const sprintFor = (type, status, priority) => {
    if (type === 'Epic') return null;
    if (status === 'Done') return `KAN Sprint ${1 + (doneSeen++ % 3)}`;
    if (status !== 'To Do' || ['Highest', 'High'].includes(priority)) return 'KAN Sprint 4';
    if (priority === 'Medium') return 'KAN Sprint 5';
    return null;
  };
  const insSprint = db.prepare('INSERT INTO sprints (project_key,name,goal,state,start_date,end_date,completed_at,position,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  insSprint.run('KAN', 'KAN Sprint 1', 'Stabilise KYC uploads before the August audit', 'closed', dateIn(-48), dateIn(-34), daysAgo(34), 0, daysAgo(50));
  insSprint.run('KAN', 'KAN Sprint 2', 'Payments reconciliation and certificate renewals', 'closed', dateIn(-34), dateIn(-20), daysAgo(20), 1, daysAgo(36));
  insSprint.run('KAN', 'KAN Sprint 3', 'Ship the KYC upload fixes and close out September reporting', 'closed', dateIn(-20), dateIn(-7), daysAgo(7), 2, daysAgo(22));
  insSprint.run('KAN', 'KAN Sprint 4', 'Launch the onboarding portal beta and start the gateway migration', 'active', dateIn(-6), dateIn(8), null, 3, daysAgo(8));
  insSprint.run('KAN', 'KAN Sprint 5', '', 'future', null, null, null, 4, daysAgo(2));

  const ids = [];
  const tx = db.transaction(() => {
    data.forEach((d, i) => {
      const [type, summary, status, priority, assignee, reporter, labels, due, points, parentIdx, created, description] = d;
      const num = i + 1;
      const createdAt = daysAgo(created, i % 7);
      const updatedAt = daysAgo(Math.max(0, Math.floor(created / 3)), (i * 3) % 11);
      const info = insIssue.run({
        key: `KAN-${num}`, num, type, summary, description, status, priority,
        assignee, reporter, parent: parentIdx == null ? null : ids[parentIdx],
        labels: JSON.stringify(labels), due: due == null ? null : dateIn(due), points,
        start: due == null ? null : type === 'Epic' ? dateIn(-created + 2) : dateIn(due - Math.max(3, Math.round((points || 2) * 1.5))),
        sprint: sprintFor(type, status, priority),
        rank: (num) * 1000 + ((i * 7919) % 1000) - 500 * (i % 3 === 0 ? 1 : 0) + (i % 5) * 37,
        created: createdAt, updated: updatedAt, resolved: status === 'Done' ? updatedAt : null,
      });
      ids.push(info.lastInsertRowid);
      insHist.run(info.lastInsertRowid, reporter, 'created', null, null, createdAt);
      if (status !== 'To Do') insHist.run(info.lastInsertRowid, assignee || reporter, 'status', 'To Do', status === 'Done' ? 'In Progress' : status, daysAgo(Math.floor(created / 2)));
      if (status === 'Done') insHist.run(info.lastInsertRowid, assignee || reporter, 'status', 'In Progress', 'Done', updatedAt);
    });
    db.prepare('UPDATE projects SET next_num=? WHERE key=?').run(data.length + 1, 'KAN');

    const comments = [
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
    comments.forEach(([idx, author, body, d]) => {
      const t = daysAgo(d, 2);
      insComment.run(ids[idx], author, body, t, t);
    });
  });
  tx();

  // normalise ranks so order is deterministic but slightly shuffled vs. key order
  const ordered = db.prepare('SELECT id FROM issues ORDER BY rank, id').all();
  const upd = db.prepare('UPDATE issues SET rank=? WHERE id=?');
  db.transaction(() => ordered.forEach((r, i) => upd.run((i + 1) * 1024, r.id)))();

  // ---------- watchers (reporter, assignee, commenters) ----------
  db.exec(`INSERT OR IGNORE INTO watchers (issue_id,user_id) SELECT id, reporter_id FROM issues WHERE reporter_id IS NOT NULL;
    INSERT OR IGNORE INTO watchers (issue_id,user_id) SELECT id, assignee_id FROM issues WHERE assignee_id IS NOT NULL;
    INSERT OR IGNORE INTO watchers (issue_id,user_id) SELECT issue_id, author_id FROM comments WHERE author_id IS NOT NULL;`);

  const t0 = daysAgo(5);
  // ---------- issue links ----------
  const insLink = db.prepare('INSERT INTO issue_links (source_id,target_id,type,created_by,created_at) VALUES (?,?,?,?,?)');
  [[13, 25, 'blocks', 'u5'], [6, 3, 'blocks', 'u2'], [26, 24, 'relates', 'u6'], [9, 10, 'blocks', 'u3'], [17, 7, 'relates', 'u3'], [21, 3, 'duplicates', 'u6'], [11, 18, 'relates', 'u1']]
    .forEach(([a, b, type, by]) => insLink.run(ids[a], ids[b], type, by, t0));

  // ---------- saved filters ----------
  const insFilter = db.prepare('INSERT INTO filters (name,description,jql,owner_id,starred,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
  insFilter.run('My open work', 'Everything assigned to me that is not done', 'project = KAN AND assignee = currentUser() AND status != Done ORDER BY priority DESC', 'u1', 1, t0, t0);
  insFilter.run('Payments incidents', 'Bugs and incidents for the payments platform', 'project = KAN AND labels in (payments, incident) AND type = Bug ORDER BY created DESC', 'u1', 1, t0, t0);
  insFilter.run('Overdue', 'Work items past their due date', 'project = KAN AND duedate < now() AND status != Done ORDER BY duedate ASC', 'u1', 0, t0, t0);
  insFilter.run('Unassigned backlog', '', 'project = KAN AND assignee IS EMPTY ORDER BY cf[10019] ASC', 'u2', 0, t0, t0);

  // ---------- goals ----------
  const insGoal = db.prepare('INSERT INTO goals (name,description,status,owner_id,target_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
  const insGoalIssue = db.prepare('INSERT INTO goal_issues (goal_id,issue_id) VALUES (?,?)');
  const g1 = insGoal.run('Launch self-service client onboarding', 'Cut new-client onboarding time from 5 days to under 1 day by moving KYC and agreements online.', 'on_track', 'u1', dateIn(45), daysAgo(40), daysAgo(3)).lastInsertRowid;
  const g2 = insGoal.run('File Q4 regulatory reports on time', 'Zero late or amended submissions to the regulator in Q4.', 'at_risk', 'u3', dateIn(60), daysAgo(40), daysAgo(1)).lastInsertRowid;
  const g3 = insGoal.run('Migrate 100% of card volume to the new gateway', 'Retire the legacy payment gateway before the contract renewal.', 'off_track', 'u2', dateIn(75), daysAgo(38), daysAgo(2)).lastInsertRowid;
  const g4 = insGoal.run('Pass the annual security audit', 'No high findings in the external audit.', 'pending', 'u4', dateIn(120), daysAgo(10), daysAgo(10)).lastInsertRowid;
  [[g1, 0], [g2, 1], [g3, 2], [g4, 16], [g4, 18], [g4, 15]].forEach(([g, i]) => insGoalIssue.run(g, ids[i]));

  // ---------- forms ----------
  const insForm = db.prepare('INSERT INTO forms (name,description,issue_type,fields,default_labels,default_assignee_id,active,submissions,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  insForm.run('Report a bug', 'Found something broken in the client portal or internal tools? Tell us here.', 'Bug', JSON.stringify(['summary', 'description', 'priority', 'dueDate']), JSON.stringify(['form', 'triage']), 'u2', 1, 4, 'u1', daysAgo(30), daysAgo(30));
  insForm.run('Finance data request', 'Request a report, export or reconciliation from the finance team.', 'Task', JSON.stringify(['summary', 'description', 'dueDate', 'labels']), JSON.stringify(['form', 'finance']), 'u3', 1, 2, 'u3', daysAgo(20), daysAgo(20));
  insForm.run('Access request', 'Ask for access to a finance system.', 'Task', JSON.stringify(['summary', 'description', 'priority']), JSON.stringify(['form', 'security']), 'u4', 0, 0, 'u4', daysAgo(8), daysAgo(8));

  // ---------- development (branches / commits / PRs) ----------
  const insDev = db.prepare('INSERT INTO dev_items (issue_id,kind,repo,name,ref,status,author_id,created_at) VALUES (?,?,?,?,?,?,?,?)');
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
  dev.forEach(([i, kind, repo, name, ref, status, a, d]) => insDev.run(ids[i], kind, repo, name, ref, status, a, daysAgo(d, 3)));

  // ---------- notifications for the admin user ----------
  const insN = db.prepare('INSERT INTO notifications (user_id,actor_id,issue_id,type,message,read,created_at) VALUES (?,?,?,?,?,?,?)');
  insN.run('u1', 'u5', ids[13], 'comment', 'commented on KAN-14: “Working on idempotency keys now.”', 0, daysAgo(0, 2));
  insN.run('u1', 'u4', ids[16], 'status', 'changed KAN-17 to In Review', 0, daysAgo(1));
  insN.run('u1', 'u3', ids[26], 'assigned', 'mentioned you on KAN-27', 1, daysAgo(2));
  insN.run('u1', 'u2', ids[6], 'comment', 'commented on KAN-7: “Root cause is the nginx client_max_body_size.”', 1, daysAgo(2, 4));

  seedPhase4({ ids, daysAgo, dateIn, insHist });
  seedPhase5({ daysAgo, keptOauth });
  seedPhase7({ daysAgo });
  restoreLogins(kept);
  return true;
}

function restoreLogins(kept) {
  const userExists = db.prepare('SELECT 1 FROM users WHERE id = ? AND active = 1');
  for (const [table, rows] of Object.entries(kept)) {
    for (const row of rows) {
      if (!userExists.get(row.user_id)) continue;
      const cols = Object.keys(row);
      db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`).run(row);
    }
  }
}

// ---------- releases, sprint carry-over history, velocity numbers and extra projects ----------
function seedPhase4({ ids, daysAgo, dateIn, insHist }) {

  // Carry-over: some current Sprint 4 work started in earlier sprints and was moved on at completion.
  const carried = db.prepare("SELECT id, story_points FROM issues WHERE sprint = 'KAN Sprint 4' AND status != 'To Do' AND story_points <= 2 ORDER BY rank").all();
  const chain = [['KAN Sprint 2', 'KAN Sprint 3', 20], ['KAN Sprint 3', 'KAN Sprint 4', 7]];
  carried.slice(0, 3).forEach((it, n) => {
    const steps = n === 0 ? chain : [chain[1]];
    steps.forEach(([from, to, d]) => insHist.run(it.id, 'u1', 'sprint', from, to, daysAgo(d)));
  });
  carried.slice(3, 4).forEach((it) => insHist.run(it.id, 'u1', 'sprint', 'KAN Sprint 1', 'KAN Sprint 2', daysAgo(34)));
  carried.slice(3, 4).forEach((it) => insHist.run(it.id, 'u1', 'sprint', 'KAN Sprint 2', 'KAN Sprint 4', daysAgo(8)));
  // Finished work gets realistic estimates so velocity is comparable with the active sprint's commitment.
  const est = [8, 5, 8, 13, 5, 8, 5, 3];
  db.prepare("SELECT id FROM issues WHERE project_key = 'KAN' AND status = 'Done' AND type != 'Epic' ORDER BY id").all()
    .forEach((x, i) => db.prepare('UPDATE issues SET story_points = ? WHERE id = ?').run(est[i % est.length], x.id));
  // Velocity numbers for closed sprints, and the commitment of the active sprint.
  for (const s of db.prepare("SELECT * FROM sprints WHERE project_key = 'KAN' AND state != 'future'").all()) {
    const done = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(story_points),0) p FROM issues WHERE sprint = ? AND status = 'Done' AND type != 'Epic'").get(s.name);
    const cur = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(story_points),0) p FROM issues WHERE sprint = ? AND type != 'Epic'").get(s.name);
    const out = db.prepare("SELECT COUNT(DISTINCT i.id) c, COALESCE(SUM(i.story_points),0) p FROM history h JOIN issues i ON i.id = h.issue_id WHERE h.field = 'sprint' AND h.from_value = ?").get(s.name);
    if (s.state === 'closed') {
      db.prepare('UPDATE sprints SET committed_points = ?, committed_count = ?, completed_points = ?, completed_count = ? WHERE id = ?')
        .run(cur.p + out.p, cur.c + out.c, done.p, done.c, s.id);
    } else {
      db.prepare('UPDATE sprints SET committed_points = ?, committed_count = ? WHERE id = ?').run(cur.p, cur.c, s.id);
    }
  }

  // Releases
  const insV = db.prepare('INSERT INTO versions (project_key,name,description,status,start_date,release_date,released_at,position,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
  insV.run('KAN', '1.1.0', 'Portal hardening and audit fixes', 'archived', dateIn(-60), dateIn(-40), daysAgo(40), 0, daysAgo(70));
  insV.run('KAN', '1.2.0', 'KYC uploads, certificates and September reporting', 'released', dateIn(-40), dateIn(-7), daysAgo(7), 1, daysAgo(45));
  insV.run('KAN', '1.3.0', 'Client onboarding portal beta', 'unreleased', dateIn(-7), dateIn(8), null, 2, daysAgo(10));
  insV.run('KAN', '1.4.0', 'Payments gateway migration', 'unreleased', dateIn(8), dateIn(36), null, 3, daysAgo(3));
  db.exec(`UPDATE issues SET fix_version = '1.2.0' WHERE project_key = 'KAN' AND status = 'Done' AND type != 'Epic';
    UPDATE issues SET fix_version = '1.3.0' WHERE project_key = 'KAN' AND sprint = 'KAN Sprint 4' AND type != 'Epic';
    UPDATE issues SET fix_version = '1.4.0' WHERE project_key = 'KAN' AND sprint = 'KAN Sprint 5' AND type != 'Epic';`);
  // one finished item shipped late in 1.3.0 so its progress bar is not empty
  const lateDone = db.prepare("SELECT id FROM issues WHERE project_key = 'KAN' AND status = 'Done' AND type != 'Epic' ORDER BY resolved_at DESC LIMIT 1").get();
  if (lateDone) db.prepare("UPDATE issues SET fix_version = '1.3.0' WHERE id = ?").run(lateDone.id);


  // Extra projects
  const insP = db.prepare('INSERT INTO projects (key,name,type,description,lead_id,next_num,color,category,created_at) VALUES (?,?,?,?,?,1,?,?,?)');
  insP.run('PAY', 'Payments Platform', 'software', 'Card processing, payouts and the new payment gateway.', 'u5', '#0C66E4', 'Engineering', daysAgo(40));
  insP.run('FIN', 'Finance Close', 'business', 'Month-end close, reconciliations and audit requests.', 'u3', '#22A06B', 'Finance', daysAgo(30));
  const ins = db.prepare(`INSERT INTO issues (key,num,project_key,type,summary,description,status,priority,assignee_id,reporter_id,labels,due_date,story_points,sprint,fix_version,rank,created_at,updated_at,resolved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let rank = (db.prepare('SELECT MAX(rank) m FROM issues').get().m || 0) + 1024;
  const add = (P, list) => list.forEach(([type, summary, status, priority, a, pts, sprint, ver, due, created], i) => {
    const t = daysAgo(created); const u = daysAgo(Math.floor(created / 2));
    const info = ins.run(`${P}-${i + 1}`, i + 1, P, type, summary, '', status, priority, a, 'u1', JSON.stringify([]), due == null ? null : dateIn(due), pts, sprint, ver, rank += 1024, t, u, status === 'Done' ? u : null);
    insHist.run(info.lastInsertRowid, 'u1', 'created', null, null, t);
    if (status !== 'To Do') insHist.run(info.lastInsertRowid, a || 'u1', 'status', 'To Do', status === 'Done' ? 'In Progress' : status, daysAgo(Math.floor(created * 0.7)));
    if (status === 'Done') insHist.run(info.lastInsertRowid, a || 'u1', 'status', 'In Progress', 'Done', u);
    db.prepare('UPDATE projects SET next_num = ? WHERE key = ?').run(i + 2, P);
  });
  const insSprint = db.prepare('INSERT INTO sprints (project_key,name,goal,state,start_date,end_date,completed_at,position,created_at,committed_points,committed_count,completed_points,completed_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  insSprint.run('PAY', 'PAY Sprint 1', 'Gateway sandbox integration', 'closed', dateIn(-17), dateIn(-3), daysAgo(3), 10, daysAgo(18), 13, 3, 8, 2);
  insSprint.run('PAY', 'PAY Sprint 2', 'Go live with card payments on the new gateway', 'active', dateIn(-3), dateIn(11), null, 11, daysAgo(4), 21, 5, null, null);
  insSprint.run('PAY', 'PAY Sprint 3', '', 'future', null, null, null, 12, daysAgo(1), null, null, null, null);
  insV.run('PAY', '2026.10', 'October gateway launch', 'unreleased', dateIn(-10), dateIn(12), null, 0, daysAgo(12));
  add('PAY', [
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
  ]);
  // FIN is a business project: no sprints, just a list/board of tasks.
  add('FIN', [
    ['Task', 'October bank reconciliations', 'In Progress', 'High', 'u3', null, null, null, 5, 6],
    ['Task', 'Accruals review with department heads', 'To Do', 'Medium', 'u3', null, null, null, 9, 4],
    ['Task', 'Prepare auditor PBC list', 'To Do', 'High', 'u1', null, null, null, 14, 3],
    ['Task', 'September close sign-off', 'Done', 'Highest', 'u1', null, null, null, -12, 20],
    ['Bug', 'FX revaluation posts to the wrong ledger', 'In Review', 'High', 'u2', null, null, null, 3, 5],
    ['Task', 'Update chart of accounts for new entity', 'To Do', 'Low', null, null, null, null, null, 2],
  ]);
  const insForm = db.prepare('INSERT INTO forms (name,description,issue_type,fields,default_labels,default_assignee_id,active,submissions,created_by,created_at,updated_at,project_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  insForm.run('Expense report query', 'Questions about an expense claim or reimbursement.', 'Task', JSON.stringify(['summary', 'description', 'dueDate']), JSON.stringify(['form', 'expenses']), 'u3', 1, 1, 'u3', daysAgo(15), daysAgo(15), 'FIN');
  const star = db.prepare('INSERT INTO project_stars (user_id,project_key) VALUES (?,?)');
  ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].forEach((u) => star.run(u, 'KAN'));
  star.run('u5', 'PAY'); star.run('u3', 'FIN');
}

// Phase 5: roles & access levels, components, teams, a recycle-bin item and some audit history.
function seedPhase5({ daysAgo, keptOauth }) {
  const t = (d) => daysAgo(d);
  // KAN: limited (everyone can view & comment, members edit) · PAY: open · FIN: private
  db.prepare("UPDATE projects SET access = 'limited' WHERE key = 'KAN'").run();
  db.prepare("UPDATE projects SET access = 'open' WHERE key = 'PAY'").run();
  db.prepare("UPDATE projects SET access = 'private' WHERE key = 'FIN'").run();
  const mem = db.prepare('INSERT INTO project_members (project_key,user_id,role,added_by,added_at) VALUES (?,?,?,?,?)');
  [['u2', 'admin'], ['u3', 'member'], ['u4', 'member'], ['u5', 'member'], ['u6', 'member']].forEach(([u, r]) => mem.run('KAN', u, r, 'u1', t(80)));
  [['u2', 'member'], ['u4', 'member'], ['u6', 'viewer']].forEach(([u, r]) => mem.run('PAY', u, r, 'u5', t(40)));
  [['u1', 'admin'], ['u6', 'member']].forEach(([u, r]) => mem.run('FIN', u, r, 'u3', t(30)));
  // u7 Khalid is an external auditor: viewer in KAN through the access level, explicit viewer in FIN
  mem.run('FIN', 'u7', 'viewer', 'u3', t(10));
  db.prepare("UPDATE projects SET board_config = ? WHERE key = 'KAN'").run(JSON.stringify({ wip: { 'In Progress': 6, 'In Review': 3 }, swimlanes: 'none' }));

  // components
  const comp = db.prepare('INSERT INTO components (project_key,name,description,lead_id,default_assignee,created_at) VALUES (?,?,?,?,?,?)');
  comp.run('KAN', 'Client Portal', 'Customer-facing onboarding and self-service portal.', 'u2', 'component_lead', t(70));
  comp.run('KAN', 'Payments', 'Card processing, refunds and the new gateway.', 'u5', 'component_lead', t(70));
  comp.run('KAN', 'Reporting', 'Regulatory and management reporting.', 'u3', 'component_lead', t(70));
  comp.run('KAN', 'Infrastructure', 'Environments, CI/CD and observability.', 'u4', 'unassigned', t(60));
  comp.run('PAY', 'Gateway', 'Integration with the new payment gateway.', 'u5', 'component_lead', t(40));
  comp.run('PAY', 'Payouts', 'Merchant payouts and reconciliation.', 'u3', 'project_lead', t(40));
  const rules = [
    ['KAN', /portal|onboarding|kyc|e-sign|upload|sso|wizard|session/i, 'Client Portal'],
    ['KAN', /payment|refund|gateway|card|aml/i, 'Payments'],
    ['KAN', /report|capital|trial balance|dashboard|board meeting|regulatory/i, 'Reporting'],
    ['KAN', /load-test|runbook|sandbox|nginx|server|deploy|monitor/i, 'Infrastructure'],
    ['PAY', /gateway|webhook|decline|wallet|checkout|load test|cut-over/i, 'Gateway'],
    ['PAY', /payout|refund|reconciliation/i, 'Payouts'],
  ];
  const up = db.prepare('UPDATE issues SET components = ? WHERE id = ?');
  for (const row of db.prepare("SELECT id, project_key, summary FROM issues WHERE project_key IN ('KAN','PAY')").all()) {
    const list = rules.filter(([pk, re]) => pk === row.project_key && re.test(row.summary)).map((x) => x[2]);
    if (list.length) up.run(JSON.stringify([...new Set(list)].slice(0, 2)), row.id);
  }

  // teams
  const team = db.prepare('INSERT INTO teams (name,description,color,created_by,created_at) VALUES (?,?,?,?,?)');
  const tm = db.prepare('INSERT INTO team_members (team_id,user_id) VALUES (?,?)');
  const platform = team.run('Platform', 'Portal, infrastructure and developer experience.', '#0C66E4', 'u1', t(75)).lastInsertRowid;
  const payments = team.run('Payments Squad', 'Gateway migration, refunds and payouts.', '#E2483D', 'u5', t(45)).lastInsertRowid;
  const finops = team.run('Finance Ops', 'Month-end close, reconciliations and reporting.', '#22A06B', 'u3', t(35)).lastInsertRowid;
  ['u1', 'u2', 'u4', 'u6'].forEach((u) => tm.run(platform, u));
  ['u5', 'u2'].forEach((u) => tm.run(payments, u));
  ['u3', 'u1'].forEach((u) => tm.run(finops, u));
  const setTeam = db.prepare('UPDATE issues SET team_id = ? WHERE id = ?');
  for (const row of db.prepare('SELECT id, project_key, components FROM issues').all()) {
    const c = JSON.parse(row.components || '[]');
    if (row.project_key === 'FIN' || c.includes('Reporting')) setTeam.run(finops, row.id);
    else if (row.project_key === 'PAY' || c.includes('Payments')) setTeam.run(payments, row.id);
    else if (c.includes('Client Portal') || c.includes('Infrastructure')) setTeam.run(platform, row.id);
  }

  // one item already in the recycle bin
  const { createIssue } = require('./lib');
  const { moveToTrash } = require('./trash');
  const spike = createIssue({ projectKey: 'KAN', type: 'Task', summary: 'Spike: evaluate PDF rendering libraries', description: 'Superseded by the e-sign vendor decision.', assigneeId: 'u6', labels: ['spike'] }, 'u2');
  moveToTrash(db.prepare('SELECT * FROM issues WHERE key = ?').get(spike.key), 'u2');
  db.prepare('UPDATE trash SET deleted_at = ? WHERE issue_key = ?').run(t(3), spike.key);

  // audit history
  const au = db.prepare('INSERT INTO audit_log (actor_id,action,project_key,target,details,created_at) VALUES (?,?,?,?,?,?)');
  au.run('u1', 'project.created', 'KAN', 'KAN', JSON.stringify({ name: 'AHD Financial', type: 'software' }), t(90));
  au.run('u5', 'project.created', 'PAY', 'PAY', JSON.stringify({ name: 'Payments Platform', type: 'software' }), t(45));
  au.run('u3', 'project.created', 'FIN', 'FIN', JSON.stringify({ name: 'Finance Close', type: 'business' }), t(35));
  au.run('u3', 'project.access_changed', 'FIN', 'FIN', JSON.stringify({ access: { from: 'open', to: 'private' } }), t(34));
  au.run('u1', 'project.access_changed', 'KAN', 'KAN', JSON.stringify({ access: { from: 'open', to: 'limited' } }), t(20));
  au.run('u1', 'member.role_changed', 'KAN', 'Sara Nasser', JSON.stringify({ userId: 'u2', from: 'member', to: 'admin' }), t(19));
  au.run('u5', 'member.role_changed', 'PAY', 'Mona Farouk', JSON.stringify({ userId: 'u6', from: null, to: 'viewer' }), t(15));
  au.run('u3', 'member.added', 'FIN', 'Khalid Mansour', JSON.stringify({ userId: 'u7', role: 'viewer' }), t(10));
  au.run('u1', 'user.invited', null, 'Khalid Mansour', JSON.stringify({ userId: 'u7', email: 'khalid@ahdfinancial.com', role: 'member' }), t(10));
  au.run('u2', 'issue.deleted', 'KAN', spike.key, JSON.stringify({ summary: 'Spike: evaluate PDF rendering libraries' }), t(3));

  // ---------- phase 6: site settings, subscription (Premium monthly), card and invoice history ----------
  if (keptOauth) db.prepare("INSERT INTO site_settings (key,value) VALUES ('oauth', ?)").run(keptOauth.value);
  db.prepare("INSERT INTO site_settings (key,value) VALUES ('site', ?)").run(JSON.stringify({ signup: 'open', allowedDomains: ['ahdfinancial.com'] }));
  db.prepare("UPDATE users SET signup_source = 'seed', email_verified = 1").run();
  const B = require('./billing');
  const monthsBack = (iso, n) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString(); };
  const start = t(10);
  const seats = db.prepare('SELECT COUNT(*) c FROM users WHERE active = 1').get().c;
  db.prepare('INSERT INTO payment_methods (brand,last4,exp_month,exp_year,holder,is_default,created_at) VALUES (?,?,?,?,?,1,?)')
    .run('Visa', '4242', 8, new Date().getUTCFullYear() + 3, 'Ahmed Al-Haddad', monthsBack(start, 2));
  const card = 'Visa •••• 4242';
  for (const [n, plan] of [[2, 'standard'], [1, 'standard'], [0, 'premium']]) {
    const ps = monthsBack(start, n);
    const unit = B.PLANS[plan].price.monthly;
    B.createInvoice({ created: ps, periodStart: ps, periodEnd: B.addCycle(ps, 'monthly'), plan, cycle: 'monthly', seats,
      lines: [{ description: `${B.PLANS[plan].name} plan (monthly) – ${seats} users × ${B.money(unit)}`, amount: unit * seats }], status: 'paid', card });
  }
  db.prepare(`INSERT INTO subscription (id,plan,cycle,status,trial_used,current_period_start,current_period_end,cancel_at_period_end,billing_email,company,updated_at)
    VALUES (1,'premium','monthly','active',1,?,?,0,'billing@ahdfinancial.com','AHD Financial',?)`).run(start, B.addCycle(start, 'monthly'), start);
  au.run('u1', 'billing.plan_changed', null, 'Premium', JSON.stringify({ from: 'standard', to: 'premium', cycle: 'monthly' }), start);
  B.invalidate();
}

// ---------- phase 7: estimates + worklogs, votes, automation rules, a sample webhook ----------
function seedPhase7({ daysAgo }) {
  db.ensureBot();
  const TF = require('./timefmt');
  const H = 3600;
  const iss = db.prepare("SELECT * FROM issues WHERE project_key = 'KAN' AND type != 'Epic' ORDER BY num").all();
  const insW = db.prepare('INSERT INTO worklogs (issue_id,author_id,started_at,time_spent,comment,created_at,updated_at) VALUES (?,?,?,?,?,?,?)');
  const setT = db.prepare('UPDATE issues SET original_estimate = ?, remaining_estimate = ?, time_spent = ? WHERE id = ?');
  const insHist = db.prepare('INSERT INTO history (issue_id,author_id,field,from_value,to_value,created_at) VALUES (?,?,?,?,?,?)');
  const notes = ['Implementation', 'Code review fixes', 'Pairing session', 'Investigated root cause', 'Wrote tests', 'Updated documentation', 'Deployed to staging', ''];
  const at = (d, hour) => { const x = new Date(daysAgo(d)); x.setUTCHours(hour, 0, 0, 0); return x.toISOString(); };
  iss.forEach((i, n) => {
    if (i.story_points == null && n % 3 === 2) return; // a few items stay unestimated
    const orig = Math.max(1, Math.round((i.story_points || 2) * 4)) * H;
    let spent = 0;
    const who = i.assignee_id;
    if (who && i.status !== 'To Do') {
      const logs = i.status === 'Done' ? 3 : i.status === 'In Review' ? 2 : 1 + (n % 2);
      for (let k = 0; k < logs; k++) {
        const sec = ((n + k) % 4 + 1) * H + (k % 2 ? 30 * 60 : 0);
        const started = at(1 + ((n * 2 + k * 3) % 12), 6 + ((n + k) % 7));
        insW.run(i.id, who, started, sec, notes[(n + k) % notes.length], started, started);
        spent += sec;
      }
    }
    const remaining = i.status === 'Done' ? 0 : Math.max(0, orig - spent);
    setT.run(orig, remaining, spent, i.id);
    insHist.run(i.id, i.reporter_id, 'original estimate', null, TF.formatDuration(orig), i.created_at);
  });
  // a couple of PAY items with estimates too
  db.prepare("SELECT id, story_points FROM issues WHERE project_key = 'PAY' AND story_points IS NOT NULL").all()
    .forEach((i) => setT.run(i.story_points * 4 * H, i.story_points * 4 * H, 0, i.id));

  // votes (never by the reporter, never on done work)
  const insV = db.prepare('INSERT OR IGNORE INTO votes (issue_id,user_id,created_at) VALUES (?,?,?)');
  const voters = ['u2', 'u3', 'u4', 'u5', 'u6'];
  iss.filter((i) => i.status !== 'Done').slice(0, 12).forEach((i, n) => {
    voters.slice(0, (n % 4) + 1).forEach((u, k) => { if (u !== i.reporter_id) insV.run(i.id, u, daysAgo(2 + k + (n % 5))); });
  });

  // automation rules for KAN, with a little run history
  const t0 = daysAgo(20);
  const insR = db.prepare('INSERT INTO automation_rules (project_key,name,description,enabled,trigger,condition,actions,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const r1 = insR.run('KAN', 'Assign new bugs using balanced workload', 'Spreads incoming bugs across the team.', 1,
    JSON.stringify({ type: 'issue_created' }), 'type = Bug AND assignee IS EMPTY',
    JSON.stringify([{ type: 'assign', to: 'balanced' }, { type: 'comment', body: 'Assigned to {{issue.assignee.displayName}} automatically (balanced workload).' }]), 'u2', t0, t0).lastInsertRowid;
  const r2 = insR.run('KAN', 'Label urgent work when priority becomes Highest', '', 1,
    JSON.stringify({ type: 'field_changed', field: 'priority' }), 'priority = Highest',
    JSON.stringify([{ type: 'add_label', label: 'urgent' }, { type: 'add_watcher', userId: 'u2' }]), 'u2', t0, t0).lastInsertRowid;
  const r3 = insR.run('KAN', 'When work moves to In Review, comment for the reporter', '', 0,
    JSON.stringify({ type: 'issue_transitioned', to: 'In Review' }), '',
    JSON.stringify([{ type: 'comment', body: '{{issue.key}} is ready for review, {{issue.reporter.displayName}}.' }]), 'u1', t0, t0).lastInsertRowid;
  const insRun = db.prepare('INSERT INTO automation_runs (rule_id,issue_key,status,message,actions,duration_ms,created_at) VALUES (?,?,?,?,?,?,?)');
  insRun.run(r1, 'KAN-27', 'success', 'Assign work item: Assigned to Layla Hassan · Comment on work item: Comment added', JSON.stringify([{ type: 'assign', ok: true, detail: 'Assigned to Layla Hassan' }, { type: 'comment', ok: true, detail: 'Comment added' }]), 41, daysAgo(6));
  insRun.run(r1, 'KAN-29', 'no_actions', 'The work item didn’t match the rule’s condition.', '[]', 6, daysAgo(4));
  insRun.run(r2, 'KAN-12', 'success', 'Add label: Added label urgent · Add watcher: Added Sara Nasser as a watcher', JSON.stringify([{ type: 'add_label', ok: true, detail: 'Added label urgent' }, { type: 'add_watcher', ok: true, detail: 'Added Sara Nasser as a watcher' }]), 23, daysAgo(2));
  insRun.run(r3, 'KAN-8', 'success', 'Comment on work item: Comment added', JSON.stringify([{ type: 'comment', ok: true, detail: 'Comment added' }]), 18, daysAgo(9));

  // a disabled example webhook (point it at your own endpoint and enable it)
  db.prepare('INSERT INTO webhooks (name,url,secret,events,jql,enabled,created_by,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?,?)')
    .run('Finance data warehouse sync', 'https://hooks.example.com/masar/issues', 'change-me', JSON.stringify(['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted']), 'project = KAN', 'u1', daysAgo(15), daysAgo(15));
}

module.exports = seed;

if (require.main === module) {
  seed({ force: process.argv.includes('--force') });
  console.log('Seeded database.');
}
