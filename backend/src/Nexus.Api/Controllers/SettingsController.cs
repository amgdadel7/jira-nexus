using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/settings")]
public class SettingsController(NexusDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet("work-types")]
    public async Task<IActionResult> GetWorkTypes(CancellationToken ct)
    {
        var dbTypes = await db.WorkTypes
            .Where(x => x.OrganizationId == current.OrganizationId)
            .ToListAsync(ct);

        if (dbTypes.Count == 0)
        {
            return Ok(new[]
            {
                new { Id = "wt_epic", Name = "Epic", Description = "A big goal or large body of work that can be broken down into stories, bugs, or tasks.", HierarchyLevel = 1, Icon = "⚡", Color = "#8777D9", IsSubtask = false, SchemesCount = 2 },
                new { Id = "wt_story", Name = "Story", Description = "User-facing feature or functional increment.", HierarchyLevel = 0, Icon = "🟢", Color = "#36B37E", IsSubtask = false, SchemesCount = 2 },
                new { Id = "wt_task", Name = "Task", Description = "Technical or operational task to be completed.", HierarchyLevel = 0, Icon = "🔵", Color = "#0052CC", IsSubtask = false, SchemesCount = 2 },
                new { Id = "wt_bug", Name = "Bug", Description = "An error, defect, or unexpected behavior in the system.", HierarchyLevel = 0, Icon = "🔴", Color = "#FF5630", IsSubtask = false, SchemesCount = 2 },
                new { Id = "wt_subtask", Name = "Sub-task", Description = "A small piece of work required to complete another work item.", HierarchyLevel = -1, Icon = "↳", Color = "#4BADE8", IsSubtask = true, SchemesCount = 2 }
            });
        }

        return Ok(dbTypes);
    }

    [HttpPost("work-types")]
    public async Task<IActionResult> CreateWorkType([FromBody] CreateWorkTypeDto dto, CancellationToken ct)
    {
        var workType = new WorkType
        {
            Id = Guid.NewGuid(),
            OrganizationId = current.OrganizationId,
            Name = dto.Name,
            Description = dto.Description,
            HierarchyLevel = dto.HierarchyLevel,
            Icon = dto.Icon ?? "🔵",
            Color = dto.Color ?? "#0052CC",
            IsSubtask = dto.HierarchyLevel < 0,
            SchemesCount = 1
        };

        db.WorkTypes.Add(workType);
        await db.SaveChangesAsync(ct);
        return Ok(workType);
    }

    [HttpGet("work-type-schemes")]
    public IActionResult GetWorkTypeSchemes()
    {
        return Ok(new[]
        {
            new
            {
                Id = "wts_kan",
                Name = "KAN: Kanban Issue Type Scheme",
                Description = "Default issue type scheme for Kanban projects.",
                WorkTypes = new[] { "Epic", "Story", "Task", "Bug", "Sub-task" },
                Projects = new[] { "My Team (KAN)" },
                IsDefault = true
            },
            new
            {
                Id = "wts_discovery",
                Name = "Product Discovery Scheme",
                Description = "Issue types tailored for problem validation and user research.",
                WorkTypes = new[] { "Idea", "Opportunity", "Problem", "Insight" },
                Projects = new[] { "My discovery project" },
                IsDefault = false
            }
        });
    }

    [HttpGet("sub-tasks")]
    public IActionResult GetSubTaskSettings()
    {
        return Ok(new
        {
            SubTasksEnabled = true,
            SubTaskTypes = new[]
            {
                new { Id = "wt_subtask", Name = "Sub-task", Icon = "↳", Color = "#4BADE8" }
            },
            BlockParentProgressionIfIncomplete = false
        });
    }

    [HttpGet("custom-fields")]
    public async Task<IActionResult> GetCustomFields(CancellationToken ct)
    {
        var fields = await db.CustomFields
            .Where(x => x.OrganizationId == current.OrganizationId)
            .ToListAsync(ct);

        if (fields.Count == 0)
        {
            return Ok(new[]
            {
                new { Id = Guid.NewGuid(), Name = "Story Points", FieldType = "number", Description = "Estimation points for sprint velocity", ScreensCount = 3 },
                new { Id = Guid.NewGuid(), Name = "Severity", FieldType = "select", Description = "Client impact severity level", ScreensCount = 2 },
                new { Id = Guid.NewGuid(), Name = "Environment", FieldType = "text", Description = "Operating system and browser version", ScreensCount = 2 },
                new { Id = Guid.NewGuid(), Name = "Sprint", FieldType = "sprint_picker", Description = "Sprint allocation and tracking", ScreensCount = 3 }
            });
        }

        return Ok(fields);
    }

    [HttpPost("custom-fields")]
    public async Task<IActionResult> CreateCustomField([FromBody] CreateFieldDto dto, CancellationToken ct)
    {
        var field = new CustomField
        {
            Id = Guid.NewGuid(),
            OrganizationId = current.OrganizationId,
            Name = dto.Name,
            FieldType = dto.FieldType,
            Description = dto.Description,
            ScreensCount = 1
        };
        db.CustomFields.Add(field);
        await db.SaveChangesAsync(ct);
        return Ok(field);
    }

    [HttpGet("time-tracking")]
    public IActionResult GetTimeTrackingConfig()
    {
        return Ok(new
        {
            HoursPerDay = 8,
            DaysPerWeek = 5,
            DefaultUnit = "minute",
            CopyEstimateToRemaining = true
        });
    }

    [HttpPut("time-tracking")]
    public IActionResult UpdateTimeTrackingConfig([FromBody] TimeTrackingConfigDto dto)
    {
        return Ok(new
        {
            HoursPerDay = dto.HoursPerDay,
            DaysPerWeek = dto.DaysPerWeek,
            DefaultUnit = dto.DefaultUnit,
            CopyEstimateToRemaining = dto.CopyEstimateToRemaining,
            UpdatedAt = DateTime.UtcNow
        });
    }

    public record CreateWorkTypeDto(string Name, string? Description, int HierarchyLevel, string? Icon, string? Color);
    public record CreateFieldDto(string Name, string FieldType, string? Description);
    public record TimeTrackingConfigDto(int HoursPerDay, int DaysPerWeek, string DefaultUnit, bool CopyEstimateToRemaining);
}
