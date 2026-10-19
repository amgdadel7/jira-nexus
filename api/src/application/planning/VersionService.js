'use strict';

const { bad, notFound } = require('../../shared/errors');
const { DATE_RE } = require('../../domain/issue');
const { today } = require('../../shared/time');

const STATUSES = ['unreleased', 'released', 'archived'];

/** Releases (fix versions): plan what ships together, track progress, release and archive. */
class VersionService {
  constructor({ db, bus, access, versionRepo, issueRepo, issueService }) {
    Object.assign(this, { db, bus, access, versions: versionRepo, issues: issueRepo, issueService });
  }

  async withStats(rows) {
    const stats = await this.versions.stats(rows.map((v) => v.id));
    return rows.map((version) => ({ version, stats: stats.get(version.id) || { total: 0, done: 0, in_progress: 0, points: 0 } }));
  }

  async one(id) {
    return (await this.withStats([await this.require(id)]))[0];
  }

  async require(id) {
    const version = await this.versions.find(id);
    if (!version) throw notFound('Version not found.');
    return version;
  }

  async list(actor, { project, status } = {}) {
    const p = await this.access.assert(actor, project || 'KAN');
    return this.withStats(await this.versions.list(p.key, String(status || '').split(',').filter(Boolean)));
  }

  async get(actor, id) {
    const version = await this.require(id);
    await this.access.assert(actor, version.project_key);
    const view = await this.one(version.id);
    view.issues = await this.issues.withFixVersion(version.id);
    return view;
  }

  async fields(body, projectKey, exceptId = 0) {
    const out = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw bad('Version name is required.');
      if (name.length > 60) throw bad('Version name must be 60 characters or less.');
      if (await this.versions.nameTaken(projectKey, name, exceptId)) throw bad(`A version named '${name}' already exists in ${projectKey}.`);
      out.name = name;
    }
    if (body.description !== undefined) out.description = String(body.description || '').slice(0, 1000);
    for (const [key, column] of [['startDate', 'start_date'], ['releaseDate', 'release_date']]) {
      if (body[key] === undefined) continue;
      if (body[key] && !DATE_RE.test(body[key])) throw bad('Dates must be yyyy-MM-dd.');
      out[column] = body[key] || null;
    }
    return out;
  }

  static checkDates(start, end) {
    if (start && end && end < start) throw bad('The release date must be after the start date.');
  }

  async create(actor, body = {}) {
    const project = await this.access.assert(actor, body.projectKey || 'KAN', 'MANAGE_VERSIONS');
    const fields = await this.fields(body, project.key);
    if (!fields.name) throw bad('Version name is required.');
    VersionService.checkDates(fields.start_date, fields.release_date);
    const row = await this.versions.insert({ ...fields, project_key: project.key, status: 'unreleased', position: await this.versions.nextPosition(project.key) });
    return this.one(row.id);
  }

  async update(actor, id, body = {}) {
    const version = await this.require(id);
    await this.access.assert(actor, version.project_key, 'MANAGE_VERSIONS');
    const fields = await this.fields(body, version.project_key, version.id);
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) throw bad('Invalid version status.');
      fields.status = body.status;
      if (body.status === 'released' && version.status !== 'released') fields.released_at = new Date().toISOString();
      if (body.status === 'unreleased') fields.released_at = null;
    }
    VersionService.checkDates(fields.start_date !== undefined ? fields.start_date : version.start_date, fields.release_date !== undefined ? fields.release_date : version.release_date);
    if (Object.keys(fields).length) await this.versions.update(version.id, fields);
    return this.one(version.id);
  }

  async target(version, id) {
    if (id === null || id === undefined || id === '') return null;
    const target = await this.require(id);
    if (target.project_key !== version.project_key || target.id === version.id) throw bad('Choose another version in the same project.');
    if (target.status !== 'unreleased') throw bad('Work can only move to an unreleased version.');
    return target;
  }

  /** { releaseDate?, moveUnresolvedTo?: versionId | null } – unresolved work can stay, move, or be cleared. */
  async release(actor, id, body = {}) {
    const version = await this.require(id);
    await this.access.assert(actor, version.project_key, 'MANAGE_VERSIONS');
    if (version.status !== 'unreleased') throw bad('This version has already been released.');
    if (body.releaseDate && !DATE_RE.test(body.releaseDate)) throw bad('Dates must be yyyy-MM-dd.');
    const releaseDate = body.releaseDate || version.release_date || today();
    const moved = await this.db.tx(async () => {
      let count = 0;
      if ('moveUnresolvedTo' in body) {
        const target = await this.target(version, body.moveUnresolvedTo);
        const open = await this.issues.withFixVersion(version.id, { open: true });
        for (const row of open) await this.issueService.setFixVersion(actor, row, target);
        count = open.length;
      }
      await this.versions.update(version.id, { status: 'released', released_at: new Date().toISOString(), release_date: releaseDate });
      await this.bus.publish('version_released', { actorId: actor.id, version: { id: String(version.id), name: version.name, projectKey: version.project_key, released: true, releaseDate } });
      return count;
    });
    return { version: await this.one(version.id), moved };
  }

  async remove(actor, id, moveTo) {
    const version = await this.require(id);
    await this.access.assert(actor, version.project_key, 'MANAGE_VERSIONS');
    const target = await this.target(version, moveTo);
    await this.db.tx(async () => {
      for (const row of await this.issues.withFixVersion(version.id)) await this.issueService.setFixVersion(actor, row, target);
      await this.versions.delete(version.id);
    });
    return { ok: true };
  }
}

module.exports = { VersionService };
