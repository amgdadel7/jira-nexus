namespace Masar.Domain.Entities;

public class IssueType
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "task";
    public string Color { get; set; } = "#4BADE8";
    public int HierarchyLevel { get; set; } = 0; // 1 = epic, 0 = standard, -1 = subtask
    public int Position { get; set; }
    public bool System { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Status
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "todo"; // todo, in_progress, done
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Priority
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Color { get; set; } = "#626F86";
    public string Icon { get; set; } = "medium";
    public int Position { get; set; }
    public bool IsDefault { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Resolution
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Position { get; set; }
    public bool IsDefault { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Workflow
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsDefault { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<WorkflowStatus> Statuses { get; set; } = new List<WorkflowStatus>();
    public ICollection<WorkflowTransition> Transitions { get; set; } = new List<WorkflowTransition>();
}

public class WorkflowStatus
{
    public int WorkflowId { get; set; }
    public Workflow? Workflow { get; set; }
    public int StatusId { get; set; }
    public Status? Status { get; set; }
    public int Position { get; set; }
    public bool IsInitial { get; set; }
}

public class WorkflowTransition
{
    public int Id { get; set; }
    public int WorkflowId { get; set; }
    public Workflow? Workflow { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? FromStatusId { get; set; }
    public int ToStatusId { get; set; }
    public int Position { get; set; }
}
