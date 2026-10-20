/**
 * Cloudflare Pages Function: Universal Edge API Gateway for Jira Nexus
 * Backed by Cloudflare D1 Serverless SQL Database (binding: env.DB)
 * Runs natively on Cloudflare global edge network with 0 latency, 0 cold starts,
 * and ZERO redirects to external hosts.
 */

import crypto from 'node:crypto';

// --- Utilities ---
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private, max-age=0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-JC-Auth, X-Client-Id',
      ...headers,
    },
  });
}

function error(message, status = 400, extra = {}) {
  return json({ error: message, status, ...extra }, status);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const p = part.trim();
    const i = p.indexOf('=');
    if (i < 1) continue;
    try {
      out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function safeJson(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// --- Password Hashing (compatible with api/auth.js scrypt format salt:hash) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.includes(':')) {
    // Plain text or legacy fallback
    return password === stored;
  }
  const [salt, hash] = stored.split(':');
  try {
    const test = crypto.scryptSync(String(password), salt, 32);
    const known = Buffer.from(hash, 'hex');
    return known.length === test.length && crypto.timingSafeEqual(known, test);
  } catch {
    return false;
  }
}

// --- D1 Database Wrapper ---
function createDb(d1) {
  return {
    async get(sql, ...params) {
      return await d1.prepare(sql).bind(...params).first();
    },
    async all(sql, ...params) {
      const res = await d1.prepare(sql).bind(...params).all();
      return res.results || [];
    },
    async run(sql, ...params) {
      return await d1.prepare(sql).bind(...params).run();
    },
  };
}

// --- User Authentication Middleware ---
async function getAuthUser(request, db) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('X-JC-Auth') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  if (!token) {
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    token = cookies.jc_session || '';
  }

  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get('access_token') || '';
  }

  if (!token) return null;

  const row = await db.get(
    `SELECT s.token, s.expires_at, u.id, u.name, u.email, u.color, u.role, u.title, u.active, u.prefs
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`,
    token
  );

  if (!row || !row.active) return null;

  // Touch session asynchronously
  db.run(`UPDATE sessions SET last_seen_at = datetime('now') WHERE token = ?`, token).catch(() => {});

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    color: row.color,
    role: row.role,
    title: row.title,
    active: Boolean(row.active),
    prefs: safeJson(row.prefs, {}),
    token,
  };
}

// --- Issue Formatter (matches api/lib.js toIssue) ---
function toIssue(r) {
  if (!r) return null;
  return {
    id: r.id,
    key: r.key,
    project: r.project_key,
    type: r.type,
    summary: r.summary,
    description: r.description || '',
    status: r.status,
    priority: r.priority,
    assigneeId: r.assignee_id,
    reporterId: r.reporter_id,
    parent: r.parent_key ? { key: r.parent_key, summary: r.parent_summary, type: r.parent_type } : null,
    labels: safeJson(r.labels, []),
    dueDate: r.due_date,
    startDate: r.start_date,
    storyPoints: r.story_points,
    sprint: r.sprint,
    fixVersion: r.fix_version || null,
    rank: r.rank,
    components: safeJson(r.components, []),
    teamId: r.team_id ?? null,
    created: r.created_at,
    updated: r.updated_at,
    resolved: r.resolved_at,
    commentCount: r.comment_count || 0,
    childCount: r.child_count || 0,
    childDone: r.child_done || 0,
    attachmentCount: r.attachment_count || 0,
    linkCount: r.link_count || 0,
    votes: r.vote_count || 0,
    originalEstimate: r.original_estimate ?? null,
    remainingEstimate: r.remaining_estimate ?? null,
    timeSpent: r.time_spent || 0,
  };
}

const ISSUE_SELECT = `
  SELECT i.*, p.key AS parent_key, p.summary AS parent_summary, p.type AS parent_type,
    (SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id) AS comment_count,
    (SELECT COUNT(*) FROM issues ch WHERE ch.parent_id = i.id) AS child_count,
    (SELECT COUNT(*) FROM issues ch WHERE ch.parent_id = i.id AND ch.status = 'Done') AS child_done,
    (SELECT COUNT(*) FROM attachments a WHERE a.issue_id = i.id) AS attachment_count,
    (SELECT COUNT(*) FROM issue_links l WHERE l.source_id = i.id OR l.target_id = i.id) AS link_count,
    (SELECT COUNT(*) FROM votes v WHERE v.issue_id = i.id) AS vote_count
  FROM issues i
  LEFT JOIN issues p ON p.id = i.parent_id
`;

