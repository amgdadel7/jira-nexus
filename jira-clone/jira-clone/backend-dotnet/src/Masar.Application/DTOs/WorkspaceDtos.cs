using System.Text.Json.Serialization;

namespace Masar.Application.DTOs;

public record WorkflowStatusDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("isInitial")] bool IsInitial
);

public record WorkflowDto(
    [property: JsonPropertyName("id")] int Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("statuses")] IEnumerable<WorkflowStatusDto> Statuses,
    [property: JsonPropertyName("transitions")] IEnumerable<object> Transitions
);

public record WorkspaceMetaResponse(
    [property: JsonPropertyName("users")] IEnumerable<UserDto> Users,
    [property: JsonPropertyName("currentUserId")] string CurrentUserId,
    [property: JsonPropertyName("currentUser")] UserDto CurrentUser,
    [property: JsonPropertyName("globalPermissions")] IEnumerable<string> GlobalPermissions,
    [property: JsonPropertyName("plan")] object Plan,
    [property: JsonPropertyName("project")] object? Project,
    [property: JsonPropertyName("projects")] IEnumerable<object> Projects,
    [property: JsonPropertyName("denied")] string? Denied,
    [property: JsonPropertyName("myRole")] string? MyRole,
    [property: JsonPropertyName("myRoleLabel")] string? MyRoleLabel,
    [property: JsonPropertyName("permissions")] IEnumerable<string> Permissions,
    [property: JsonPropertyName("components")] IEnumerable<object> Components,
    [property: JsonPropertyName("teams")] IEnumerable<object> Teams,
    [property: JsonPropertyName("versions")] IEnumerable<object> Versions,
    [property: JsonPropertyName("activeSprint")] object? ActiveSprint,
    [property: JsonPropertyName("sprints")] IEnumerable<string> Sprints,
    [property: JsonPropertyName("labels")] IEnumerable<string> Labels,
    [property: JsonPropertyName("repos")] IEnumerable<string> Repos,
    [property: JsonPropertyName("statuses")] IEnumerable<string> Statuses,
    [property: JsonPropertyName("priorities")] IEnumerable<string> Priorities,
    [property: JsonPropertyName("types")] IEnumerable<string> Types,
    [property: JsonPropertyName("workflow")] WorkflowDto? Workflow,
    [property: JsonPropertyName("typeDetails")] IEnumerable<object> TypeDetails,
    [property: JsonPropertyName("priorityDetails")] IEnumerable<object> PriorityDetails,
    [property: JsonPropertyName("resolutions")] IEnumerable<object> Resolutions,
    [property: JsonPropertyName("customFields")] IEnumerable<object> CustomFields,
    [property: JsonPropertyName("linkTypes")] IEnumerable<object> LinkTypes,
    [property: JsonPropertyName("goalStatuses")] IEnumerable<string> GoalStatuses
);

public record QuickSearchResponse(
    [property: JsonPropertyName("issues")] IEnumerable<IssueDto> Issues,
    [property: JsonPropertyName("filters")] IEnumerable<object> Filters,
    [property: JsonPropertyName("users")] IEnumerable<UserDto> Users
);
