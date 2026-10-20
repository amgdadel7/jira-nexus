using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Application.Features.Workspace;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api")]
public class WorkspaceController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public WorkspaceController(
        IMediator mediator,
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _mediator = mediator;
        _context = context;
        _currentUserService = currentUserService;
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

    [HttpGet("activity")]
    public async Task<ActionResult> GetActivity(
        [FromQuery] int limit = 30,
        [FromQuery] string? project = null,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var projUpper = project?.ToUpperInvariant();

        var historyItems = await _context.HistoryEntries
            .Include(h => h.Issue)
                .ThenInclude(i => i!.IssueType)
            .Include(h => h.Issue)
                .ThenInclude(i => i!.Status)
            .Where(h => h.Issue != null && (projUpper == null || h.Issue.ProjectKey == projUpper))
            .OrderByDescending(h => h.CreatedAt)
            .Take(limit)
            .Select(h => new
            {
                kind = "history",
                id = h.Id,
                authorId = h.AuthorId,
                field = (string?)h.Field,
                from = h.FromValue,
                to = h.ToValue,
                body = (string?)null,
                created = h.CreatedAt,
                key = h.Issue!.Key,
                summary = h.Issue.Summary,
                type = h.Issue.IssueType != null ? h.Issue.IssueType.Name.ToLower() : "task",
                status = h.Issue.Status != null ? h.Issue.Status.Name : "To Do"
            })
            .ToListAsync(cancellationToken);

        var commentItems = await _context.Comments
            .Include(c => c.Issue)
                .ThenInclude(i => i!.IssueType)
            .Include(c => c.Issue)
                .ThenInclude(i => i!.Status)
            .Where(c => c.Issue != null && (projUpper == null || c.Issue.ProjectKey == projUpper))
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .Select(c => new
            {
                kind = "comment",
                id = c.Id,
                authorId = c.AuthorId,
                field = (string?)null,
                from = (string?)null,
                to = (string?)null,
                body = (string?)c.Body,
                created = c.CreatedAt,
                key = c.Issue!.Key,
                summary = c.Issue.Summary,
                type = c.Issue.IssueType != null ? c.Issue.IssueType.Name.ToLower() : "task",
                status = c.Issue.Status != null ? c.Issue.Status.Name : "To Do"
            })
            .ToListAsync(cancellationToken);

        var combined = historyItems
            .Concat(commentItems)
            .OrderByDescending(x => x.created)
            .Take(limit);

        return Ok(combined);
    }

    [HttpGet("me/worked-on")]
    public async Task<ActionResult> GetWorkedOn(CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId))
        {
            return Ok(new { issues = Array.Empty<object>() });
        }

        var issueIdsFromHistory = await _context.HistoryEntries
            .Where(h => h.AuthorId == userId)
            .Select(h => h.IssueId)
            .Distinct()
            .Take(50)
            .ToListAsync(cancellationToken);

        var issueIdsFromComments = await _context.Comments
            .Where(c => c.AuthorId == userId)
            .Select(c => c.IssueId)
            .Distinct()
            .Take(50)
            .ToListAsync(cancellationToken);

        var allIssueIds = issueIdsFromHistory.Union(issueIdsFromComments).Distinct().ToList();

        var issues = await _context.Issues
            .Include(i => i.IssueType)
            .Include(i => i.Status)
            .Include(i => i.Priority)
            .Where(i => allIssueIds.Contains(i.Id))
            .OrderByDescending(i => i.UpdatedAt)
            .Take(50)
            .Select(i => new
            {
                id = i.Id,
                key = i.Key,
                summary = i.Summary,
                type = i.IssueType != null ? i.IssueType.Name.ToLower() : "task",
                status = i.Status != null ? i.Status.Name : "To Do",
                priority = i.Priority != null ? i.Priority.Name : "Medium",
                assigneeId = i.AssigneeId,
                lastActivity = i.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(new { issues });
    }
}