// --- Main Handler ---
export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-JC-Auth, X-Client-Id',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const d1 = env.DB;
  if (!d1) {
    return error('Cloudflare D1 Database binding "DB" is not configured.', 500);
  }

  const db = createDb(d1);
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  // Parse path segments after /api
  // e.g. /api/auth/login -> ['auth', 'login']
  const apiPrefix = '/api';
  let path = pathname.startsWith(apiPrefix) ? pathname.slice(apiPrefix.length) : pathname;
  if (!path.startsWith('/')) path = '/' + path;

  // 1. Health & Config (Public)
  if (path === '/health' && method === 'GET') {
    return json({
      ok: true,
      status: 'healthy',
      database: 'cloudflare-d1',
      edge: 'cloudflare-pages',
      time: new Date().toISOString(),
    });
  }

  if (path === '/auth/config' && method === 'GET') {
    return json({
      oauth: {},
      allowSignup: true,
      enterpriseSSO: false,
    });
  }

  if (path === '/plans' && method === 'GET') {
    return json({
      plans: [
        { id: 'free', name: 'Free', price: 0, interval: 'month' },
        { id: 'standard', name: 'Standard', price: 10, interval: 'month' },
        { id: 'premium', name: 'Premium', price: 20, interval: 'month' },
      ],
    });
  }

  // 2. Auth: Login
  if (path === '/auth/login' && method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('Invalid JSON payload');
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return error('Enter your email and password.');

    const user = await db.get(`SELECT * FROM users WHERE lower(email) = lower(?)`, email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return error('Incorrect email address and / or password.', 401);
    }

    if (!user.active) {
      return error('Your account has been deactivated. Contact an administrator.', 403);
    }

    const remember = body.remember !== false;
    const days = remember ? 14 : 1;
    const expiresAt = new Date(Date.now() + days * 864e5).toISOString();
    const token = 's_' + crypto.randomBytes(24).toString('hex');
    const userAgent = request.headers.get('User-Agent') || '';

    await db.run(
      `INSERT INTO sessions (token, user_id, user_agent, remember, created_at, expires_at)
       VALUES (?, ?, ?, ?, datetime('now'), ?)`,
      token,
      user.id,
      userAgent,
      remember ? 1 : 0,
      expiresAt
    );

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      color: user.color,
      role: user.role,
      title: user.title,
      active: true,
    };

    const cookieHeader = `jc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}; Secure`;

    return json(
      {
        ok: true,
        user: publicUser,
        token,
        expiresAt,
        remember,
      },
      200,
      { 'Set-Cookie': cookieHeader }
    );
  }

  // Require Authenticated User for Remaining Protected Endpoints
  const user = await getAuthUser(request, db);

  // 3. Auth: Current User Profile
  if (path === '/auth/me' && method === 'GET') {
    if (!user) return error('Not authenticated', 401);
    return json({ ok: true, user });
  }

  if (path === '/auth/me/preferences') {
    if (!user) return error('Not authenticated', 401);
    if (method === 'GET') {
      return json(user.prefs || {});
    }
    if (method === 'PATCH') {
      let body = {};
      try {
        body = await request.json();
      } catch {}
      const merged = { ...user.prefs, ...body };
      await db.run(`UPDATE users SET prefs = ? WHERE id = ?`, JSON.stringify(merged), user.id);
      return json(merged);
    }
  }

  // 4. Auth: Logout
  if (path === '/auth/logout' && method === 'POST') {
    if (user?.token) {
      await db.run(`DELETE FROM sessions WHERE token = ?`, user.token);
    }
    return json({ ok: true }, 200, {
      'Set-Cookie': 'jc_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax',
    });
  }

  if (!user) {
    return error('Not authenticated', 401);
  }

  // 5. Workspace Metadata (/api/meta)
  if (path === '/meta' && method === 'GET') {
    const projects = await db.all(`SELECT * FROM projects ORDER BY name`);
    const users = await db.all(`SELECT id, name, email, color, role, title, active FROM users ORDER BY name`);
    const wantedKey = (url.searchParams.get('project') || '').toUpperCase();
    const project = projects.find((p) => p.key === wantedKey) || projects.find((p) => p.key === 'KAN') || projects[0] || null;

    const PK = project?.key || 'KAN';
    const components = await db.all(`SELECT id, name, lead_id AS leadId FROM components WHERE project_key = ? ORDER BY name`, PK);
    const sprints = await db.all(`SELECT id, name, goal, state, start_date AS startDate, end_date AS endDate, position FROM sprints WHERE project_key = ? ORDER BY position, id`, PK);
    const activeSprint = sprints.find((s) => s.state === 'active') || null;
    const versions = await db.all(`SELECT id, name, status, release_date AS releaseDate FROM versions WHERE project_key = ? ORDER BY position, id`, PK);
    const teams = await db.all(`SELECT id, name, color FROM teams ORDER BY name`);

    const defaultPermissions = [
      'ADMIN',
      'ADMINISTER_PROJECT',
      'BROWSE_PROJECT',
      'CREATE_ISSUES',
      'EDIT_ISSUES',
      'TRANSITION_ISSUES',
      'ASSIGN_ISSUES',
      'LINK_ISSUES',
      'DELETE_ISSUES',
      'ADD_COMMENTS',
      'CREATE_ATTACHMENTS',
      'MANAGE_SPRINTS',
      'MANAGE_VERSIONS',
      'WORK_ON_ISSUES',
    ];

    return json({
      project,
      projects: projects.map((p) => ({
        ...p,
        starred: false,
        myRole: user.role === 'admin' ? 'admin' : 'member',
        canCreate: true,
        permissions: defaultPermissions,
      })),
      versions,
      users,
      currentUserId: user.id,
      currentUser: user,
      myRole: user.role === 'admin' ? 'admin' : 'member',
      myRoleLabel: user.role === 'admin' ? 'Administrator' : 'Member',
      permissions: defaultPermissions,
      components,
      teams,
      globalPermissions: ['ADMIN'],
      statuses: ['To Do', 'In Progress', 'In Review', 'Done'],
      priorities: ['Highest', 'High', 'Medium', 'Low', 'Lowest'],
      types: ['Epic', 'Story', 'Task', 'Bug', 'Subtask'],
      labels: [],
      sprints: sprints.map((s) => s.name),
      activeSprint,
      repos: [],
      linkTypes: [
        { id: 'blocks', outward: 'blocks', inward: 'is blocked by' },
        { id: 'relates', outward: 'relates to', inward: 'relates to' },
        { id: 'duplicates', outward: 'duplicates', inward: 'is duplicated by' },
        { id: 'clones', outward: 'clones', inward: 'is cloned by' },
      ],
      goalStatuses: ['pending', 'on_track', 'at_risk', 'off_track', 'done', 'cancelled'],
      plan: {
        key: 'enterprise',
        name: 'Enterprise Cloudflare',
        status: 'active',
        features: ['unlimited_projects', 'unlimited_users', 'audit_logs', 'automations', 'custom_fields'],
        limits: { projects: 9999, users: 9999 },
      },
    });
  }

  // 6. Billing (/api/billing)
  if (path === '/billing' && method === 'GET') {
    const sub = (await db.get(`SELECT * FROM subscription LIMIT 1`)) || {
      plan: 'enterprise',
      status: 'active',
      cycle: 'monthly',
    };
    return json({
      plan: sub.plan || 'enterprise',
      status: sub.status || 'active',
      planName: 'Cloudflare Edge Edition',
      features: ['unlimited_projects', 'unlimited_users', 'audit_logs', 'automations'],
    });
  }

  // 7. Quick Search (/api/quicksearch)
  if (path === '/quicksearch' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return json({ issues: [], projects: [] });

    const qLike = `%${q}%`;
    const issues = (
      await db.all(
        `${ISSUE_SELECT} WHERE i.key LIKE ? OR i.summary LIKE ? ORDER BY i.id DESC LIMIT 10`,
        qLike,
        qLike
      )
    ).map(toIssue);

    const projects = await db.all(
      `SELECT * FROM projects WHERE key LIKE ? OR name LIKE ? ORDER BY name LIMIT 5`,
      qLike,
      qLike
    );

    return json({ issues, projects });
  }

  // 8. Search (JQL & Issue Listing)
  if (path === '/search' && method === 'GET') {
    const jql = url.searchParams.get('jql') || '';
    const startAt = Math.max(0, parseInt(url.searchParams.get('startAt'), 10) || 0);
    const maxResults = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('maxResults'), 10) || 1000));

    let whereClause = '1=1';
    const params = [];

    // Parse simple JQL conditions
    const projectMatch = /project\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i.exec(jql);
    if (projectMatch) {
      whereClause += ' AND i.project_key = ?';
      params.push(projectMatch[1].toUpperCase());
    }

    const statusMatch = /status\s*=\s*['"]([^'"]+)['"]/i.exec(jql);
    if (statusMatch) {
      whereClause += ' AND i.status = ?';
      params.push(statusMatch[1]);
    }

    const textMatch = /text\s*~\s*['"]([^'"]+)['"]/i.exec(jql);
    if (textMatch) {
      whereClause += ' AND (i.summary LIKE ? OR i.description LIKE ?)';
      params.push(`%${textMatch[1]}%`, `%${textMatch[1]}%`);
    }

    let orderBy = 'i.rank ASC';
    if (/ORDER BY\s+([A-Za-z0-9_\[\]]+)\s*(ASC|DESC)?/i.test(jql)) {
      const orderMatch = /ORDER BY\s+([A-Za-z0-9_\[\]]+)\s*(ASC|DESC)?/i.exec(jql);
      const field = orderMatch[1].toLowerCase();
      const dir = (orderMatch[2] || 'ASC').toUpperCase();
      if (field === 'created' || field === 'created_at') orderBy = `i.created_at ${dir}`;
      else if (field === 'updated' || field === 'updated_at') orderBy = `i.updated_at ${dir}`;
      else if (field === 'status') orderBy = `i.status ${dir}`;
      else if (field === 'priority') orderBy = `i.priority ${dir}`;
      else orderBy = `i.rank ${dir}`;
    }

    const countRow = await db.get(`SELECT COUNT(*) c FROM issues i WHERE ${whereClause}`, ...params);
    const total = countRow?.c || 0;

    const rows = await db.all(
      `${ISSUE_SELECT} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      ...params,
      maxResults,
      startAt
    );

    return json({
      jql,
      startAt,
      maxResults,
      total,
      issues: rows.map(toIssue),
    });
  }

  // 9. Single Issue Details, Comments & Rank
  const issueKeyMatch = /^\/issues\/([A-Za-z0-9_-]+)$/.exec(path);
  if (issueKeyMatch) {
    const key = issueKeyMatch[1].toUpperCase();

    if (method === 'GET') {
      const row = await db.get(`${ISSUE_SELECT} WHERE i.key = ? COLLATE NOCASE`, key);
      if (!row) return error(`Issue ${key} not found`, 404);

      const issue = toIssue(row);
      issue.children = (await db.all(`${ISSUE_SELECT} WHERE i.parent_id = ? ORDER BY i.rank`, row.id)).map(toIssue);
      issue.comments = await db.all(
        `SELECT id, author_id AS authorId, body, created_at AS created, updated_at AS updated
         FROM comments WHERE issue_id = ? ORDER BY created_at DESC`,
        row.id
      );
      issue.history = await db.all(
        `SELECT id, author_id AS authorId, field, from_value AS "from", to_value AS "to", created_at AS created
         FROM history WHERE issue_id = ? ORDER BY created_at DESC, id DESC`,
        row.id
      );
      const watchers = await db.all(`SELECT user_id FROM watchers WHERE issue_id = ?`, row.id);
      issue.watchers = watchers.map((w) => w.user_id);

      return json(issue);
    }

    if (method === 'PATCH') {
      const row = await db.get(`SELECT * FROM issues WHERE key = ? COLLATE NOCASE`, key);
      if (!row) return error(`Issue ${key} not found`, 404);

      let body;
      try {
        body = await request.json();
      } catch {
        return error('Invalid JSON');
      }

      const updates = [];
      const params = [];

      const fields = [
        ['summary', 'summary'],
        ['description', 'description'],
        ['status', 'status'],
        ['priority', 'priority'],
        ['type', 'type'],
        ['assigneeId', 'assignee_id'],
        ['sprint', 'sprint'],
        ['storyPoints', 'story_points'],
        ['fixVersion', 'fix_version'],
        ['dueDate', 'due_date'],
        ['startDate', 'start_date'],
      ];

      for (const [prop, col] of fields) {
        if (body[prop] !== undefined) {
          updates.push(`${col} = ?`);
          params.push(body[prop]);
          // record history
          if (String(row[col] || '') !== String(body[prop] || '')) {
            await db.run(
              `INSERT INTO history (issue_id, author_id, field, from_value, to_value, created_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))`,
              row.id,
              user.id,
              prop,
              row[col],
              body[prop]
            );
          }
        }
      }

      if (body.labels !== undefined) {
        updates.push(`labels = ?`);
        params.push(JSON.stringify(body.labels));
      }
      if (body.components !== undefined) {
        updates.push(`components = ?`);
        params.push(JSON.stringify(body.components));
      }

      if (body.status === 'Done') {
        updates.push(`resolved_at = datetime('now')`);
      } else if (body.status !== undefined) {
        updates.push(`resolved_at = NULL`);
      }

      updates.push(`updated_at = datetime('now')`);
      params.push(row.id);

      await db.run(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`, ...params);
      const updatedRow = await db.get(`${ISSUE_SELECT} WHERE i.id = ?`, row.id);
      return json(toIssue(updatedRow));
    }

    if (method === 'DELETE') {
      const row = await db.get(`SELECT * FROM issues WHERE key = ? COLLATE NOCASE`, key);
      if (!row) return error(`Issue ${key} not found`, 404);
      await db.run(`DELETE FROM issues WHERE id = ?`, row.id);
      return json({ ok: true, key });
    }
  }

  // 10. Issue Creation & Ranking
  if (path === '/issues' && method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return error('Invalid JSON');
    }

    const projectKey = (body.projectKey || body.project || 'KAN').toUpperCase();
    const proj = await db.get(`SELECT * FROM projects WHERE key = ?`, projectKey);
    if (!proj) return error(`Project ${projectKey} does not exist`);

    const num = proj.next_num || 1;
    await db.run(`UPDATE projects SET next_num = next_num + 1 WHERE key = ?`, projectKey);

    const issueKey = `${projectKey}-${num}`;
    const maxRankRow = await db.get(`SELECT COALESCE(MAX(rank), 0) as mr FROM issues WHERE project_key = ?`, projectKey);
    const rank = (maxRankRow?.mr || 0) + 1000;
    const nowIso = new Date().toISOString();

    const res = await db.run(
      `INSERT INTO issues (key, num, project_key, type, summary, description, status, priority, assignee_id, reporter_id, labels, due_date, start_date, story_points, sprint, rank, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      issueKey,
      num,
      projectKey,
      body.type || 'Task',
      body.summary || 'Untitled issue',
      body.description || '',
      body.status || 'To Do',
      body.priority || 'Medium',
      body.assigneeId || null,
      user.id,
      JSON.stringify(body.labels || []),
      body.dueDate || null,
      body.startDate || null,
      body.storyPoints || null,
      body.sprint || null,
      rank,
      nowIso,
      nowIso
    );

    const createdRow = await db.get(`${ISSUE_SELECT} WHERE i.key = ?`, issueKey);
    return json(toIssue(createdRow), 201);
  }

  const rankMatch = /^\/issues\/([A-Za-z0-9_-]+)\/rank$/.exec(path);
  if (rankMatch && (method === 'PUT' || method === 'POST')) {
    const key = rankMatch[1].toUpperCase();
    let body = {};
    try {
      body = await request.json();
    } catch {}

    let newRank = body.rank;
    if (newRank === undefined) {
      if (body.beforeKey && body.afterKey) {
        const r1 = await db.get(`SELECT rank FROM issues WHERE key = ?`, body.beforeKey);
        const r2 = await db.get(`SELECT rank FROM issues WHERE key = ?`, body.afterKey);
        if (r1 && r2) newRank = (r1.rank + r2.rank) / 2;
      } else if (body.afterKey) {
        const r2 = await db.get(`SELECT rank FROM issues WHERE key = ?`, body.afterKey);
        if (r2) newRank = r2.rank + 100;
      } else if (body.beforeKey) {
        const r1 = await db.get(`SELECT rank FROM issues WHERE key = ?`, body.beforeKey);
        if (r1) newRank = r1.rank - 100;
      }
    }

    if (newRank !== undefined) {
      await db.run(`UPDATE issues SET rank = ? WHERE key = ?`, newRank, key);
    }
    return json({ ok: true, rank: newRank });
  }

  // 11. Comments
  const commentsMatch = /^\/issues\/([A-Za-z0-9_-]+)\/comments$/.exec(path);
  if (commentsMatch && method === 'POST') {
    const key = commentsMatch[1].toUpperCase();
    const issue = await db.get(`SELECT id FROM issues WHERE key = ? COLLATE NOCASE`, key);
    if (!issue) return error(`Issue ${key} not found`, 404);

    let body;
    try {
      body = await request.json();
    } catch {
      return error('Invalid JSON');
    }

    const text = String(body.body || '').trim();
    if (!text) return error('Comment body cannot be empty');

    const nowIso = new Date().toISOString();
    const res = await db.run(
      `INSERT INTO comments (issue_id, author_id, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      issue.id,
      user.id,
      text,
      nowIso,
      nowIso
    );

    return json({
      id: res.meta?.last_row_id,
      issueId: issue.id,
      authorId: user.id,
      body: text,
      created: nowIso,
      updated: nowIso,
    });
  }

  const commentIdMatch = /^\/comments\/(\d+)$/.exec(path);
  if (commentIdMatch) {
    const id = parseInt(commentIdMatch[1], 10);
    if (method === 'PATCH') {
      const body = await request.json();
      await db.run(`UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ?`, body.body, id);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.run(`DELETE FROM comments WHERE id = ?`, id);
      return json({ ok: true });
    }
  }

  // 12. Projects
  if (path === '/projects') {
    if (method === 'GET') {
      const projects = await db.all(
        `SELECT p.*, u.name AS lead_name,
           (SELECT COUNT(*) FROM issues i WHERE i.project_key = p.key) AS issue_count
         FROM projects p
         LEFT JOIN users u ON u.id = p.lead_id
         ORDER BY p.name`
      );
      return json(projects);
    }
    if (method === 'POST') {
      const body = await request.json();
      const key = String(body.key || '').trim().toUpperCase();
      const name = String(body.name || '').trim();
      if (!key || !name) return error('Project key and name are required');

      await db.run(
        `INSERT INTO projects (key, name, type, description, lead_id, next_num, created_at)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
        key,
        name,
        body.type || 'software',
        body.description || '',
        body.leadId || user.id
      );

      await db.run(
        `INSERT OR IGNORE INTO project_members (project_key, user_id, role, added_by, added_at)
         VALUES (?, ?, 'admin', ?, datetime('now'))`,
        key,
        user.id,
        user.id
      );

      return json({ key, name, type: body.type || 'software' }, 201);
    }
  }

  // 13. Sprints
  if (path === '/sprints') {
    if (method === 'GET') {
      const projectKey = (url.searchParams.get('project') || 'KAN').toUpperCase();
      const sprints = await db.all(`SELECT * FROM sprints WHERE project_key = ? ORDER BY position, id`, projectKey);
      return json(sprints);
    }
    if (method === 'POST') {
      const body = await request.json();
      const projectKey = (body.projectKey || 'KAN').toUpperCase();
      const res = await db.run(
        `INSERT INTO sprints (project_key, name, goal, state, start_date, end_date, position, created_at)
         VALUES (?, ?, ?, 'future', ?, ?, 0, datetime('now'))`,
        projectKey,
        body.name || 'New Sprint',
        body.goal || '',
        body.startDate || null,
        body.endDate || null
      );
      return json({ id: res.meta?.last_row_id, name: body.name, state: 'future' }, 201);
    }
  }

  const sprintActionMatch = /^\/sprints\/(\d+)\/(start|complete)$/.exec(path);
  if (sprintActionMatch && method === 'POST') {
    const sprintId = parseInt(sprintActionMatch[1], 10);
    const action = sprintActionMatch[2];
    if (action === 'start') {
      await db.run(`UPDATE sprints SET state = 'active', start_date = datetime('now') WHERE id = ?`, sprintId);
    } else {
      await db.run(`UPDATE sprints SET state = 'closed', completed_at = datetime('now') WHERE id = ?`, sprintId);
    }
    return json({ ok: true, action });
  }

  // 14. Versions & Components
  if (path === '/versions' && method === 'GET') {
    const projectKey = (url.searchParams.get('project') || 'KAN').toUpperCase();
    const versions = await db.all(`SELECT * FROM versions WHERE project_key = ? ORDER BY position, id`, projectKey);
    return json(versions);
  }

  if (path === '/components' && method === 'GET') {
    const projectKey = (url.searchParams.get('project') || 'KAN').toUpperCase();
    const components = await db.all(`SELECT * FROM components WHERE project_key = ? ORDER BY name`, projectKey);
    return json(components);
  }

  // 15. Users list
  if (path === '/users' && method === 'GET') {
    const users = await db.all(`SELECT id, name, email, color, role, title, active FROM users ORDER BY name`);
    return json(users);
  }

  // 16. Server-Sent Events / Live updates stream
  if (path === '/events' && method === 'GET') {
    return new Response(': connected\n\n', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // 404 for unmatched /api routes
  return error(`No API route found for ${method} ${path}`, 404);
}
