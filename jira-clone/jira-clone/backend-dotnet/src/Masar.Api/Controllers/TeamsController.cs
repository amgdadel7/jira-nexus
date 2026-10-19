using MediatR;
using Microsoft.AspNetCore.Mvc;
using Masar.Application.DTOs;
using Masar.Application.Features.Projects;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api/teams")]
public class TeamsController : ControllerBase
{
    private readonly IMediator _mediator;

    public TeamsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeamDto>>> GetTeams(CancellationToken cancellationToken)
    {
        var teams = await _mediator.Send(new GetTeamsQuery(), cancellationToken);
        return Ok(teams);
    }

    [HttpPost]
    public async Task<ActionResult<TeamDto>> CreateTeam([FromBody] CreateTeamRequest request, CancellationToken cancellationToken)
    {
        var team = await _mediator.Send(new CreateTeamCommand(request), cancellationToken);
        return Ok(team);
    }
}
