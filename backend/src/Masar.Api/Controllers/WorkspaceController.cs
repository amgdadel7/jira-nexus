using MediatR;
using Microsoft.AspNetCore.Mvc;
using Masar.Application.DTOs;
using Masar.Application.Features.Workspace;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api")]
public class WorkspaceController : ControllerBase
{
    private readonly IMediator _mediator;

    public WorkspaceController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("meta")]
    public async Task<ActionResult<WorkspaceMetaResponse>> GetMeta([FromQuery] string? projectKey, CancellationToken cancellationToken)
    {
        var meta = await _mediator.Send(new GetWorkspaceMetaQuery(projectKey), cancellationToken);
        return Ok(meta);
    }

    [HttpGet("quicksearch")]
    public async Task<ActionResult<QuickSearchResponse>> QuickSearch([FromQuery] string? q, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new QuickSearchQuery(q ?? string.Empty), cancellationToken);
        return Ok(result);
    }
}
