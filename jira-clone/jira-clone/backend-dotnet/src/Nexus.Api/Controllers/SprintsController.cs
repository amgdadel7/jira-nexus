using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/sprints")]
public class SprintsController(NexusDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid projectId, CancellationToken ct)
        => Ok(await db.Sprints.AsNoTracking().Where(s => s.ProjectId == projectId).ToListAsync(ct));

    [HttpPost("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sprint is null) return NotFound();
        sprint.Status = "active";
        await db.SaveChangesAsync(ct);
        return Ok(sprint);
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sprint is null) return NotFound();
        sprint.Status = "completed";
        await db.SaveChangesAsync(ct);
        return Ok(sprint);
    }
}
