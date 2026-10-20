'use strict';

const crypto = require('crypto');
const { bad, forbidden, notFound } = require('../../shared/errors');

class OrganizationService {
  constructor({ orgRepo, userRepo, audit }) {
    this.orgs = orgRepo;
    this.users = userRepo;
    this.audit = audit;
  }

  async listMyOrganizations(actor) {
    if (!actor.id) return [];
    const rows = await this.orgs.listByUserId(actor.id);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: r.plan,
      role: r.member_role,
      joinedAt: r.joined_at,
      isActive: r.id === actor.organizationId,
    }));
  }

  async getCurrent(actor) {
    const orgId = actor.organizationId || 'default-org';
    const org = await this.orgs.findById(orgId);
    if (!org) throw notFound('Current organization not found.');
    const member = actor.id ? await this.orgs.getMember(orgId, actor.id) : null;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      myRole: member ? member.role : (actor.isSiteAdmin ? 'owner' : 'member'),
    };
  }

  async create(actor, { name, slug }) {
    if (!actor.id) throw forbidden('You must be logged in to create an organization.');
    const cleanName = String(name || '').trim();
    if (!cleanName) throw bad('Organization name is required.');
    if (cleanName.length > 80) throw bad('Organization name must be 80 characters or less.');

    let cleanSlug = String(slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (!cleanSlug) {
      cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    }
    cleanSlug = cleanSlug.replace(/^-|-$/g, '') || `org-${Date.now()}`;

    if (await this.orgs.findBySlug(cleanSlug)) {
      throw bad(`The organization slug '${cleanSlug}' is already taken.`);
    }

    const orgId = `org-${crypto.randomBytes(6).toString('hex')}`;
    const org = await this.orgs.insert({
      id: orgId,
      name: cleanName,
      slug: cleanSlug,
      plan: 'free',
      ownerId: actor.id,
    });

    // Add creator as owner
    await this.orgs.addMember({ orgId, userId: actor.id, role: 'owner' });

    // Create default workspace for new organization
    const wsId = `ws-${crypto.randomBytes(6).toString('hex')}`;
    await this.orgs.insertWorkspace({
      id: wsId,
      orgId,
      name: 'Main Workspace',
      slug: 'main',
    });
    await this.orgs.addWorkspaceMember({ workspaceId: wsId, userId: actor.id, role: 'admin' });

    if (this.audit?.record) {
      await this.audit.record(actor, 'organization.created', { target: orgId, details: { name: cleanName, slug: cleanSlug } });
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      myRole: 'owner',
    };
  }

  async switch(actor, orgId) {
    if (!actor.id) throw forbidden('You must be logged in.');
    const cleanId = String(orgId || '').trim();
    const org = await this.orgs.findById(cleanId);
    if (!org) throw notFound('Organization not found.');

    const member = await this.orgs.getMember(cleanId, actor.id);
    if (!member && !actor.isSiteAdmin) {
      throw forbidden('You are not a member of this organization.');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      myRole: member ? member.role : 'owner',
    };
  }

  async listMembers(actor, orgId) {
    const targetOrgId = orgId || actor.organizationId;
    // Actor must belong to target org
    const member = await this.orgs.getMember(targetOrgId, actor.id);
    if (!member && !actor.isSiteAdmin) {
      throw notFound('Organization not found.');
    }
    return this.orgs.listMembers(targetOrgId);
  }

  async addMember(actor, orgId, { email, role = 'member' }) {
    const targetOrgId = orgId || actor.organizationId;
    const currentMember = await this.orgs.getMember(targetOrgId, actor.id);
    if ((!currentMember || !['owner', 'admin'].includes(currentMember.role)) && !actor.isSiteAdmin) {
      throw forbidden('Only organization administrators can add members.');
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = await this.users.findByEmail(cleanEmail);
    if (!user) throw notFound(`User with email '${cleanEmail}' not found.`);

    const targetRole = ['owner', 'admin', 'member', 'guest'].includes(role) ? role : 'member';
    const added = await this.orgs.addMember({ orgId: targetOrgId, userId: user.id, role: targetRole });
    return added;
  }

  async removeMember(actor, orgId, userId) {
    const targetOrgId = orgId || actor.organizationId;
    const currentMember = await this.orgs.getMember(targetOrgId, actor.id);
    if ((!currentMember || !['owner', 'admin'].includes(currentMember.role)) && !actor.isSiteAdmin) {
      throw forbidden('Only organization administrators can remove members.');
    }

    const target = await this.orgs.getMember(targetOrgId, userId);
    if (!target) throw notFound('Member not found in organization.');

    if (target.role === 'owner') {
      const allMembers = await this.orgs.listMembers(targetOrgId);
      const owners = allMembers.filter((m) => m.role === 'owner');
      if (owners.length <= 1) throw bad('Cannot remove the only owner of the organization.');
    }

    await this.orgs.removeMember(targetOrgId, userId);
    return { ok: true };
  }

  async listWorkspaces(actor, orgId) {
    const targetOrgId = orgId || actor.organizationId;
    const member = await this.orgs.getMember(targetOrgId, actor.id);
    if (!member && !actor.isSiteAdmin) {
      throw notFound('Organization not found.');
    }
    return this.orgs.listWorkspaces(targetOrgId);
  }

  async createWorkspace(actor, orgId, { name, slug }) {
    const targetOrgId = orgId || actor.organizationId;
    const member = await this.orgs.getMember(targetOrgId, actor.id);
    if ((!member || !['owner', 'admin'].includes(member.role)) && !actor.isSiteAdmin) {
      throw forbidden('Only organization administrators can create workspaces.');
    }

    const cleanName = String(name || '').trim();
    if (!cleanName) throw bad('Workspace name is required.');

    let cleanSlug = String(slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (!cleanSlug) {
      cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    }
    cleanSlug = cleanSlug.replace(/^-|-$/g, '') || `ws-${Date.now()}`;

    if (await this.orgs.findWorkspaceBySlug(targetOrgId, cleanSlug)) {
      throw bad(`Workspace slug '${cleanSlug}' already exists in this organization.`);
    }

    const wsId = `ws-${crypto.randomBytes(6).toString('hex')}`;
    const ws = await this.orgs.insertWorkspace({
      id: wsId,
      orgId: targetOrgId,
      name: cleanName,
      slug: cleanSlug,
    });

    await this.orgs.addWorkspaceMember({ workspaceId: wsId, userId: actor.id, role: 'admin' });
    return ws;
  }
}

module.exports = { OrganizationService };
