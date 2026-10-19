'use strict';

const { bad, notFound, forbidden } = require('../../shared/errors');
const { isHexColor } = require('../../shared/validation');

const DEFAULT_COLOR = '#0C66E4';

/** Cross-project teams. Editable by site admins, the creator and team members (with MANAGE_TEAMS). */
class TeamService {
  constructor({ db, access, audit, teamRepo, userRepo }) {
    Object.assign(this, { db, access, audit, teams: teamRepo, users: userRepo });
  }

  async canEdit(actor, team) {
    if (!(await this.access.canGlobal(actor, 'MANAGE_TEAMS'))) return false;
    return actor.isSiteAdmin || team.created_by === actor.id || this.teams.isMember(team.id, actor.id);
  }

  async views(actor, rows) {
    const ids = rows.map((t) => t.id);
    const [members, stats] = await Promise.all([this.teams.members(ids), this.teams.stats(ids)]);
    const out = [];
    for (const team of rows) {
      out.push({ team, members: members.get(team.id) || [], stats: stats.get(team.id) || { total: 0, open: 0 }, canEdit: Boolean(await this.canEdit(actor, team)) });
    }
    return out;
  }

  async require(id) {
    const team = await this.teams.find(id);
    if (!team) throw notFound('Team not found.');
    return team;
  }

  async list(actor) {
    return this.views(actor, await this.teams.list());
  }

  async get(actor, id) {
    return (await this.views(actor, [await this.require(id)]))[0];
  }

  async fields(body, existing = null) {
    const out = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Team name is required.');
      if (await this.teams.nameTaken(name, existing?.id)) throw bad('A team with that name already exists.');
      out.name = name.slice(0, 80);
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 1000);
    if (body.color !== undefined) {
      if (!isHexColor(body.color)) throw bad('Invalid colour.');
      out.color = body.color;
    }
    return out;
  }

  async existingUserIds(ids) {
    const out = [];
    for (const id of new Set(ids)) if (await this.users.findById(id)) out.push(id);
    return out;
  }

  async create(actor, body = {}) {
    await this.access.assertGlobal(actor, 'MANAGE_TEAMS');
    const fields = await this.fields({ color: DEFAULT_COLOR, ...body });
    if (!fields.name) throw bad('Team name is required.');
    const team = await this.db.tx(async () => {
      const row = await this.teams.insert({ ...fields, created_by: actor.id });
      await this.teams.replaceMembers(row.id, await this.existingUserIds([actor.id, ...(Array.isArray(body.members) ? body.members : [])]));
      await this.audit.record(actor, 'team.created', { target: row.name });
      return row;
    });
    return this.get(actor, team.id);
  }

  async update(actor, id, body = {}) {
    const team = await this.require(id);
    if (!(await this.canEdit(actor, team))) throw forbidden('Only team members or administrators can change this team.');
    const fields = await this.fields(body, team);
    await this.db.tx(async () => {
      if (Object.keys(fields).length) await this.teams.update(team.id, fields);
      if (Array.isArray(body.members)) await this.teams.replaceMembers(team.id, await this.existingUserIds(body.members));
      await this.audit.record(actor, 'team.updated', { target: fields.name || team.name, details: { fields: Object.keys(fields), members: Array.isArray(body.members) ? body.members.length : undefined } });
    });
    return this.get(actor, team.id);
  }

  async remove(actor, id) {
    const team = await this.require(id);
    if (!(await this.canEdit(actor, team))) throw forbidden('Only team members or administrators can delete this team.');
    await this.db.tx(async () => {
      await this.teams.delete(team.id); // issues.team_id → NULL via FK
      await this.audit.record(actor, 'team.deleted', { target: team.name });
    });
    return { ok: true };
  }
}

module.exports = { TeamService };
