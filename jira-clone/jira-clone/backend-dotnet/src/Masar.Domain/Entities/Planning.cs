namespace Masar.Domain.Entities;

public class Component
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LeadId { get; set; }
    public User? Lead { get; set; }
    public string DefaultAssignee { get; set; } = "unassigned"; // unassigned, component_lead, project_lead
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Sprint
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Goal { get; set; } = string.Empty;
    public string State { get; set; } = "future"; // future, active, closed
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public int Position { get; set; }
    public double? CommittedPoints { get; set; }
    public int? CommittedCount { get; set; }
    public double? CompletedPoints { get; set; }
    public int? CompletedCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Version
{
    public int Id { get; set; }
    public string ProjectKey { get; set; } = string.Empty;
    public Project? Project { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "unreleased"; // unreleased, released, archived
    public DateOnly? StartDate { get; set; }
    public DateOnly? ReleaseDate { get; set; }
    public DateTimeOffset? ReleasedAt { get; set; }
    public int Position { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Team
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = "#0C66E4";
    public string? CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
}

public class TeamMember
{
    public int TeamId { get; set; }
    public Team? Team { get; set; }
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
}
