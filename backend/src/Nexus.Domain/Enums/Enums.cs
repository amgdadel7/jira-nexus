namespace Nexus.Domain.Enums;

public enum IssueType { Epic, Story, Task, Bug, Subtask }
public enum IssueStatus { Backlog, Todo, InProgress, Review, Testing, Done }
public enum Priority { Lowest, Low, Medium, High, Critical }
public enum ProjectStatus { Active, OnHold, Archived }
public enum SprintStatus { Planned, Active, Completed }
public enum Presence { Active, Away, Offline }
