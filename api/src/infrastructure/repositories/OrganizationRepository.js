'use strict';

const { sql } = require('../database/sql');

/** organizations, organization_members, workspaces, workspace_members */
class OrganizationRepository {
  constructor({ db }) {
    this.db = db;
  }

  findById(id) {
    return this.db.one(sql`SELECT * FROM organizations WHERE id = ${id}`);
  }

  findBySlug(slug) {
    return this.db.one(sql`SELECT * FROM organizations WHERE lower(slug) = lower(${slug})`);
  }

  async listByUserId(userId) {
    return this.db.many(sql`
      SELECT o.*, om.role AS member_role, om.joined_at
      FROM organizations o
      JOIN organization_members om ON om.org_id = o.id
      WHERE om.user_id = ${userId}
      ORDER BY o.name ASC
    `);
  }

  async insert({ id, name, slug, plan = 'free', ownerId = null }) {
    return this.db.one(sql`
      INSERT INTO organizations (id, name, slug, plan, owner_id)
      VALUES (${id}, ${name}, ${slug}, ${plan}, ${ownerId})
      RETURNING *
    `);
  }

  async update(id, fields) {
    return this.db.one(sql`
      UPDATE organizations SET ${sql.set(fields)}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `);
  }

  async getMember(orgId, userId) {
    return this.db.one(sql`
      SELECT om.*, u.name, u.email, u.avatar
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ${orgId} AND om.user_id = ${userId}
    `);
  }

  async listMembers(orgId) {
    return this.db.many(sql`
      SELECT om.*, u.name, u.email, u.avatar
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ${orgId}
      ORDER BY u.name ASC
    `);
  }

  async addMember({ orgId, userId, role = 'member' }) {
    return this.db.one(sql`
      INSERT INTO organization_members (org_id, user_id, role)
      VALUES (${orgId}, ${userId}, ${role})
      ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `);
  }

  async removeMember(orgId, userId) {
    await this.db.query(sql`
      DELETE FROM organization_members
      WHERE org_id = ${orgId} AND user_id = ${userId}
    `);
  }

  async listWorkspaces(orgId) {
    return this.db.many(sql`
      SELECT * FROM workspaces
      WHERE org_id = ${orgId}
      ORDER BY name ASC
    `);
  }

  findWorkspaceById(id) {
    return this.db.one(sql`SELECT * FROM workspaces WHERE id = ${id}`);
  }

  findWorkspaceBySlug(orgId, slug) {
    return this.db.one(sql`
      SELECT * FROM workspaces
      WHERE org_id = ${orgId} AND lower(slug) = lower(${slug})
    `);
  }

  async insertWorkspace({ id, orgId, name, slug }) {
    return this.db.one(sql`
      INSERT INTO workspaces (id, org_id, name, slug)
      VALUES (${id}, ${orgId}, ${name}, ${slug})
      RETURNING *
    `);
  }

  async addWorkspaceMember({ workspaceId, userId, role = 'member' }) {
    return this.db.one(sql`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${workspaceId}, ${userId}, ${role})
      ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `);
  }
}

module.exports = { OrganizationRepository };
