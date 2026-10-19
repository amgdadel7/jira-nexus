using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;
using System.Text.RegularExpressions;

namespace Masar.Application.Features.Projects.Commands;

public record CreateProjectCommand(CreateProjectRequest Request) : IRequest<ProjectDto>;

public class CreateProjectCommandHandler : IRequestHandler<CreateProjectCommand, ProjectDto>
{
    private static readonly Regex KeyRegex = new(@"^[A-Z][A-Z0-9]{1,9}$", RegexOptions.Compiled);
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CreateProjectCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ProjectDto> Handle(CreateProjectCommand request, CancellationToken cancellationToken)
    {
        var req = request.Request;
        var key = req.Key?.Trim().ToUpperInvariant() ?? string.Empty;

        if (!KeyRegex.IsMatch(key))
        {
            throw new ValidationException("Project key must be 2–10 characters: a letter followed by letters or numbers.");
        }

        if (string.IsNullOrWhiteSpace(req.Name))
        {
            throw new ValidationException("Project name is required.");
        }

        if (await _context.Projects.AnyAsync(p => p.Key == key, cancellationToken))
        {
            throw new ConflictException($"The key {key} is already in use.");
        }

        var defaultWorkflow = await _context.Workflows.FirstOrDefaultAsync(w => w.IsDefault, cancellationToken)
            ?? await _context.Workflows.FirstAsync(cancellationToken);

        var currentUserId = _currentUser.UserId;
        var leadId = req.LeadId ?? currentUserId;

        var project = new Project
        {
            Key = key,
            Name = req.Name.Trim(),
            Type = req.Type ?? "software",
            Description = req.Description ?? string.Empty,
            Color = req.Color ?? "#FFAB00",
            LeadId = leadId,
            Access = req.Access ?? "open",
            WorkflowId = defaultWorkflow.Id,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.Projects.Add(project);

        if (!string.IsNullOrEmpty(currentUserId))
        {
            _context.ProjectMembers.Add(new ProjectMember
            {
                ProjectKey = key,
                UserId = currentUserId,
                Role = "admin",
                AddedBy = currentUserId,
                AddedAt = DateTimeOffset.UtcNow
            });

            _context.ProjectStars.Add(new ProjectStar
            {
                ProjectKey = key,
                UserId = currentUserId,
                StarredAt = DateTimeOffset.UtcNow
            });
        }

        if (project.Type == "software")
        {
            _context.Sprints.Add(new Sprint
            {
                ProjectKey = key,
                Name = $"{key} Sprint 1",
                State = "future",
                Position = 0,
                CreatedAt = DateTimeOffset.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        var stats = new ProjectStatsDto(0, 0, 0, null);

        return new ProjectDto(
            project.Key,
            project.Name,
            project.Type,
            project.Description,
            project.LeadId,
            project.Color,
            project.Category,
            project.CreatedAt,
            project.Access,
            project.WorkflowId,
            "admin",
            1,
            true,
            stats
        );
    }
}
