namespace Masar.Domain.Entities;

public class Project
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "software";
    public string Description { get; set; } = string.Empty;
    public string? LeadId { get; set; }
    public User? Lead { get; set; }
    public string Color { get; set; } = "#FFAB00";
    public string Category { get; set; } = string.Empty;
    public string Access { get; set; } = "open"; // open, limited, private
    public int WorkflowId { get; set; }
    public bool CustomPermissions { get; set; } = false;
    public string BoardSwimlanes { get; set; } = "none";
    public int NextNum { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
    public ICollection<Component> Components { get; set; } = new List<Component>();
    public ICollection<Sprint> Sprints { get; set; } = new List<Sprint>();
    public ICollection<Version> Versions { get; set; } = new List<Version>();
    public ICollection<Issue> Issues { get; set; } = new List<Issue>();
}

public class ProjectMember
{
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
    public string Role { get; set; } = "member"; // admin, member, viewer
    public string? AddedBy { get; set; }
    public DateTimeOffset AddedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ProjectStar
{
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public DateTimeOffset StarredAt { get; set; } = DateTimeOffset.UtcNow;
}

public class PermissionSchemeEntry
{
    public string ProjectKey { get; set; } = string.Empty;
    public string Permission { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
