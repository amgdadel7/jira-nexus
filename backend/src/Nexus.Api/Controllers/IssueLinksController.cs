using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/issues/{issueId:guid}")]
public class IssueLinksController(NexusDbContext db, ICurrentUser current) : ControllerBase
{
    [HttpGet("links")]
    public async Task<IActionResult> GetLinks(Guid issueId, CancellationToken ct)
    {
        var links = await db.IssueLinks
            .Where(x => x.SourceIssueId == issueId || x.TargetIssueId == issueId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);
        return Ok(links);
    }

    [HttpPost("links")]
    public async Task<IActionResult> CreateLink(Guid issueId, [FromBody] CreateLinkDto dto, CancellationToken ct)
    {
        var link = new IssueLink
        {
            Id = Guid.NewGuid(),
            SourceIssueId = issueId,
            TargetIssueId = dto.TargetIssueId,
            LinkType = dto.LinkType,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.IssueLinks.Add(link);
        await db.SaveChangesAsync(ct);
        return Ok(link);
    }

    [HttpDelete("links/{linkId:guid}")]
    public async Task<IActionResult> DeleteLink(Guid issueId, Guid linkId, CancellationToken ct)
    {
        var link = await db.IssueLinks.FirstOrDefaultAsync(x => x.Id == linkId, ct);
        if (link == null) return NotFound();
        db.IssueLinks.Remove(link);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("watch")]
    public async Task<IActionResult> Watch(Guid issueId, CancellationToken ct)
    {
        var exists = await db.IssueWatchers.AnyAsync(x => x.IssueId == issueId && x.UserId == current.UserId, ct);
        if (!exists)
        {
            db.IssueWatchers.Add(new IssueWatcher
            {
                IssueId = issueId,
                UserId = current.UserId,
                CreatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync(ct);
        }
        return Ok(new { watching = true, issueId });
    }

    [HttpDelete("watch")]
    public async Task<IActionResult> Unwatch(Guid issueId, CancellationToken ct)
    {
        var watcher = await db.IssueWatchers.FirstOrDefaultAsync(x => x.IssueId == issueId && x.UserId == current.UserId, ct);
        if (watcher != null)
        {
            db.IssueWatchers.Remove(watcher);
            await db.SaveChangesAsync(ct);
        }
        return Ok(new { watching = false, issueId });
    }

    public record CreateLinkDto(Guid TargetIssueId, string LinkType);
}
