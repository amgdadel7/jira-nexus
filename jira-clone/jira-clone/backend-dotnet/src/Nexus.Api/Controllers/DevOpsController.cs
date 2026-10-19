using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/devops")]
public class DevOpsController(NexusDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet("repositories")]
    public async Task<IActionResult> GetRepositories(CancellationToken ct)
    {
        var repos = await db.GitRepositories
            .Where(x => x.OrganizationId == current.OrganizationId)
            .ToListAsync(ct);
        return Ok(repos);
    }

    [HttpGet("pull-requests")]
    public async Task<IActionResult> GetPullRequests([FromQuery] string? issueKey, CancellationToken ct)
    {
        var prs = await db.GitPullRequests
            .Where(x => string.IsNullOrEmpty(issueKey) || x.IssueKey == issueKey)
            .OrderByDescending(x => x.UpdatedAt)
            .ToListAsync(ct);
        return Ok(prs);
    }

    [HttpGet("dora")]
    public IActionResult GetDoraMetrics()
    {
        return Ok(new
        {
            DeploymentFrequency = new { Value = 1.8, Unit = "per day", Tier = "Elite" },
            LeadTimeForChanges = new { Value = 3.4, Unit = "hours", Tier = "High" },
            ChangeFailureRate = new { Value = 1.6, Unit = "percent", Tier = "Elite" },
            TimeToRestore = new { Value = 28, Unit = "minutes", Tier = "Elite" }
        });
    }
}
