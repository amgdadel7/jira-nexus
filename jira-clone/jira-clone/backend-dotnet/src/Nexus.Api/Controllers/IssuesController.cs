using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Application.Issues;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/issues")]
public class IssuesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] Guid projectId, [FromQuery] string? status, [FromQuery] string? q, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
        => Ok(await mediator.Send(new GetIssuesQuery(projectId, status, q, page, pageSize), ct));

    [HttpPost]
    public async Task<IActionResult> Create(CreateIssueCommand cmd, CancellationToken ct)
    {
        var result = await mediator.Send(cmd, ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveBody body, CancellationToken ct)
    {
        var result = await mediator.Send(new MoveIssueCommand(id, body.Status, body.Rank), ct);
        return result.Succeeded ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }

    public record MoveBody(string Status, decimal? Rank);
}
