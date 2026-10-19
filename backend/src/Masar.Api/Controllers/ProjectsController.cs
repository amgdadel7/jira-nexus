using MediatR;
using Microsoft.AspNetCore.Mvc;
using Masar.Application.DTOs;
using Masar.Application.Features.Projects;
using Masar.Application.Features.Projects.Commands;
using Masar.Application.Features.Projects.Queries;
using Masar.Application.Features.Workspace;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IMediator _mediator;

    public ProjectsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProjectDto>>> GetProjects([FromQuery] string? q, CancellationToken cancellationToken)
    {
        var projects = await _mediator.Send(new GetProjectsQuery(q), cancellationToken);
        return Ok(projects);
    }

    [HttpGet("{key}")]
    public async Task<ActionResult<ProjectDto>> GetProjectByKey(string key, CancellationToken cancellationToken)
    {
        var project = await _mediator.Send(new GetProjectByKeyQuery(key), cancellationToken);
        return Ok(project);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> CreateProject([FromBody] CreateProjectRequest request, CancellationToken cancellationToken)
    {
        var project = await _mediator.Send(new CreateProjectCommand(request), cancellationToken);
        return CreatedAtAction(nameof(GetProjectByKey), new { key = project.Key }, project);
    }

    [HttpPatch("{key}")]
    public async Task<ActionResult<ProjectDto>> UpdateProject(string key, [FromBody] UpdateProjectRequest request, CancellationToken cancellationToken)
    {
        var project = await _mediator.Send(new UpdateProjectCommand(key, request), cancellationToken);
        return Ok(project);
    }

    [HttpGet("{key}/members")]
    public async Task<ActionResult<ProjectMembersResponse>> GetProjectMembers(string key, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetProjectMembersQuery(key), cancellationToken);
        return Ok(result);
    }

    [HttpPost("{key}/members")]
    public async Task<ActionResult<ProjectMemberItemDto>> AddProjectMember(string key, [FromBody] AddProjectMemberRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new AddProjectMemberCommand(key, request), cancellationToken);
        return Ok(result);
    }

    [HttpDelete("{key}/members/{userId}")]
    public async Task<ActionResult> RemoveProjectMember(string key, string userId, CancellationToken cancellationToken)
    {
        await _mediator.Send(new RemoveProjectMemberCommand(key, userId), cancellationToken);
        return Ok(new { ok = true });
    }

    [HttpGet("{key}/permissions")]
    public async Task<ActionResult> GetProjectPermissions(string key, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetProjectPermissionsQuery(key), cancellationToken);
        return Ok(result);
    }

    [HttpGet("{key}/automation")]
    public async Task<ActionResult> GetProjectAutomation(string key, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetAutomationRulesQuery(key), cancellationToken);
        return Ok(result);
    }
}
