namespace Masar.Domain.Entities;

public class Issue
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public int Num { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public int IssueTypeId { get; set; }
    public IssueType? IssueType { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int StatusId { get; set; }
    public Status? Status { get; set; }
    public int PriorityId { get; set; }
    public Priority? Priority { get; set; }
    public int? ResolutionId { get; set; }
    public Resolution? Resolution { get; set; }
    public string? AssigneeId { get; set; }
    public User? Assignee { get; set; }
    public string? ReporterId { get; set; }
    public User? Reporter { get; set; }
    public int? ParentId { get; set; }
    public Issue? Parent { get; set; }
    public int? SprintId { get; set; }
    public Sprint? Sprint { get; set; }
    public int? FixVersionId { get; set; }
    public Version? FixVersion { get; set; }
    public int? TeamId { get; set; }
    public Team? Team { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateOnly? StartDate { get; set; }
    public double? StoryPoints { get; set; }
    public double Rank { get; set; }
    public int? OriginalEstimate { get; set; }
    public int? RemainingEstimate { get; set; }
    public int TimeSpent { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ResolvedAt { get; set; }

    public ICollection<IssueLabel> IssueLabels { get; set; } = new List<IssueLabel>();
    public ICollection<IssueComponent> IssueComponents { get; set; } = new List<IssueComponent>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<History> HistoryEntries { get; set; } = new List<History>();
    public ICollection<Watcher> Watchers { get; set; } = new List<Watcher>();
    public ICollection<Vote> Votes { get; set; } = new List<Vote>();
}

public class Label
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class IssueLabel
{
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
    public int LabelId { get; set; }
    public Label? Label { get; set; }
    public int Position { get; set; }
}

public class IssueComponent
{
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
    public int ComponentId { get; set; }
    public Component? Component { get; set; }
    public int Position { get; set; }
}

public class Comment
{
    public int Id { get; set; }
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
    public string? AuthorId { get; set; }
    public User? Author { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class History
{
    public int Id { get; set; }
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
    public string? AuthorId { get; set; }
    public User? Author { get; set; }
    public string Field { get; set; } = string.Empty;
    public string? FromValue { get; set; }
    public string? ToValue { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Watcher
{
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
}

public class Vote
{
    public int IssueId { get; set; }
    public Issue? Issue { get; set; }
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class IssueLink
{
    public int Id { get; set; }
    public int SourceId { get; set; }
    public Issue? Source { get; set; }
    public int TargetId { get; set; }
    public Issue? Target { get; set; }
    public string Type { get; set; } = string.Empty; // blocks, relates, duplicates, clones
    public string? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Notification
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? ActorId { get; set; }
    public int? IssueId { get; set; }
    public string Type { get; set; } = string.Empty; // assigned, status, comment, mention
    public string Message { get; set; } = string.Empty;
    public bool Read { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
