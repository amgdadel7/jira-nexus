'use strict';

const { hashPassword, randomHex } = require('../../shared/crypto');
const { bad, notFound } = require('../../shared/errors');
const { isEmail } = require('../../shared/validation');
const { ROLES } = require('../../domain/permissions');

const AVATAR_COLORS = ['#0052CC', '#6554C0', '#00875A', '#FF5630', '#FF991F', '#00B8D9', '#8777D9', '#36B37E', '#DE350B', '#5243AA'];
const SITE_ROLES = ['admin', 'member'];

/** Site user administration (invite, edit, deactivate). */
class UserService {
  constructor({ db, userRepo, authRepo, projectRepo, billing, audit }) {
    Object.assign(this, { db, users: userRepo, auth: authRepo, projects: projectRepo, billing, audit });
    this.issues = null; // IssueService, set by the container (needed to unassign work)
  }

  listDirectory() {
    return this.users.listDirectory();
  }

  async get(id) {
    const user = await this.users.findById(id);
    if (!user) throw notFound('User not found.');
    return user;
  }

  /** Next avatar colour for a new account. */
  async nextColor() {
    return AVATAR_COLORS[(await this.users.countAll()) % AVATAR_COLORS.length];
  }

  async invite(actor, body) {
    const { name, email, password, role = 'member', title = '' } = body || {};
    if (!String(name || '').trim()) throw bad('Name is required.');
    if (!isEmail(email)) throw bad('Enter a valid email address.');
    if (String(password || '').length < 8) throw bad('Password must be at least 8 characters.');
    if (!SITE_ROLES.includes(role)) throw bad('Role must be admin or member.');
    if (await this.users.emailTaken(email)) throw bad('A user with that email already exists.');
    await this.billing.assertSeat(1);
    const user = await this.db.tx(async () => {
      const row = await this.users.insert({
        id: `u${randomHex(4)}`, name: String(name).trim(), email: String(email).trim().toLowerCase(), color: await this.nextColor(),
        password_hash: hashPassword(password), role, title: String(title).slice(0, 80),
      });
      for (const pr of Array.isArray(body.projects) ? body.projects : []) {
        const project = await this.projects.findByKey(pr.key);
        if (project && ROLES.includes(pr.role)) await this.projects.upsertMember(project.key, row.id, pr.role, actor.id);
      }
      return row;
    });
    await this.audit.record(actor, 'user.invited', { target: user.name, details: { userId: user.id, email: user.email, role } });
    return user;
  }

  async update(actor, id, body) {
    const user = await this.get(id);
    const { name, email, role, active, title, password } = body || {};
    const fields = {};
    if (name !== undefined) {
      if (!String(name).trim()) throw bad('Name is required.');
      fields.name = String(name).trim();
    }
    if (email !== undefined) {
      if (!isEmail(email)) throw bad('Enter a valid email address.');
      if (await this.users.emailTaken(email, user.id)) throw bad('A user with that email already exists.');
      fields.email = email.toLowerCase();
    }
    if (title !== undefined) fields.title = String(title).slice(0, 80);
    if (role !== undefined) {
      if (!SITE_ROLES.includes(role)) throw bad('Role must be admin or member.');
      if (user.id === actor.id && role !== 'admin') throw bad('You cannot remove your own admin role.');
      fields.role = role;
    }
    if (active !== undefined) {
      if (user.id === actor.id && !active) throw bad('You cannot deactivate yourself.');
      if (active && !user.active) await this.billing.assertSeat(1);
      fields.active = Boolean(active);
      if (!active) await this.auth.deleteUserSessions(user.id);
    }
    if (password !== undefined) {
      if (String(password).length < 8) throw bad('Password must be at least 8 characters.');
      fields.password_hash = hashPassword(password);
      // An admin-set password signs the user out everywhere (except the admin's own session).
      await this.auth.deleteUserSessions(user.id, actor.sessionToken);
    }
    const updated = await this.users.update(user.id, fields);
    if ('role' in fields && fields.role !== user.role) await this.audit.record(actor, 'user.role_changed', { target: user.name, details: { userId: user.id, from: user.role, to: fields.role } });
    if ('active' in fields && fields.active !== user.active) await this.audit.record(actor, fields.active ? 'user.reactivated' : 'user.deactivated', { target: user.name, details: { userId: user.id } });
    if ('password_hash' in fields) await this.audit.record(actor, 'user.password_reset_by_admin', { target: user.name, details: { userId: user.id } });
    return updated;
  }

  /** "Deleting" deactivates the account (history stays intact) and unassigns open work. */
  async remove(actor, id) {
    const user = await this.get(id);
    if (user.id === actor.id) throw bad('You cannot remove yourself.');
    await this.db.tx(async () => {
      await this.users.update(user.id, { active: false });
      await this.auth.deleteUserSessions(user.id);
      await this.issues.unassignOpenWork(actor, user.id);
    });
    await this.audit.record(actor, 'user.deactivated', { target: user.name, details: { userId: user.id } });
  }
}

module.exports = { UserService, AVATAR_COLORS };
