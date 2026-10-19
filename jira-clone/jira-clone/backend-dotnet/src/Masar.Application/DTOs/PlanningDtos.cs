using System.Text.Json.Serialization;

namespace Masar.Application.DTOs;

public record SprintStatsDto(
    [property: JsonPropertyName("total")] int Total,
    [property: JsonPropertyName("done")] int Done,
    [property: JsonPropertyName("inProgress")] int InProgress,
    [property: JsonPropertyName("todo")] int Todo,
    [property: JsonPropertyName("points")] double Points,
    [property: JsonPropertyName("donePoints")] double DonePoints
);

public record SprintPointsCountDto(
    [property: JsonPropertyName("points")] double Points,
    [property: JsonPropertyName("count")] int Count
);

public record SprintDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("goal")] string Goal,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("startDate")] DateOnly? StartDate,
    [property: JsonPropertyName("endDate")] DateOnly? EndDate,
    [property: JsonPropertyName("completedAt")] DateTimeOffset? CompletedAt,
    [property: JsonPropertyName("position")] int Position,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("projectKey")] string ProjectKey,
    [property: JsonPropertyName("committed")] SprintPointsCountDto? Committed,
    [property: JsonPropertyName("completed")] SprintPointsCountDto? Completed,
    [property: JsonPropertyName("stats")] SprintStatsDto Stats
);

public record CreateSprintRequest(
    [property: JsonPropertyName("projectKey")] string? ProjectKey,
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("goal")] string? Goal,
    [property: JsonPropertyName("startDate")] string? StartDate,
    [property: JsonPropertyName("endDate")] string? EndDate
);

public record UpdateSprintRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("goal")] string? Goal,
    [property: JsonPropertyName("startDate")] string? StartDate,
    [property: JsonPropertyName("endDate")] string? EndDate
);

public record VersionStatsDto(
    [property: JsonPropertyName("total")] int Total,
    [property: JsonPropertyName("done")] int Done,
    [property: JsonPropertyName("inProgress")] int InProgress,
    [property: JsonPropertyName("todo")] int Todo,
    [property: JsonPropertyName("points")] double Points
);

public record VersionDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("projectKey")] string ProjectKey,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("startDate")] DateOnly? StartDate,
    [property: JsonPropertyName("releaseDate")] DateOnly? ReleaseDate,
    [property: JsonPropertyName("releasedAt")] DateTimeOffset? ReleasedAt,
    [property: JsonPropertyName("position")] int Position,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("overdue")] bool Overdue,
    [property: JsonPropertyName("stats")] VersionStatsDto Stats
);

public record ComponentDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("projectKey")] string ProjectKey,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("leadId")] string? LeadId,
    [property: JsonPropertyName("defaultAssignee")] string DefaultAssignee,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("issueCount")] int IssueCount,
    [property: JsonPropertyName("openCount")] int OpenCount
);

public record CreateComponentRequest(
    [property: JsonPropertyName("project")] string? Project,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("leadId")] string? LeadId,
    [property: JsonPropertyName("defaultAssignee")] string? DefaultAssignee
);
