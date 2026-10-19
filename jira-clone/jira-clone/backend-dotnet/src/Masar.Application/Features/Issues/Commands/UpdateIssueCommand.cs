using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Application.Features.Issues.Queries;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Issues.Commands;

public record UpdateIssueCommand(string Key, UpdateIssueRequest Request) : IRequest<IssueDto>;

public class UpdateIssueCommandHandler : IRequestHandler<UpdateIssueCommand, IssueDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public UpdateIssueCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IssueDto> Handle(UpdateIssueCommand request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var issue = await _context.Issues.FirstOrDefaultAsync(i => i.Key == key, cancellationToken);

        if (issue == null)
            throw new NotFoundException($"Work item {key} not found.");

        var req = request.Request;

        if (req.Summary != null)
        {
            if (string.IsNullOrWhiteSpace(req.Summary))
                throw new ValidationException("Summary is required.");
            issue.Summary = req.Summary.Trim();
        }

        if (req.Description != null) issue.Description = req.Description;

        if (req.AssigneeId != null) issue.AssigneeId = string.IsNullOrEmpty(req.AssigneeId) ? null : req.AssigneeId;
        if (req.ReporterId != null) issue.ReporterId = string.IsNullOrEmpty(req.ReporterId) ? null : req.ReporterId;

        if (req.Priority != null)
        {
            var p = await _context.Priorities.FirstOrDefaultAsync(x => x.Name.ToLower() == req.Priority.ToLower(), cancellationToken);
            if (p != null) issue.PriorityId = p.Id;
        }

        if (req.Status != null)
        {
            var st = await _context.Statuses.FirstOrDefaultAsync(x => x.Name.ToLower() == req.Status.ToLower(), cancellationToken);
            if (st != null)
            {
                issue.StatusId = st.Id;
                if (st.Category == "done")
                {
                    issue.ResolvedAt ??= DateTimeOffset.UtcNow;
                    if (issue.ResolutionId == null)
                    {
                        var defRes = await _context.Resolutions.FirstOrDefaultAsync(r => r.IsDefault, cancellationToken);
                        issue.ResolutionId = defRes?.Id;
                    }
                }
                else
                {
                    issue.ResolvedAt = null;
                    issue.ResolutionId = null;
                }
            }
        }

        if (req.Sprint != null)
        {
            if (string.IsNullOrEmpty(req.Sprint))
            {
                issue.SprintId = null;
            }
            else
            {
                var sprint = await _context.Sprints.FirstOrDefaultAsync(s => s.ProjectKey == issue.ProjectKey && s.Name.ToLower() == req.Sprint.ToLower(), cancellationToken);
                if (sprint != null) issue.SprintId = sprint.Id;
            }
        }

        if (req.FixVersion != null)
        {
            if (string.IsNullOrEmpty(req.FixVersion))
            {
                issue.FixVersionId = null;
            }
            else
            {
                var v = await _context.Versions.FirstOrDefaultAsync(x => x.ProjectKey == issue.ProjectKey && x.Name.ToLower() == req.FixVersion.ToLower(), cancellationToken);
                if (v != null) issue.FixVersionId = v.Id;
            }
        }

        if (DateOnly.TryParse(req.DueDate, out var d)) issue.DueDate = d;
        if (DateOnly.TryParse(req.StartDate, out var s)) issue.StartDate = s;
        if (req.StoryPoints.HasValue) issue.StoryPoints = req.StoryPoints.Value;

        issue.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var viewItem = await _context.IssueView.FirstOrDefaultAsync(i => i.Id == issue.Id, cancellationToken);
        return SearchIssuesQueryHandler.MapIssueDto(viewItem!);
    }
}

public record RankIssueCommand(string Key, RankIssueRequest Request) : IRequest<IssueDto>;

public class RankIssueCommandHandler : IRequestHandler<RankIssueCommand, IssueDto>
{
    private readonly IApplicationDbContext _context;

    public RankIssueCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IssueDto> Handle(RankIssueCommand request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var issue = await _context.Issues.FirstOrDefaultAsync(i => i.Key == key, cancellationToken);
        if (issue == null) throw new NotFoundException($"Work item {key} not found.");

        double newRank = issue.Rank;

        if (!string.IsNullOrEmpty(request.Request.BeforeKey))
        {
            var target = await _context.Issues.FirstOrDefaultAsync(i => i.Key == request.Request.BeforeKey.ToUpperInvariant(), cancellationToken);
            if (target != null)
            {
                var prevRank = await _context.Issues
                    .Where(i => i.Rank < target.Rank && i.Id != issue.Id)
                    .MaxAsync(i => (double?)i.Rank, cancellationToken) ?? (target.Rank - 2048);
                newRank = (prevRank + target.Rank) / 2.0;
            }
        }
        else if (!string.IsNullOrEmpty(request.Request.AfterKey))
        {
            var target = await _context.Issues.FirstOrDefaultAsync(i => i.Key == request.Request.AfterKey.ToUpperInvariant(), cancellationToken);
            if (target != null)
            {
                var nextRank = await _context.Issues
                    .Where(i => i.Rank > target.Rank && i.Id != issue.Id)
                    .MinAsync(i => (double?)i.Rank, cancellationToken) ?? (target.Rank + 2048);
                newRank = (target.Rank + nextRank) / 2.0;
            }
        }

        issue.Rank = newRank;
        issue.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var viewItem = await _context.IssueView.FirstOrDefaultAsync(i => i.Id == issue.Id, cancellationToken);
        return SearchIssuesQueryHandler.MapIssueDto(viewItem!);
    }
}

public record AddCommentCommand(string Key, AddCommentRequest Request) : IRequest<CommentDto>;

public class AddCommentCommandHandler : IRequestHandler<AddCommentCommand, CommentDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public AddCommentCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<CommentDto> Handle(AddCommentCommand request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var issue = await _context.Issues.FirstOrDefaultAsync(i => i.Key == key, cancellationToken);
        if (issue == null) throw new NotFoundException($"Work item {key} not found.");

        if (string.IsNullOrWhiteSpace(request.Request.Body))
            throw new ValidationException("Comment cannot be empty.");

        var comment = new Comment
        {
            IssueId = issue.Id,
            AuthorId = _currentUser.UserId,
            Body = request.Request.Body.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Comments.Add(comment);
        issue.UpdatedAt = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return new CommentDto(comment.Id, comment.AuthorId, comment.Body, comment.CreatedAt, comment.UpdatedAt);
    }
}
