using MediatR;
using Microsoft.AspNetCore.Mvc;
using Masar.Application.DTOs;
using Masar.Application.Features.Planning;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api")]
public class PlanningController : ControllerBase
{
    private readonly IMediator _mediator;

    public PlanningController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("sprints")]
    public async Task<ActionResult<List<SprintDto>>> GetSprints([FromQuery] string? projectKey, [FromQuery] string? state, CancellationToken cancellationToken)
    {
        var sprints = await _mediator.Send(new GetSprintsQuery(projectKey, state), cancellationToken);
        return Ok(sprints);
    }

    [HttpGet("versions")]
    public async Task<ActionResult<List<VersionDto>>> GetVersions([FromQuery] string? projectKey, CancellationToken cancellationToken)
    {
        var versions = await _mediator.Send(new GetVersionsQuery(projectKey), cancellationToken);
        return Ok(versions);
    }

    [HttpGet("components")]
    public async Task<ActionResult<List<ComponentDto>>> GetComponents([FromQuery] string? projectKey, CancellationToken cancellationToken)
    {
        var components = await _mediator.Send(new GetComponentsQuery(projectKey), cancellationToken);
        return Ok(components);
    }

    [HttpPost("sprints")]
    public async Task<ActionResult<SprintDto>> CreateSprint([FromBody] CreateSprintRequest request, CancellationToken cancellationToken)
    {
        var sprint = await _mediator.Send(new CreateSprintCommand(request), cancellationToken);
        return Ok(sprint);
    }

    [HttpPatch("sprints/{id:int}")]
    public async Task<ActionResult<SprintDto>> UpdateSprint(int id, [FromBody] UpdateSprintRequest request, CancellationToken cancellationToken)
    {
        var sprint = await _mediator.Send(new UpdateSprintCommand(id, request), cancellationToken);
        return Ok(sprint);
    }

    [HttpPost("sprints/{id:int}/start")]
    public async Task<ActionResult<SprintDto>> StartSprint(int id, CancellationToken cancellationToken)
    {
        var sprint = await _mediator.Send(new StartSprintCommand(id), cancellationToken);
        return Ok(sprint);
    }

    [HttpPost("sprints/{id:int}/complete")]
    public async Task<ActionResult<SprintDto>> CompleteSprint(int id, CancellationToken cancellationToken)
    {
        var sprint = await _mediator.Send(new CompleteSprintCommand(id), cancellationToken);
        return Ok(sprint);
    }

    [HttpGet("reports/velocity")]
    public async Task<ActionResult<VelocityReportDto>> GetVelocityReport([FromQuery] string? project, CancellationToken cancellationToken)
    {
        var report = await _mediator.Send(new GetVelocityReportQuery(project), cancellationToken);
        return Ok(report);
    }
}
