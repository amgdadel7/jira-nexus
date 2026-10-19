namespace Masar.Domain.Entities;

public class AuditLogEntry
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public string? ActorId { get; set; }
    public User? Actor { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string DetailsJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class TrashItem
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public string IssueKey { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Type { get; set; } = "task";
    public string Status { get; set; } = "To Do";
    public string? DeletedById { get; set; }
    public User? DeletedBy { get; set; }
    public string SnapshotJson { get; set; } = "{}";
    public DateTimeOffset DeletedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(30);
}

public class SavedFilter
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Jql { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
    public User? Owner { get; set; }
    public bool Starred { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Goal
{
    public int Id { get; set; }
    public string? ProjectKey { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "on_track"; // pending, on_track, at_risk, off_track, done, cancelled
    public string? OwnerId { get; set; }
    public User? Owner { get; set; }
    public DateOnly? TargetDate { get; set; }
    public double Progress { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<GoalIssue> Issues { get; set; } = new List<GoalIssue>();
}

public class GoalIssue
{
    public int GoalId { get; set; }
    public Goal? Goal { get; set; }
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
}

public class WorkForm
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string IssueType { get; set; } = "Task";
    public string FieldsJson { get; set; } = "[]";
    public bool Enabled { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class CustomFieldDefinition
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = "text"; // text, number, select, date, user, url
    public string OptionsJson { get; set; } = "[]";
    public bool Searchable { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class AutomationRule
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public string Trigger { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string ActionsJson { get; set; } = "[]";
    public string? CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<AutomationRun> Runs { get; set; } = new List<AutomationRun>();
}

public class AutomationRun
{
    public int Id { get; set; }
    public int RuleId { get; set; }
    public AutomationRule? Rule { get; set; }
    public string? IssueKey { get; set; }
    public string Status { get; set; } = "success"; // success, failed, skipped
    public string Message { get; set; } = string.Empty;
    public string ActionsJson { get; set; } = "[]";
    public int DurationMs { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class WebhookSubscription
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;
    public string EventsJson { get; set; } = "[]";
    public string Jql { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public string? CreatedById { get; set; }
    public User? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class SiteSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
