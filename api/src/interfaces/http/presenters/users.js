'use strict';

/** Public shape of a user (never exposes hashes or tokens). */
const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, color: u.color, role: u.role, active: !!u.active, title: u.title || '',
  mfaEnabled: !!u.mfa_enabled,
  avatarUrl: u.avatar ? `/api/avatars/${u.avatar}` : null, ...(u.bot ? { bot: true } : {}),
});

const directoryUser = (u) => ({ ...publicUser(u), openCount: u.open_count, lastLogin: u.last_login, created: u.created_at });

const apiToken = (t) => ({
  id: t.id, name: t.name, prefix: t.prefix, created: t.created_at, lastUsed: t.last_used_at, expires: t.expires_at,
  expired: !!t.expires_at && t.expires_at <= new Date().toISOString(),
});

const session = (s, currentToken) => ({
  id: s.token.slice(0, 12), current: s.token === currentToken, created: s.created_at, lastSeen: s.last_seen_at || s.created_at,
  expires: s.expires_at, userAgent: s.user_agent, ipAddress: s.ip_address || '',
  sudoConfirmed: !!(s.sudo_confirmed_at && Date.now() - new Date(s.sudo_confirmed_at) < 15 * 60e3),
  remember: !!s.remember,
});

module.exports = { publicUser, directoryUser, apiToken, session };
