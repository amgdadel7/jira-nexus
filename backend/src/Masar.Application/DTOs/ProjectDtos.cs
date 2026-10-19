using System.Text.Json.Serialization;

namespace Masar.Application.DTOs;

public record ProjectStatsDto(
    [property: JsonPropertyName("total")] int Total,
    [property: JsonPropertyName("done")] int Done,
    [property: JsonPropertyName("open")] int Open,
    [property: JsonPropertyName("lastActivity")] DateTimeOffset? LastActivity
);

public record ProjectDto(
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("leadId")] string? LeadId,
    [property: JsonPropertyName("color")] string Color,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("access")] string Access,
    [property: JsonPropertyName("workflowId")] int WorkflowId,
    [property: JsonPropertyName("myRole")] string? MyRole,
    [property: JsonPropertyName("members")] int Members,
    [property: JsonPropertyName("starred")] bool Starred,
    [property: JsonPropertyName("stats")] ProjectStatsDto Stats
);

public record CreateProjectRequest(
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("type")] string? Type,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("color")] string? Color,
    [property: JsonPropertyName("leadId")] string? LeadId,
    [property: JsonPropertyName("access")] string? Access
);

public record UpdateProjectRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("leadId")] string? LeadId,
    [property: JsonPropertyName("color")] string? Color,
    [property: JsonPropertyName("access")] string? Access
);

public record ProjectMemberItemDto(
    [property: JsonPropertyName("user")] UserDto User,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("effectiveRole")] string EffectiveRole,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("explicit")] bool Explicit,
    [property: JsonPropertyName("addedBy")] string? AddedBy,
    [property: JsonPropertyName("added")] DateTimeOffset? Added
);

public record ProjectMembersResponse(
    [property: JsonPropertyName("project")] object Project,
    [property: JsonPropertyName("roles")] object[] Roles,
    [property: JsonPropertyName("everyoneElse")] string? EveryoneElse,
    [property: JsonPropertyName("people")] IEnumerable<ProjectMemberItemDto> People,
    [property: JsonPropertyName("canManage")] bool CanManage,
    [property: JsonPropertyName("planLocked")] bool PlanLocked
);
