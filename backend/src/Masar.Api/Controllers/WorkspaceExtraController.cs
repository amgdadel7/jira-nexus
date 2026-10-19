using MediatR;
using Microsoft.AspNetCore.Mvc;
using Masar.Application.DTOs;
using Masar.Application.Features.Projects;
using Masar.Application.Features.Workspace;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api")]
public class WorkspaceExtraController : ControllerBase
{
    private readonly IMediator _mediator;

    public WorkspaceExtraController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // ---------- Filters ----------
    [HttpGet("filters")]
    public async Task<ActionResult<IEnumerable<FilterDto>>> GetFilters(CancellationToken cancellationToken)
    {
        var filters = await _mediator.Send(new GetFiltersQuery(), cancellationToken);
        return Ok(filters);
    }

    [HttpPost("filters")]
    public async Task<ActionResult<FilterDto>> CreateFilter([FromBody] CreateFilterRequest request, CancellationToken cancellationToken)
    {
        var filter = await _mediator.Send(new CreateFilterCommand(request), cancellationToken);
        return Ok(filter);
    }

    // ---------- Goals ----------
    [HttpGet("goals")]
    public async Task<ActionResult<IEnumerable<GoalDto>>> GetGoals([FromQuery] string? project, CancellationToken cancellationToken)
    {
        var goals = await _mediator.Send(new GetGoalsQuery(project), cancellationToken);
        return Ok(goals);
    }

    [HttpPost("goals")]
    public async Task<ActionResult<GoalDto>> CreateGoal([FromBody] CreateGoalRequest request, CancellationToken cancellationToken)
    {
        var goal = await _mediator.Send(new CreateGoalCommand(request), cancellationToken);
        return Ok(goal);
    }

    // ---------- Forms ----------
    [HttpGet("forms")]
    public async Task<ActionResult<IEnumerable<FormDto>>> GetForms([FromQuery] string? project, CancellationToken cancellationToken)
    {
        var forms = await _mediator.Send(new GetFormsQuery(project), cancellationToken);
        return Ok(forms);
    }

    // ---------- Custom Fields ----------
    [HttpGet("custom-fields")]
    public async Task<ActionResult<IEnumerable<CustomFieldDto>>> GetCustomFields(CancellationToken cancellationToken)
    {
        var fields = await _mediator.Send(new GetCustomFieldsQuery(), cancellationToken);
        return Ok(fields);
    }

    // ---------- Trash ----------
    [HttpGet("trash")]
    public async Task<ActionResult<IEnumerable<TrashItemDto>>> GetTrash([FromQuery] string? project, CancellationToken cancellationToken)
    {
        var items = await _mediator.Send(new GetTrashQuery(project), cancellationToken);
        return Ok(items);
    }

    // ---------- Audit Log ----------
    [HttpGet("audit")]
    public async Task<ActionResult<IEnumerable<AuditLogDto>>> GetAudit([FromQuery] string? project, CancellationToken cancellationToken)
    {
        var logs = await _mediator.Send(new GetAuditLogQuery(project), cancellationToken);
        return Ok(logs);
    }

    // ---------- Webhooks ----------
    [HttpGet("admin/webhooks")]
    public async Task<ActionResult<IEnumerable<WebhookDto>>> GetWebhooks(CancellationToken cancellationToken)
    {
        var webhooks = await _mediator.Send(new GetWebhooksQuery(), cancellationToken);
        return Ok(webhooks);
    }
}
