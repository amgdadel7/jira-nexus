using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Planning;

// ---------- Sprint Commands ----------

public record CreateSprintCommand(CreateSprintRequest Request) : IRequest<SprintDto>;

public class CreateSprintCommandHandler : IRequestHandler<CreateSprintCommand, SprintDto>
{
    private readonly IApplicationDbContext _context;

    public CreateSprintCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SprintDto> Handle(CreateSprintCommand command, CancellationToken cancellationToken)
    {
        var req = command.Request;
        var key = (req.ProjectKey ?? "KAN").ToUpperInvariant();
        var maxPos = await _context.Sprints
            .Where(s => s.ProjectKey == key)
            .MaxAsync(s => (int?)s.Position, cancellationToken) ?? 0;

        var sprint = new Sprint
        {
            ProjectKey = key,
            Name = req.Name ?? $"{key} Sprint {maxPos + 2}",
            Goal = req.Goal ?? string.Empty,
            State = "future",
            Position = maxPos + 1,
            CreatedAt = DateTimeOffset.UtcNow
        };

        if (DateOnly.TryParse(req.StartDate, out var sd)) sprint.StartDate = sd;
        if (DateOnly.TryParse(req.EndDate, out var ed)) sprint.EndDate = ed;

        _context.Sprints.Add(sprint);
        await _context.SaveChangesAsync(cancellationToken);

        var stats = new SprintStatsDto(0, 0, 0, 0, 0, 0);
        return new SprintDto(sprint.Id, sprint.Name, sprint.Goal, sprint.State, sprint.StartDate, sprint.EndDate, null, sprint.Position, sprint.CreatedAt, sprint.ProjectKey, null, null, stats);
    }
}

public record UpdateSprintCommand(int Id, UpdateSprintRequest Request) : IRequest<SprintDto>;

public class UpdateSprintCommandHandler : IRequestHandler<UpdateSprintCommand, SprintDto>
{
    private readonly IApplicationDbContext _context;

    public UpdateSprintCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SprintDto> Handle(UpdateSprintCommand command, CancellationToken cancellationToken)
    {
        var sprint = await _context.Sprints.FirstOrDefaultAsync(s => s.Id == command.Id, cancellationToken)
            ?? throw new NotFoundException($"Sprint {command.Id} not found");

        var req = command.Request;
        if (!string.IsNullOrEmpty(req.Name)) sprint.Name = req.Name;
        if (req.Goal != null) sprint.Goal = req.Goal;
        if (DateOnly.TryParse(req.StartDate, out var sd)) sprint.StartDate = sd;
        if (DateOnly.TryParse(req.EndDate, out var ed)) sprint.EndDate = ed;

        await _context.SaveChangesAsync(cancellationToken);

        var stats = new SprintStatsDto(0, 0, 0, 0, 0, 0);
        return new SprintDto(sprint.Id, sprint.Name, sprint.Goal, sprint.State, sprint.StartDate, sprint.EndDate, sprint.CompletedAt, sprint.Position, sprint.CreatedAt, sprint.ProjectKey, null, null, stats);
    }
}

public record StartSprintCommand(int Id) : IRequest<SprintDto>;

public class StartSprintCommandHandler : IRequestHandler<StartSprintCommand, SprintDto>
{
    private readonly IApplicationDbContext _context;

    public StartSprintCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SprintDto> Handle(StartSprintCommand command, CancellationToken cancellationToken)
    {
        var sprint = await _context.Sprints.FirstOrDefaultAsync(s => s.Id == command.Id, cancellationToken)
            ?? throw new NotFoundException($"Sprint {command.Id} not found");

        sprint.State = "active";
        sprint.StartDate ??= DateOnly.FromDateTime(DateTime.UtcNow);
        sprint.EndDate ??= DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14));

        var issues = await _context.Issues.Where(i => i.SprintId == sprint.Id).ToListAsync(cancellationToken);
        sprint.CommittedPoints = issues.Sum(i => i.StoryPoints ?? 0);
        sprint.CommittedCount = issues.Count;

        await _context.SaveChangesAsync(cancellationToken);

        var stats = new SprintStatsDto(issues.Count, 0, 0, issues.Count, sprint.CommittedPoints.Value, 0);
        return new SprintDto(sprint.Id, sprint.Name, sprint.Goal, sprint.State, sprint.StartDate, sprint.EndDate, sprint.CompletedAt, sprint.Position, sprint.CreatedAt, sprint.ProjectKey, new SprintPointsCountDto(sprint.CommittedPoints.Value, sprint.CommittedCount.Value), null, stats);
    }
}

public record CompleteSprintCommand(int Id) : IRequest<SprintDto>;

public class CompleteSprintCommandHandler : IRequestHandler<CompleteSprintCommand, SprintDto>
{
    private readonly IApplicationDbContext _context;

    public CompleteSprintCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SprintDto> Handle(CompleteSprintCommand command, CancellationToken cancellationToken)
    {
        var sprint = await _context.Sprints.FirstOrDefaultAsync(s => s.Id == command.Id, cancellationToken)
            ?? throw new NotFoundException($"Sprint {command.Id} not found");

        sprint.State = "closed";
        sprint.CompletedAt = DateTimeOffset.UtcNow;

        var issues = await _context.Issues.Include(i => i.Status).Where(i => i.SprintId == sprint.Id).ToListAsync(cancellationToken);
        var doneIssues = issues.Where(i => i.Status?.Category == "done").ToList();
        sprint.CompletedPoints = doneIssues.Sum(i => i.StoryPoints ?? 0);
        sprint.CompletedCount = doneIssues.Count;

        await _context.SaveChangesAsync(cancellationToken);

        var stats = new SprintStatsDto(issues.Count, doneIssues.Count, 0, issues.Count - doneIssues.Count, issues.Sum(i => i.StoryPoints ?? 0), sprint.CompletedPoints.Value);
        return new SprintDto(sprint.Id, sprint.Name, sprint.Goal, sprint.State, sprint.StartDate, sprint.EndDate, sprint.CompletedAt, sprint.Position, sprint.CreatedAt, sprint.ProjectKey, null, new SprintPointsCountDto(sprint.CompletedPoints.Value, sprint.CompletedCount.Value), stats);
    }
}

// ---------- Reports ----------

public record GetVelocityReportQuery(string? ProjectKey) : IRequest<VelocityReportDto>;

public class GetVelocityReportQueryHandler : IRequestHandler<GetVelocityReportQuery, VelocityReportDto>
{
    private readonly IApplicationDbContext _context;

    public GetVelocityReportQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<VelocityReportDto> Handle(GetVelocityReportQuery request, CancellationToken cancellationToken)
    {
        var key = (request.ProjectKey ?? "KAN").ToUpperInvariant();
        var closedSprints = await _context.Sprints
            .Where(s => s.ProjectKey == key && s.State == "closed")
            .OrderByDescending(s => s.CompletedAt)
            .Take(7)
            .ToListAsync(cancellationToken);

        var list = closedSprints.Select(s => new VelocitySprintDto(
            s.Id,
            s.Name,
            s.CommittedPoints ?? 0,
            s.CompletedPoints ?? 0
        )).ToList();

        var avg = list.Count > 0 ? list.Average(s => s.Completed) : 0;
        return new VelocityReportDto(list, Math.Round(avg, 1));
    }
}
