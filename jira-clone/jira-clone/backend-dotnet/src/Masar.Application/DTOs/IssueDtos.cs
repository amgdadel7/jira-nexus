using System.Text.Json.Serialization;

namespace Masar.Application.DTOs;

public record IssueParentDto(
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("type")] string Type
);

public record IssueDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("project")] string Project,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("statusCategory")] string StatusCategory,
    [property: JsonPropertyName("priority")] string Priority,
    [property: JsonPropertyName("resolution")] string? Resolution,
    [property: JsonPropertyName("assigneeId")] string? AssigneeId,
    [property: JsonPropertyName("reporterId")] string? ReporterId,
    [property: JsonPropertyName("parent")] IssueParentDto? Parent,
    [property: JsonPropertyName("labels")] string[] Labels,
    [property: JsonPropertyName("dueDate")] DateOnly? DueDate,
    [property: JsonPropertyName("startDate")] DateOnly? StartDate,
    [property: JsonPropertyName("storyPoints")] double? StoryPoints,
    [property: JsonPropertyName("sprint")] string? Sprint,
    [property: JsonPropertyName("fixVersion")] string? FixVersion,
    [property: JsonPropertyName("rank")] double Rank,
    [property: JsonPropertyName("components")] string[] Components,
    [property: JsonPropertyName("teamId")] int? TeamId,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated,
    [property: JsonPropertyName("resolved")] DateTimeOffset? Resolved,
    [property: JsonPropertyName("commentCount")] int CommentCount,
    [property: JsonPropertyName("childCount")] int ChildCount,
    [property: JsonPropertyName("childDone")] int ChildDone,
    [property: JsonPropertyName("attachmentCount")] int AttachmentCount,
    [property: JsonPropertyName("linkCount")] int LinkCount,
    [property: JsonPropertyName("votes")] int Votes,
    [property: JsonPropertyName("originalEstimate")] int? OriginalEstimate,
    [property: JsonPropertyName("remainingEstimate")] int? RemainingEstimate,
    [property: JsonPropertyName("timeSpent")] int TimeSpent
);

public record SearchSortItemDto(
    [property: JsonPropertyName("field")] string Field,
    [property: JsonPropertyName("dir")] string Dir
);

public record SearchResponse(
    [property: JsonPropertyName("jql")] string Jql,
    [property: JsonPropertyName("startAt")] int StartAt,
    [property: JsonPropertyName("maxResults")] int MaxResults,
    [property: JsonPropertyName("total")] int Total,
    [property: JsonPropertyName("sort")] IEnumerable<SearchSortItemDto> Sort,
    [property: JsonPropertyName("issues")] IEnumerable<IssueDto> Issues
);

public record CommentDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("authorId")] string? AuthorId,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated
);

public record HistoryDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("authorId")] string? AuthorId,
    [property: JsonPropertyName("field")] string Field,
    [property: JsonPropertyName("from")] string? From,
    [property: JsonPropertyName("to")] string? To,
    [property: JsonPropertyName("created")] DateTimeOffset Created
);

public record IssueDetailDto : IssueDto
{
    public IssueDetailDto(IssueDto baseDto) : base(baseDto) { }

    [JsonPropertyName("children")] public IEnumerable<IssueDto> Children { get; init; } = [];
    [JsonPropertyName("comments")] public IEnumerable<CommentDto> Comments { get; init; } = [];
    [JsonPropertyName("history")] public IEnumerable<HistoryDto> History { get; init; } = [];
    [JsonPropertyName("watchers")] public IEnumerable<string> Watchers { get; init; } = [];
    [JsonPropertyName("watching")] public bool Watching { get; init; }
    [JsonPropertyName("links")] public IEnumerable<object> Links { get; init; } = [];
    [JsonPropertyName("permissions")] public IEnumerable<string> Permissions { get; init; } = [];
    [JsonPropertyName("attachments")] public IEnumerable<object> Attachments { get; init; } = [];
    [JsonPropertyName("development")] public IEnumerable<object> Development { get; init; } = [];
    [JsonPropertyName("goals")] public IEnumerable<object> Goals { get; init; } = [];
    [JsonPropertyName("worklogs")] public IEnumerable<object> Worklogs { get; init; } = [];
    [JsonPropertyName("voters")] public IEnumerable<string> Voters { get; init; } = [];
    [JsonPropertyName("voted")] public bool Voted { get; init; }
    [JsonPropertyName("customFields")] public object CustomFields { get; init; } = new { };
}

public record CreateIssueRequest(
    [property: JsonPropertyName("project")] string? Project,
    [property: JsonPropertyName("projectKey")] string? ProjectKey,
    [property: JsonPropertyName("type")] string? Type,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("priority")] string? Priority,
    [property: JsonPropertyName("assigneeId")] string? AssigneeId,
    [property: JsonPropertyName("reporterId")] string? ReporterId,
    [property: JsonPropertyName("parentKey")] string? ParentKey,
    [property: JsonPropertyName("sprint")] string? Sprint,
    [property: JsonPropertyName("fixVersion")] string? FixVersion,
    [property: JsonPropertyName("labels")] string[]? Labels,
    [property: JsonPropertyName("components")] string[]? Components,
    [property: JsonPropertyName("dueDate")] string? DueDate,
    [property: JsonPropertyName("startDate")] string? StartDate,
    [property: JsonPropertyName("storyPoints")] double? StoryPoints,
    [property: JsonPropertyName("originalEstimate")] string? OriginalEstimate,
    [property: JsonPropertyName("remainingEstimate")] string? RemainingEstimate
);

public record UpdateIssueRequest(
    [property: JsonPropertyName("type")] string? Type,
    [property: JsonPropertyName("summary")] string? Summary,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("priority")] string? Priority,
    [property: JsonPropertyName("resolution")] string? Resolution,
    [property: JsonPropertyName("assigneeId")] string? AssigneeId,
    [property: JsonPropertyName("reporterId")] string? ReporterId,
    [property: JsonPropertyName("parentKey")] string? ParentKey,
    [property: JsonPropertyName("sprint")] string? Sprint,
    [property: JsonPropertyName("fixVersion")] string? FixVersion,
    [property: JsonPropertyName("labels")] string[]? Labels,
    [property: JsonPropertyName("components")] string[]? Components,
    [property: JsonPropertyName("dueDate")] string? DueDate,
    [property: JsonPropertyName("startDate")] string? StartDate,
    [property: JsonPropertyName("storyPoints")] double? StoryPoints
);

public record RankIssueRequest(
    [property: JsonPropertyName("beforeKey")] string? BeforeKey,
    [property: JsonPropertyName("afterKey")] string? AfterKey
);

public record AddCommentRequest(
    [property: JsonPropertyName("body")] string Body
);
