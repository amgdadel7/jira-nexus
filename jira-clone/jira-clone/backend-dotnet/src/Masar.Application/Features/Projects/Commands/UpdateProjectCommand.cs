using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Projects.Commands;

public record UpdateProjectCommand(string Key, UpdateProjectRequest Request) : IRequest<ProjectDto>;

public class UpdateProjectCommandHandler : IRequestHandler<UpdateProjectCommand, ProjectDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public UpdateProjectCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ProjectDto> Handle(UpdateProjectCommand request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var project = await _context.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Key == key, cancellationToken);

        if (project == null)
        {
            throw new NotFoundException($"Project '{key}' does not exist.");
        }

        var req = request.Request;
        if (req.Name != null)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                throw new ValidationException("Project name is required.");
            project.Name = req.Name.Trim();
        }

        if (req.Description != null) project.Description = req.Description;
        if (req.LeadId != null) project.LeadId = req.LeadId;
        if (req.Color != null) project.Color = req.Color;
        if (req.Access != null) project.Access = req.Access;

        await _context.SaveChangesAsync(cancellationToken);

        var total = await _context.Issues.CountAsync(i => i.ProjectKey == key, cancellationToken);
        var done = await _context.Issues.CountAsync(i => i.ProjectKey == key && i.Status != null && i.Status.Category == "done", cancellationToken);
        var lastActivity = await _context.Issues
            .Where(i => i.ProjectKey == key)
            .MaxAsync(i => (DateTimeOffset?)i.UpdatedAt, cancellationToken);

        var currentUserId = _currentUser.UserId;
        var member = project.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var role = _currentUser.IsAdmin || project.LeadId == currentUserId ? "admin" : (member?.Role ?? (project.Access == "open" ? "member" : (project.Access == "limited" ? "viewer" : null)));

        var isStarred = !string.IsNullOrEmpty(currentUserId) &&
            await _context.ProjectStars.AnyAsync(s => s.UserId == currentUserId && s.ProjectKey == key, cancellationToken);

        var stats = new ProjectStatsDto(total, done, total - done, lastActivity);

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
            role,
            project.Members.Count,
            isStarred,
            stats
        );
    }
}

public record DeleteProjectCommand(string Key, string? Confirm) : IRequest<bool>;

public class DeleteProjectCommandHandler : IRequestHandler<DeleteProjectCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public DeleteProjectCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteProjectCommand request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Key == key, cancellationToken);

        if (project == null)
        {
            throw new NotFoundException($"Project '{key}' does not exist.");
        }

        if (request.Confirm != null && request.Confirm.ToUpperInvariant() != key)
        {
            throw new ValidationException($"Type {key} to confirm.");
        }

        _context.Projects.Remove(project);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
