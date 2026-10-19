// Live updates over Server-Sent Events. Every successful write under /api is broadcast so other
// open browsers can refresh what they show. Payloads carry no data, only what changed and who did it.
const clients = new Set();
let seq = 0;

function handler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const client = { res, user: req.user, userId: req.user.id, clientId: String(req.query.client || '') };
  clients.add(client);
  send(client, 'hello', { users: online() });
  broadcast('presence', { users: online() });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(client);
    broadcast('presence', { users: online() });
  });
}

function send(c, event, data) {
  try { c.res.write(`id: ${++seq}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { clients.delete(c); }
}
function broadcast(event, data, onlyIf) { for (const c of clients) if (!onlyIf || onlyIf(c)) send(c, event, data); }

/** Project a write belongs to (when the path tells us), so private projects' events reach only their members. */
function projectFromPath(path) {
  const m = /^\/issues\/([A-Z][A-Z0-9]*)-\d+/i.exec(path) || /^\/projects\/([A-Z][A-Z0-9]*)/i.exec(path);
  return m ? m[1].toUpperCase() : null;
}
const online = () => [...new Set([...clients].map((c) => c.userId))];

/** Work out which area a write touched, so clients can decide what to reload. */
function topicFor(path) {
  const m = /^\/(issues|comments|links|attachments|sprints|versions|projects|filters|goals|forms|dev|webhooks|notifications|users|project|reset|components|trash|teams|permissions|worklogs|automation|admin)\b/.exec(path);
  return m ? m[1] : 'other';
}

/** Express middleware for /api: broadcast after successful non-GET requests (auth endpoints excluded). */
function broadcaster(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || req.path.startsWith('/auth')) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user) return;
    const project = projectFromPath(req.path) || (req.query.project ? String(req.query.project).toUpperCase() : null) || (req.body?.projectKey ? String(req.body.projectKey).toUpperCase() : null);
    let topic = topicFor(req.path);
    if (/^\/projects\/[^/]+\/(members|permissions|board)/.test(req.path) || topic === 'components') topic = 'project';
    if (topic === 'trash' || topic === 'worklogs') topic = 'issues';
    const PM = require('./perms');
    // no paths or keys in the payload; project-scoped events only go to people who can browse the project
    broadcast('change', {
      topic, project, method: req.method,
      actorId: req.user.id, client: String(req.headers['x-client-id'] || ''), at: new Date().toISOString(),
    }, project ? (c) => PM.can({ user: c.user }, project, 'BROWSE_PROJECT') : null);
  });
  next();
}

module.exports = { handler, broadcaster, broadcast, online, clients };
