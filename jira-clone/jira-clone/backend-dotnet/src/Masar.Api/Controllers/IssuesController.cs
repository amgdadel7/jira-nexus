using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Application.Features.Issues.Commands;
using Masar.Application.Features.Issues.Queries;
using Masar.Domain.Exceptions;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api")]
public class IssuesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IApplicationDbContext _context;

    public IssuesController(IMediator mediator, IApplicationDbContext context)
    {
        _mediator = mediator;
        _context = context;
    }

    [HttpGet("search")]
    public async Task<ActionResult<SearchResponse>> Search(
        [FromQuery] string? jql,
        [FromQuery] string? project,
        [FromQuery] int? sprint,
        [FromQuery] string? status,
        [FromQuery] string? assignee,
        [FromQuery] int startAt = 0,
        [FromQuery] int maxResults = 50,
        [FromQuery] string? sort = null,
        CancellationToken cancellationToken = default)
    {
        var finalJql = jql;
        if (string.IsNullOrWhiteSpace(finalJql) && !string.IsNullOrEmpty(project))
        {
            finalJql = $"project = {project}";
            if (sprint.HasValue) finalJql += $" AND sprint = {sprint.Value}";
            if (!string.IsNullOrEmpty(status)) finalJql += $" AND status = '{status}'";
            if (!string.IsNullOrEmpty(assignee)) finalJql += $" AND assignee = '{assignee}'";
        }

        var query = new SearchIssuesQuery(finalJql, startAt, maxResults);
        var response = await _mediator.Send(query, cancellationToken);
        return Ok(response);
    }

    [HttpGet("issues/{key}")]
    public async Task<ActionResult<IssueDetailDto>> GetIssueByKey(string key, CancellationToken cancellationToken)
    {
        var issue = await _mediator.Send(new GetIssueByKeyQuery(key), cancellationToken);
        return Ok(issue);
    }

    [HttpPost("issues")]
    public async Task<ActionResult<IssueDto>> CreateIssue([FromBody] CreateIssueRequest request, CancellationToken cancellationToken)
    {
        var issue = await _mediator.Send(new CreateIssueCommand(request), cancellationToken);
        return CreatedAtAction(nameof(GetIssueByKey), new { key = issue.Key }, issue);
    }

    [HttpPatch("issues/{key}")]
    public async Task<ActionResult<IssueDto>> UpdateIssue(string key, [FromBody] UpdateIssueRequest request, CancellationToken cancellationToken)
    {
        var issue = await _mediator.Send(new UpdateIssueCommand(key, request), cancellationToken);
        return Ok(issue);
    }

    [HttpPut("issues/{key}/rank")]
    [HttpPost("issues/{key}/rank")]
    public async Task<ActionResult<IssueDto>> RankIssue(string key, [FromBody] RankIssueRequest request, CancellationToken cancellationToken)
    {
        var issue = await _mediator.Send(new RankIssueCommand(key, request), cancellationToken);
        return Ok(issue);
    }

    [HttpGet("issues/{key}/comments")]
    public async Task<ActionResult<List<CommentDto>>> GetComments(string key, CancellationToken cancellationToken)
    {
        var upperKey = key.ToUpperInvariant();
        var issue = await _context.Issues.FirstOrDefaultAsync(i => i.Key == upperKey, cancellationToken);
        if (issue == null) throw new NotFoundException($"Work item {key} not found.");

        var comments = await _context.Comments
            .Where(c => c.IssueId == issue.Id)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto(c.Id, c.AuthorId, c.Body, c.CreatedAt, c.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(comments);
    }

    [HttpPost("issues/{key}/comments")]
    public async Task<ActionResult<CommentDto>> AddComment(string key, [FromBody] AddCommentRequest request, CancellationToken cancellationToken)
    {
        var comment = await _mediator.Send(new AddCommentCommand(key, request), cancellationToken);
        return Ok(comment);
    }

    [HttpDelete("issues/{key}/comments/{commentId:int}")]
    public async Task<ActionResult> DeleteComment(string key, int commentId, CancellationToken cancellationToken)
    {
        var comment = await _context.Comments.FirstOrDefaultAsync(c => c.Id == commentId, cancellationToken);
        if (comment != null)
        {
            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync(cancellationToken);
        }
        return Ok(new { ok = true });
    }
}
