namespace Masar.Domain.Entities;

public class IssueViewItem
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public int Num { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int IssueTypeId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string TypeIcon { get; set; } = string.Empty;
    public int HierarchyLevel { get; set; }
    public int StatusId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string StatusCategory { get; set; } = string.Empty;
    public int StatusOrder { get; set; }
    public int PriorityId { get; set; }
    public string Priority { get; set; } = string.Empty;
    public int PriorityOrder { get; set; }
    public int? ResolutionId { get; set; }
    public string? Resolution { get; set; }
    public string? AssigneeId { get; set; }
    public string? ReporterId { get; set; }
    public int? ParentId { get; set; }
    public string? ParentKey { get; set; }
    public string? ParentSummary { get; set; }
    public string? ParentType { get; set; }
    public int? SprintId { get; set; }
    public string? Sprint { get; set; }
    public string? SprintState { get; set; }
    public int? FixVersionId { get; set; }
    public string? FixVersion { get; set; }
    public string? FixVersionStatus { get; set; }
    public int? TeamId { get; set; }
    public string? TeamName { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateOnly? StartDate { get; set; }
    public double? StoryPoints { get; set; }
    public double Rank { get; set; }
    public int? OriginalEstimate { get; set; }
    public int? RemainingEstimate { get; set; }
    public int TimeSpent { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public string[] Labels { get; set; } = Array.Empty<string>();
    public string[] Components { get; set; } = Array.Empty<string>();
    public int VoteCount { get; set; }
    public int CommentCount { get; set; }
    public int AttachmentCount { get; set; }
    public int LinkCount { get; set; }
    public int ChildCount { get; set; }
    public int ChildDoneCount { get; set; }
}
