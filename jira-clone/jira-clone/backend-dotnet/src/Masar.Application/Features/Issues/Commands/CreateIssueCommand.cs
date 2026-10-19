using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Application.Features.Issues.Queries;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Issues.Commands;

public record CreateIssueCommand(CreateIssueRequest Request) : IRequest<IssueDto>;

public class CreateIssueCommandHandler : IRequestHandler<CreateIssueCommand, IssueDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CreateIssueCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IssueDto> Handle(CreateIssueCommand request, CancellationToken cancellationToken)
    {
        var req = request.Request;
        var projectKey = (req.ProjectKey ?? req.Project ?? "KAN").ToUpperInvariant();

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Key == projectKey, cancellationToken);
        if (project == null)
            throw new NotFoundException($"Project '{projectKey}' not found.");

        if (string.IsNullOrWhiteSpace(req.Summary))
            throw new ValidationException("Summary is required.");

        var typeName = req.Type ?? "Task";
        var issueType = await _context.IssueTypes.FirstOrDefaultAsync(t => t.Name.ToLower() == typeName.ToLower(), cancellationToken)
            ?? await _context.IssueTypes.FirstAsync(cancellationToken);

        var priorityName = req.Priority ?? "Medium";
        var priority = await _context.Priorities.FirstOrDefaultAsync(p => p.Name.ToLower() == priorityName.ToLower(), cancellationToken)
            ?? await _context.Priorities.FirstAsync(cancellationToken);

        var statusName = req.Status ?? "To Do";
        var status = await _context.Statuses.FirstOrDefaultAsync(s => s.Name.ToLower() == statusName.ToLower(), cancellationToken)
            ?? await _context.Statuses.FirstAsync(cancellationToken);

        int num = project.NextNum;
        project.NextNum++;

        var key = $"{projectKey}-{num}";

        // Compute rank: nextRank
        var maxRank = await _context.Issues.MaxAsync(i => (double?)i.Rank, cancellationToken) ?? 0;
        var rank = maxRank + 1024;

        int? sprintId = null;
        if (!string.IsNullOrEmpty(req.Sprint))
        {
            var sprint = await _context.Sprints.FirstOrDefaultAsync(s => s.ProjectKey == projectKey && s.Name.ToLower() == req.Sprint.ToLower(), cancellationToken);
            sprintId = sprint?.Id;
        }

        int? fixVersionId = null;
        if (!string.IsNullOrEmpty(req.FixVersion))
        {
            var version = await _context.Versions.FirstOrDefaultAsync(v => v.ProjectKey == projectKey && v.Name.ToLower() == req.FixVersion.ToLower(), cancellationToken);
            fixVersionId = version?.Id;
        }

        int? parentId = null;
        if (!string.IsNullOrEmpty(req.ParentKey))
        {
            var parent = await _context.Issues.FirstOrDefaultAsync(i => i.Key == req.ParentKey.ToUpperInvariant(), cancellationToken);
            parentId = parent?.Id;
        }

        DateOnly? dueDate = null;
        if (DateOnly.TryParse(req.DueDate, out var parsedDue)) dueDate = parsedDue;

        DateOnly? startDate = null;
        if (DateOnly.TryParse(req.StartDate, out var parsedStart)) startDate = parsedStart;

        var reporterId = req.ReporterId ?? _currentUser.UserId;
        var assigneeId = req.AssigneeId;

        var issue = new Issue
        {
            Key = key,
            Num = num,
            ProjectKey = projectKey,
            IssueTypeId = issueType.Id,
            Summary = req.Summary.Trim(),
            Description = req.Description ?? string.Empty,
            StatusId = status.Id,
            PriorityId = priority.Id,
            AssigneeId = assigneeId,
            ReporterId = reporterId,
            ParentId = parentId,
            SprintId = sprintId,
            FixVersionId = fixVersionId,
            DueDate = dueDate,
            StartDate = startDate,
            StoryPoints = req.StoryPoints,
            Rank = rank,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.Issues.Add(issue);
        await _context.SaveChangesAsync(cancellationToken);

        // Labels
        if (req.Labels != null && req.Labels.Length > 0)
        {
            int pos = 0;
            foreach (var labelName in req.Labels.Distinct())
            {
                var trimmed = labelName.Trim().Replace(" ", "_");
                if (string.IsNullOrEmpty(trimmed)) continue;

                var label = await _context.Labels.FirstOrDefaultAsync(l => l.Name.ToLower() == trimmed.ToLower(), cancellationToken);
                if (label == null)
                {
                    label = new Label { Name = trimmed, CreatedAt = DateTimeOffset.UtcNow };
                    _context.Labels.Add(label);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                _context.IssueLabels.Add(new IssueLabel { IssueId = issue.Id, LabelId = label.Id, Position = pos++ });
            }
            await _context.SaveChangesAsync(cancellationToken);
        }

        // Add history
        _context.HistoryEntries.Add(new History
        {
            IssueId = issue.Id,
            AuthorId = _currentUser.UserId,
            Field = "created",
            CreatedAt = DateTimeOffset.UtcNow
        });

        // Watch
        if (!string.IsNullOrEmpty(_currentUser.UserId))
        {
            _context.Watchers.Add(new Watcher { IssueId = issue.Id, UserId = _currentUser.UserId });
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Fetch the generated view item
        var viewItem = await _context.IssueView.FirstOrDefaultAsync(i => i.Id == issue.Id, cancellationToken);
        return SearchIssuesQueryHandler.MapIssueDto(viewItem!);
    }
}
