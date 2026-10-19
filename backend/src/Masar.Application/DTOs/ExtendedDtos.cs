using System.Text.Json.Serialization;

namespace Masar.Application.DTOs;

public record AddProjectMemberRequest(
    [property: JsonPropertyName("userId")] string UserId,
    [property: JsonPropertyName("role")] string Role
);

public record UpdateMemberRoleRequest(
    [property: JsonPropertyName("role")] string Role
);

public record SavePermissionsRequest(
    [property: JsonPropertyName("scheme")] Dictionary<string, List<string>> Scheme
);

public record TeamDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("color")] string Color,
    [property: JsonPropertyName("members")] IEnumerable<UserDto> Members,
    [property: JsonPropertyName("memberCount")] int MemberCount,
    [property: JsonPropertyName("created")] DateTimeOffset Created
);

public record CreateTeamRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("color")] string? Color,
    [property: JsonPropertyName("members")] List<string>? Members
);

public record UpdateTeamRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("color")] string? Color
);

public record TrashItemDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("deletedBy")] string? DeletedBy,
    [property: JsonPropertyName("deleted")] DateTimeOffset Deleted,
    [property: JsonPropertyName("expires")] DateTimeOffset Expires
);

public record AuditLogDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("time")] DateTimeOffset Time,
    [property: JsonPropertyName("author")] UserDto? Author,
    [property: JsonPropertyName("action")] string Action,
    [property: JsonPropertyName("target")] string Target,
    [property: JsonPropertyName("details")] object? Details
);

public record FilterDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("jql")] string Jql,
    [property: JsonPropertyName("owner")] UserDto? Owner,
    [property: JsonPropertyName("starred")] bool Starred,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated
);

public record CreateFilterRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("jql")] string Jql
);

public record UpdateFilterRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("jql")] string? Jql
);

public record GoalDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("owner")] UserDto? Owner,
    [property: JsonPropertyName("targetDate")] DateOnly? TargetDate,
    [property: JsonPropertyName("progress")] double Progress,
    [property: JsonPropertyName("issueCount")] int IssueCount,
    [property: JsonPropertyName("doneIssueCount")] int DoneIssueCount,
    [property: JsonPropertyName("issues")] IEnumerable<IssueDto>? Issues,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated
);

public record CreateGoalRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("ownerId")] string? OwnerId,
    [property: JsonPropertyName("targetDate")] string? TargetDate,
    [property: JsonPropertyName("project")] string? Project
);

public record UpdateGoalRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("status")] string? Status,
    [property: JsonPropertyName("ownerId")] string? OwnerId,
    [property: JsonPropertyName("targetDate")] string? TargetDate
);

public record FormDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("projectKey")] string ProjectKey,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("issueType")] string IssueType,
    [property: JsonPropertyName("fields")] object Fields,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated
);

public record CreateFormRequest(
    [property: JsonPropertyName("projectKey")] string? ProjectKey,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("issueType")] string? IssueType,
    [property: JsonPropertyName("fields")] object? Fields
);

public record SubmitFormRequest(
    [property: JsonPropertyName("values")] Dictionary<string, object> Values
);

public record CustomFieldDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("options")] object? Options,
    [property: JsonPropertyName("searchable")] bool Searchable,
    [property: JsonPropertyName("created")] DateTimeOffset Created
);

public record CreateCustomFieldRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("options")] object? Options
);

public record AutomationRuleDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("projectKey")] string ProjectKey,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("trigger")] string Trigger,
    [property: JsonPropertyName("condition")] string Condition,
    [property: JsonPropertyName("actions")] object Actions,
    [property: JsonPropertyName("createdBy")] UserDto? CreatedBy,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated
);

public record CreateRuleRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("trigger")] string Trigger,
    [property: JsonPropertyName("condition")] string? Condition,
    [property: JsonPropertyName("actions")] object? Actions
);

public record UpdateRuleRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("enabled")] bool? Enabled,
    [property: JsonPropertyName("trigger")] string? Trigger,
    [property: JsonPropertyName("condition")] string? Condition,
    [property: JsonPropertyName("actions")] object? Actions
);

public record AutomationRunDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("ruleId")] int RuleId,
    [property: JsonPropertyName("issueKey")] string? IssueKey,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("durationMs")] int DurationMs,
    [property: JsonPropertyName("created")] DateTimeOffset Created
);

public record WebhookDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("events")] object Events,
    [property: JsonPropertyName("jql")] string Jql,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("createdBy")] UserDto? CreatedBy,
    [property: JsonPropertyName("created")] DateTimeOffset Created,
    [property: JsonPropertyName("updated")] DateTimeOffset Updated
);

public record CreateWebhookRequest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("url")] string Url,
    [property: JsonPropertyName("secret")] string? Secret,
    [property: JsonPropertyName("events")] object? Events,
    [property: JsonPropertyName("jql")] string? Jql
);

public record UpdateWebhookRequest(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("url")] string? Url,
    [property: JsonPropertyName("secret")] string? Secret,
    [property: JsonPropertyName("events")] object? Events,
    [property: JsonPropertyName("jql")] string? Jql,
    [property: JsonPropertyName("enabled")] bool? Enabled
);

public record VelocitySprintDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("committed")] double Committed,
    [property: JsonPropertyName("completed")] double Completed
);

public record VelocityReportDto(
    [property: JsonPropertyName("sprints")] IEnumerable<VelocitySprintDto> Sprints,
    [property: JsonPropertyName("average")] double Average
);
