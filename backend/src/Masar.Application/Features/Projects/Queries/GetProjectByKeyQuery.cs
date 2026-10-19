using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Projects.Queries;

public record GetProjectByKeyQuery(string Key) : IRequest<ProjectDto>;

public class GetProjectByKeyQueryHandler : IRequestHandler<GetProjectByKeyQuery, ProjectDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetProjectByKeyQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ProjectDto> Handle(GetProjectByKeyQuery request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var project = await _context.Projects
            .Include(p => p.Members)
            .FirstOrDefaultAsync(p => p.Key == key, cancellationToken);

        if (project == null)
        {
            throw new NotFoundException($"Project '{key}' does not exist.");
        }

        var currentUserId = _currentUser.UserId;
        var member = project.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var role = _currentUser.IsAdmin || project.LeadId == currentUserId ? "admin" : (member?.Role ?? (project.Access == "open" ? "member" : (project.Access == "limited" ? "viewer" : null)));

        if (project.Access == "private" && role == null && !_currentUser.IsAdmin)
        {
            throw new NotFoundException($"Project '{key}' does not exist or you don’t have access to it.");
        }

        var isStarred = !string.IsNullOrEmpty(currentUserId) &&
            await _context.ProjectStars.AnyAsync(s => s.UserId == currentUserId && s.ProjectKey == key, cancellationToken);

        var total = await _context.Issues.CountAsync(i => i.ProjectKey == key, cancellationToken);
        var done = await _context.Issues.CountAsync(i => i.ProjectKey == key && i.Status != null && i.Status.Category == "done", cancellationToken);
        var lastActivity = await _context.Issues
            .Where(i => i.ProjectKey == key)
            .MaxAsync(i => (DateTimeOffset?)i.UpdatedAt, cancellationToken);

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
