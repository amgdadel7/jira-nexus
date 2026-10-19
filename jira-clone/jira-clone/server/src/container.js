'use strict';

/**
 * Composition root. Builds every repository and service once and wires them
 * together. Each constructor destructures the dependencies it needs from the
 * shared bag `c`, so construction order = dependency order. The few circular
 * relations (audit ↔ access/billing, users → issues, issues → custom fields)
 * are connected after construction.
 */

const { compileJql } = require('./infrastructure/jql/compiler');
const { FileStorage } = require('./infrastructure/storage/FileStorage');
const { LiveUpdates } = require('./infrastructure/realtime/LiveUpdates');
const { WebhookSender } = require('./infrastructure/http/WebhookSender');
const { OAuthGateway } = require('./infrastructure/oauth/OAuthGateway');

const repositories = {
  userRepo: require('./infrastructure/repositories/UserRepository').UserRepository,
  authRepo: require('./infrastructure/repositories/AuthRepository').AuthRepository,
  settingsRepo: require('./infrastructure/repositories/SettingsRepository').SettingsRepository,
  auditRepo: require('./infrastructure/repositories/AuditRepository').AuditRepository,
  billingRepo: require('./infrastructure/repositories/BillingRepository').BillingRepository,
  projectRepo: require('./infrastructure/repositories/ProjectRepository').ProjectRepository,
  configRepo: require('./infrastructure/repositories/ConfigRepository').ConfigRepository,
  issueRepo: require('./infrastructure/repositories/IssueRepository').IssueRepository,
  sprintRepo: require('./infrastructure/repositories/SprintRepository').SprintRepository,
  versionRepo: require('./infrastructure/repositories/VersionRepository').VersionRepository,
  componentRepo: require('./infrastructure/repositories/ComponentRepository').ComponentRepository,
  teamRepo: require('./infrastructure/repositories/TeamRepository').TeamRepository,
  trashRepo: require('./infrastructure/repositories/TrashRepository').TrashRepository,
  notificationRepo: require('./infrastructure/repositories/NotificationRepository').NotificationRepository,
  commentRepo: require('./infrastructure/repositories/CommentRepository').CommentRepository,
  linkRepo: require('./infrastructure/repositories/LinkRepository').LinkRepository,
  attachmentRepo: require('./infrastructure/repositories/AttachmentRepository').AttachmentRepository,
  developmentRepo: require('./infrastructure/repositories/DevelopmentRepository').DevelopmentRepository,
  worklogRepo: require('./infrastructure/repositories/WorklogRepository').WorklogRepository,
  voteRepo: require('./infrastructure/repositories/VoteRepository').VoteRepository,
  goalRepo: require('./infrastructure/repositories/GoalRepository').GoalRepository,
  filterRepo: require('./infrastructure/repositories/FilterRepository').FilterRepository,
  formRepo: require('./infrastructure/repositories/FormRepository').FormRepository,
  activityRepo: require('./infrastructure/repositories/ActivityRepository').ActivityRepository,
  customFieldRepo: require('./infrastructure/repositories/CustomFieldRepository').CustomFieldRepository,
  automationRepo: require('./infrastructure/repositories/AutomationRepository').AutomationRepository,
  webhookRepo: require('./infrastructure/repositories/WebhookRepository').WebhookRepository,
  reportRepo: require('./infrastructure/repositories/ReportRepository').ReportRepository,
  identityRepo: require('./infrastructure/repositories/IdentityRepository').IdentityRepository,
};

