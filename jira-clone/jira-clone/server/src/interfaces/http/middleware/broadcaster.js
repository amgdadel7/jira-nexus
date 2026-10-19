'use strict';

const { Actor } = require('../../../application/Actor');

const TOPICS = /^\/(issues|comments|links|attachments|sprints|versions|projects|filters|goals|forms|dev|webhooks|notifications|users|project|reset|components|trash|teams|permissions|worklogs|automation|admin|custom-fields|workflows|statuses|issue-types|priorities|resolutions|labels|dashboards)\b/;

/** Project a write belongs to, so private projects' events reach only people who can browse them. */
function projectOf(req) {
  const m = /^\/issues\/([A-Z][A-Z0-9]*)-\d+/i.exec(req.path) || /^\/projects\/([A-Z][A-Z0-9]*)/i.exec(req.path);
  if (m) return m[1].toUpperCase();
  if (req.query.project) return String(req.query.project).toUpperCase();
  if (req.body?.projectKey) return String(req.body.projectKey).toUpperCase();
  return null;
}

function topicOf(path) {
  let topic = TOPICS.exec(path)?.[1] || 'other';
  if (/^\/projects\/[^/]+\/(members|permissions|board|fields)/.test(path) || topic === 'components') topic = 'project';
  if (topic === 'trash' || topic === 'worklogs') topic = 'issues';
  if (['custom-fields', 'workflows', 'statuses', 'issue-types', 'priorities', 'resolutions', 'labels'].includes(topic)) topic = 'config';
  return topic;
}

/** After every successful write under /api (auth excluded), tells other open browsers what changed. */
function broadcaster({ live, access }) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/auth')) return next();
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.user) return;
      const project = projectOf(req);
      const payload = {
        topic: topicOf(req.path), project, method: req.method,
        actorId: req.user.id, client: String(req.headers['x-client-id'] || ''), at: new Date().toISOString(),
      };
      const filter = project ? (client) => access.can(new Actor(client.user), project, 'BROWSE_PROJECT') : null;
      live.broadcast('change', payload, filter).catch((err) => console.error('live update failed', err));
    });
    return next();
  };
}

module.exports = { broadcaster, topicOf, projectOf };
