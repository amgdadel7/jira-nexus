using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/automations")]
public class AutomationsController(NexusDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> ListRules([FromQuery] Guid projectId, CancellationToken ct)
    {
        var rules = await db.AutomationRules
            .Where(x => projectId == Guid.Empty || x.ProjectId == projectId)
            .ToListAsync(ct);
        return Ok(rules);
    }

    [HttpPost]
    public async Task<IActionResult> CreateRule([FromBody] CreateRuleDto dto, CancellationToken ct)
    {
        var rule = new AutomationRule
        {
            Id = Guid.NewGuid(),
            ProjectId = dto.ProjectId,
            Name = dto.Name,
            TriggerType = dto.TriggerType,
            ActionsJson = dto.ActionsJson ?? "[]",
            IsEnabled = true
        };
        db.AutomationRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return Ok(rule);
    }

    [HttpPatch("{ruleId:guid}/toggle")]
    public async Task<IActionResult> ToggleRule(Guid ruleId, CancellationToken ct)
    {
        var rule = await db.AutomationRules.FirstOrDefaultAsync(x => x.Id == ruleId, ct);
        if (rule == null) return NotFound();
        rule.IsEnabled = !rule.IsEnabled;
        await db.SaveChangesAsync(ct);
        return Ok(rule);
    }

    public record CreateRuleDto(Guid ProjectId, string Name, string TriggerType, string? ActionsJson);
}