/** Services in dependency order: [bag name, class]. */
const services = [
  ['bus', require('./application/events/EventBus').EventBus],
  ['audit', require('./application/audit/AuditService').AuditService],
  ['billing', require('./application/billing/BillingService').BillingService],
  ['access', require('./application/access/AccessControl').AccessControl],
  ['catalog', require('./application/config/CatalogService').CatalogService],
  ['auth', require('./application/auth/AuthService').AuthService],
  ['notifications', require('./application/notifications/NotificationService').NotificationService],
  ['guard', require('./application/issues/IssueGuard').IssueGuard],
  ['customFields', require('./application/customFields/CustomFieldService').CustomFieldService],
  ['resolver', require('./application/issues/IssueFieldResolver').IssueFieldResolver],
  ['trash', require('./application/issues/TrashService').TrashService],
  ['issueService', require('./application/issues/IssueService').IssueService],
  ['issueQuery', require('./application/issues/IssueQueryService').IssueQueryService],
  ['comments', require('./application/issues/CommentService').CommentService],
  ['links', require('./application/issues/LinkService').LinkService],
  ['attachments', require('./application/issues/AttachmentService').AttachmentService],
  ['development', require('./application/issues/DevelopmentService').DevelopmentService],
  ['users', require('./application/users/UserService').UserService],
  ['projects', require('./application/projects/ProjectService').ProjectService],
  ['projectAccess', require('./application/projects/ProjectAccessService').ProjectAccessService],
  ['components', require('./application/projects/ComponentService').ComponentService],
  ['teams', require('./application/teams/TeamService').TeamService],
  ['sprints', require('./application/planning/SprintService').SprintService],
  ['versions', require('./application/planning/VersionService').VersionService],
  ['filters', require('./application/workspace/FilterService').FilterService],
  ['goals', require('./application/workspace/GoalService').GoalService],
  ['forms', require('./application/workspace/FormService').FormService],
  ['workspace', require('./application/workspace/WorkspaceService').WorkspaceService],
  ['automationEngine', require('./application/automation/AutomationEngine').AutomationEngine],
  ['automation', require('./application/automation/AutomationService').AutomationService],
  ['webhooks', require('./application/webhooks/WebhookService').WebhookService],
  ['reports', require('./application/reports/ReportService').ReportService],
  ['worklogs', require('./application/productivity/WorklogService').WorklogService],
  ['votes', require('./application/productivity/VoteService').VoteService],
  ['profile', require('./application/productivity/ProfileService').ProfileService],
  ['importer', require('./application/productivity/ImportService').ImportService],
  ['authProviders', require('./application/auth/AuthProviderService').AuthProviderService],
  ['signup', require('./application/auth/SignupService').SignupService],
  ['maintenance', require('./application/workspace/MaintenanceService').MaintenanceService],
];

function createContainer({ db, config, logger = console }) {
  const c = { db, config, logger };
  c.jql = { compile: compileJql };
  c.storage = new FileStorage({ config });
  c.live = new LiveUpdates();
  c.webhookSender = new WebhookSender();
  c.oauthGateway = new OAuthGateway({ allowEndpointOverrides: config.allowOAuthEndpointOverrides });
  c.openapi = require('./interfaces/http/openapi');
  c.demoSeeder = () => require('./infrastructure/database/seeds/demoSeed').seedDemo(c, { force: true, logger });

  for (const [name, Repository] of Object.entries(repositories)) c[name] = new Repository(c);
  for (const [name, Service] of services) c[name] = new Service(c);

  // circular relations
  c.audit.access = c.access;
  c.audit.billing = c.billing;
  c.users.issues = c.issueService;
  c.issueService.customFields = c.customFields;

  // domain event listeners (run after commit)
  c.automationEngine.start();
  c.webhooks.start(c.bus);

  // controllers see services under short names
  c.services = {
    auth: c.auth, users: c.users, billing: c.billing, audit: c.audit, access: c.access, catalog: c.catalog,
    issues: c.issueService, issueQuery: c.issueQuery, comments: c.comments, links: c.links, attachments: c.attachments,
    development: c.development, trash: c.trash, customFields: c.customFields, notifications: c.notifications,
    projects: c.projects, projectAccess: c.projectAccess, components: c.components, teams: c.teams,
    sprints: c.sprints, versions: c.versions, filters: c.filters, goals: c.goals, forms: c.forms, workspace: c.workspace,
    automation: c.automation, webhooks: c.webhooks, reports: c.reports, worklogs: c.worklogs, votes: c.votes,
    profile: c.profile, importer: c.importer, signup: c.signup, authProviders: c.authProviders, maintenance: c.maintenance,
  };
  return c;
}

module.exports = { createContainer };
