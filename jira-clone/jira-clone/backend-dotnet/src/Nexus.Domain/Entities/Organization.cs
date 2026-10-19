namespace Nexus.Domain.Entities;

public class Organization : AuditedEntity
{
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string Plan { get; set; } = "enterprise";
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<AppUser> Users { get; set; } = new List<AppUser>();
}

public class Workspace : Entity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = default!;
    public string Key { get; set; } = default!;
}

public class AppUser : AuditedEntity
{
    public Guid OrganizationId { get; set; }
    public Organization Organization { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string? PasswordHash { get; set; }
    public string Name { get; set; } = default!;
    public string? Title { get; set; }
    public string? Department { get; set; }
    public string? AvatarPath { get; set; }
    public string Presence { get; set; } = "offline";
    public int CapacityHours { get; set; } = 40;
    public bool EmailVerified { get; set; }
    public bool TwoFactorEnabled { get; set; }
    public string? TwoFactorSecret { get; set; }
    public string? GoogleSub { get; set; }
    public string? MicrosoftSub { get; set; }
}

public class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public string TokenHash { get; set; } = default!;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedBy { get; set; }
    public string? UserAgent { get; set; }
    public string? Ip { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Role : Entity
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public ICollection<Permission> Permissions { get; set; } = new List<Permission>();
}

public class Permission : Entity
{
    public string Code { get; set; } = default!;
    public string? Description { get; set; }
}

public class Membership : Entity
{
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
}

public class Team : Entity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = default!;
}

public class Project : AuditedEntity
{
    public Guid OrganizationId { get; set; }
    public Guid? WorkspaceId { get; set; }
    public string Name { get; set; } = default!;
    public string Key { get; set; } = default!;
    public string? Description { get; set; }
    public string Status { get; set; } = "active";
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public int Progress { get; set; }
    public Guid? LeadId { get; set; }
    public string? Color { get; set; }
    public ICollection<Issue> Issues { get; set; } = new List<Issue>();
    public ICollection<Sprint> Sprints { get; set; } = new List<Sprint>();
}

public class Sprint : Entity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Goal { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = "planned";
    public int CommittedPoints { get; set; }
    public int CompletedPoints { get; set; }
}

public class Issue : AuditedEntity
{
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = default!;
    public Guid? SprintId { get; set; }
    public Guid? ParentId { get; set; }
    public int Number { get; set; }
    public string Key { get; set; } = default!;
    public string Type { get; set; } = "task";
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string Status { get; set; } = "backlog";
    public string Priority { get; set; } = "medium";
    public Guid? AssigneeId { get; set; }
    public Guid ReporterId { get; set; }
    public int? StoryPoints { get; set; }
    public DateOnly? DueDate { get; set; }
    public decimal Rank { get; set; }
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<IssueLabel> Labels { get; set; } = new List<IssueLabel>();
}

public class IssueLabel
{
    public Guid IssueId { get; set; }
    public string Label { get; set; } = default!;
}

public class Comment : Entity
{
    public Guid IssueId { get; set; }
    public Guid AuthorId { get; set; }
    public string Body { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Attachment : Entity
{
    public Guid IssueId { get; set; }
    public Guid UploadedBy { get; set; }
    public string Bucket { get; set; } = "attachments";
    public string ObjectPath { get; set; } = default!;
    public string FileName { get; set; } = default!;
    public string? ContentType { get; set; }
    public long SizeBytes { get; set; }
}

public class Notification : Entity
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = default!;
    public string? Body { get; set; }
    public string Type { get; set; } = "system";
    public DateTimeOffset? ReadAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class AuditLog : Entity
{
    public Guid? OrganizationId { get; set; }
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = default!;
    public string EntityType { get; set; } = default!;
    public Guid? EntityId { get; set; }
    public string? Metadata { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class IssueLink : Entity
{
    public Guid SourceIssueId { get; set; }
    public Guid TargetIssueId { get; set; }
    public string LinkType { get; set; } = "relates_to";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Worklog : Entity
{
    public Guid IssueId { get; set; }
    public Guid AuthorId { get; set; }
    public int TimeSpentSeconds { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? Description { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class IssueWatcher
{
    public Guid IssueId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class CustomField : Entity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = default!;
    public string FieldType { get; set; } = "text";
    public string? Description { get; set; }
    public int ScreensCount { get; set; } = 1;
}

public class IntakeForm : Entity
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public string FieldsJson { get; set; } = "[]";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class FormSubmission : Entity
{
    public Guid FormId { get; set; }
    public string Title { get; set; } = default!;
    public string Submitter { get; set; } = default!;
    public string Status { get; set; } = "New";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class GitRepository : Entity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = default!;
    public string Provider { get; set; } = "github";
    public string Url { get; set; } = default!;
}

public class GitPullRequest : Entity
{
    public Guid RepositoryId { get; set; }
    public string IssueKey { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Repo { get; set; } = default!;
    public string Branch { get; set; } = default!;
    public string Author { get; set; } = default!;
    public string Status { get; set; } = "OPEN";
    public string CiStatus { get; set; } = "PASSED";
    public string? Reviews { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class AutomationRule : Entity
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = default!;
    public string TriggerType { get; set; } = "issue_created";
    public string ActionsJson { get; set; } = "[]";
    public bool IsEnabled { get; set; } = true;
}

public class WorkType : Entity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int HierarchyLevel { get; set; } = 0;
    public string Icon { get; set; } = "🔵";
    public string Color { get; set; } = "#0052CC";
    public bool IsSubtask { get; set; } = false;
    public int SchemesCount { get; set; } = 1;
}

public class WorkTypeScheme : Entity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? DefaultWorkTypeId { get; set; }
    public int ProjectsCount { get; set; } = 1;
}

public class WorkTypeSchemeItem
{
    public Guid SchemeId { get; set; }
    public Guid WorkTypeId { get; set; }
}


