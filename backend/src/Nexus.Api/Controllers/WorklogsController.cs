using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/issues/{issueId:guid}/worklogs")]
public class WorklogsController(NexusDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetWorklogs(Guid issueId, CancellationToken ct)
    {
        var logs = await db.Worklogs
            .Where(x => x.IssueId == issueId)
            .OrderByDescending(x => x.StartedAt)
            .ToListAsync(ct);
        return Ok(logs);
    }

    [HttpPost]
    public async Task<IActionResult> LogWork(Guid issueId, [FromBody] LogWorkDto dto, CancellationToken ct)
    {
        var log = new Worklog
        {
            Id = Guid.NewGuid(),
            IssueId = issueId,
            AuthorId = current.UserId,
            TimeSpentSeconds = dto.TimeSpentSeconds,
            StartedAt = dto.StartedAt ?? DateTimeOffset.UtcNow,
            Description = dto.Description,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.Worklogs.Add(log);
        await db.SaveChangesAsync(ct);
        return Ok(log);
    }

    public record LogWorkDto(int TimeSpentSeconds, string? Description, DateTimeOffset? StartedAt);
}
