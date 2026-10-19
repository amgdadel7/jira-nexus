using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Planning;

public record GetSprintsQuery(string? Project, string? State) : IRequest<IEnumerable<SprintDto>>;

public class GetSprintsQueryHandler : IRequestHandler<GetSprintsQuery, IEnumerable<SprintDto>>
{
    private readonly IApplicationDbContext _context;

    public GetSprintsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<SprintDto>> Handle(GetSprintsQuery request, CancellationToken cancellationToken)
    {
        var projectKey = (request.Project ?? "KAN").ToUpperInvariant();
        var query = _context.Sprints.Where(s => s.ProjectKey == projectKey).AsNoTracking();

        if (!string.IsNullOrEmpty(request.State))
        {
            var states = request.State.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = query.Where(s => states.Contains(s.State));
        }

        var sprints = await query.OrderBy(s => s.Position).ToListAsync(cancellationToken);
        var result = new List<SprintDto>();

        foreach (var s in sprints)
        {
            var issues = await _context.Issues
                .Include(i => i.Status)
                .Where(i => i.SprintId == s.Id)
                .ToListAsync(cancellationToken);

            var total = issues.Count;
            var done = issues.Count(i => i.Status?.Category == "done");
            var inProgress = issues.Count(i => i.Status?.Category == "in_progress");
            var todo = total - done - inProgress;
            var points = issues.Sum(i => i.StoryPoints ?? 0);
            var donePoints = issues.Where(i => i.Status?.Category == "done").Sum(i => i.StoryPoints ?? 0);

            var stats = new SprintStatsDto(total, done, inProgress, todo, points, donePoints);
            var committed = s.CommittedPoints.HasValue ? new SprintPointsCountDto(s.CommittedPoints.Value, s.CommittedCount ?? 0) : null;
            var completed = s.CompletedPoints.HasValue ? new SprintPointsCountDto(s.CompletedPoints.Value, s.CompletedCount ?? 0) : null;

            result.Add(new SprintDto(
                s.Id,
                s.Name,
                s.Goal,
                s.State,
                s.StartDate,
                s.EndDate,
                s.CompletedAt,
                s.Position,
                s.CreatedAt,
                s.ProjectKey,
                committed,
                completed,
                stats
            ));
        }

        return result;
    }
}

public record GetVersionsQuery(string? Project) : IRequest<IEnumerable<VersionDto>>;

public class GetVersionsQueryHandler : IRequestHandler<GetVersionsQuery, IEnumerable<VersionDto>>
{
    private readonly IApplicationDbContext _context;

    public GetVersionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<VersionDto>> Handle(GetVersionsQuery request, CancellationToken cancellationToken)
    {
        var projectKey = (request.Project ?? "KAN").ToUpperInvariant();
        var versions = await _context.Versions
            .Where(v => v.ProjectKey == projectKey)
            .OrderBy(v => v.Position)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var result = new List<VersionDto>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var v in versions)
        {
            var issues = await _context.Issues
                .Include(i => i.Status)
                .Where(i => i.FixVersionId == v.Id)
                .ToListAsync(cancellationToken);

            var total = issues.Count;
            var done = issues.Count(i => i.Status?.Category == "done");
            var inProgress = issues.Count(i => i.Status?.Category == "in_progress");
            var todo = total - done - inProgress;
            var points = issues.Sum(i => i.StoryPoints ?? 0);

            var stats = new VersionStatsDto(total, done, inProgress, todo, points);
            bool overdue = v.Status == "unreleased" && v.ReleaseDate.HasValue && v.ReleaseDate.Value < today;

            result.Add(new VersionDto(
                v.Id,
                v.ProjectKey,
                v.Name,
                v.Description,
                v.Status,
                v.StartDate,
                v.ReleaseDate,
                v.ReleasedAt,
                v.Position,
                v.CreatedAt,
                overdue,
                stats
            ));
        }

        return result;
    }
}

public record GetComponentsQuery(string? Project) : IRequest<IEnumerable<ComponentDto>>;

public class GetComponentsQueryHandler : IRequestHandler<GetComponentsQuery, IEnumerable<ComponentDto>>
{
    private readonly IApplicationDbContext _context;

    public GetComponentsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ComponentDto>> Handle(GetComponentsQuery request, CancellationToken cancellationToken)
    {
        var projectKey = (request.Project ?? "KAN").ToUpperInvariant();
        var components = await _context.Components
            .Where(c => c.ProjectKey == projectKey)
            .OrderBy(c => c.Name)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var result = new List<ComponentDto>();

        foreach (var c in components)
        {
            var issueIds = await _context.IssueComponents
                .Where(ic => ic.ComponentId == c.Id)
                .Select(ic => ic.IssueId)
                .ToListAsync(cancellationToken);

            var total = issueIds.Count;
            var open = await _context.Issues
                .CountAsync(i => issueIds.Contains(i.Id) && i.Status != null && i.Status.Category != "done", cancellationToken);

            result.Add(new ComponentDto(
                c.Id,
                c.ProjectKey,
                c.Name,
                c.Description,
                c.LeadId,
                c.DefaultAssignee,
                c.CreatedAt,
                total,
                open
            ));
        }

        return result;
    }
}
