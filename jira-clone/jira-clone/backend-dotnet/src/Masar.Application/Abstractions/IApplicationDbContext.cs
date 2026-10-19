using Microsoft.EntityFrameworkCore;
using Masar.Domain.Entities;

namespace Masar.Application.Abstractions;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Session> Sessions { get; }
    DbSet<Project> Projects { get; }
    DbSet<ProjectMember> ProjectMembers { get; }
    DbSet<ProjectStar> ProjectStars { get; }
    DbSet<PermissionSchemeEntry> PermissionSchemeEntries { get; }
    DbSet<Component> Components { get; }
    DbSet<Sprint> Sprints { get; }
    DbSet<Masar.Domain.Entities.Version> Versions { get; }
    DbSet<Team> Teams { get; }
    DbSet<TeamMember> TeamMembers { get; }
    DbSet<IssueType> IssueTypes { get; }
    DbSet<Status> Statuses { get; }
    DbSet<Priority> Priorities { get; }
    DbSet<Resolution> Resolutions { get; }
    DbSet<Workflow> Workflows { get; }
    DbSet<WorkflowStatus> WorkflowStatuses { get; }
    DbSet<WorkflowTransition> WorkflowTransitions { get; }
    DbSet<Issue> Issues { get; }
    DbSet<Label> Labels { get; }
    DbSet<IssueLabel> IssueLabels { get; }
    DbSet<IssueComponent> IssueComponents { get; }
    DbSet<Comment> Comments { get; }
    DbSet<History> HistoryEntries { get; }
    DbSet<Watcher> Watchers { get; }
    DbSet<Vote> Votes { get; }
    DbSet<IssueLink> IssueLinks { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<IssueViewItem> IssueView { get; }
    DbSet<AuditLogEntry> AuditLogs { get; }
    DbSet<TrashItem> TrashItems { get; }
    DbSet<SavedFilter> SavedFilters { get; }
    DbSet<Goal> Goals { get; }
    DbSet<GoalIssue> GoalIssues { get; }
    DbSet<WorkForm> WorkForms { get; }
    DbSet<CustomFieldDefinition> CustomFields { get; }
    DbSet<AutomationRule> AutomationRules { get; }
    DbSet<AutomationRun> AutomationRuns { get; }
    DbSet<WebhookSubscription> Webhooks { get; }
    DbSet<SiteSetting> SiteSettings { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface ICurrentUserService
{
    string? UserId { get; }
    string? Email { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
    bool IsAdmin { get; }
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string? storedHash);
}
