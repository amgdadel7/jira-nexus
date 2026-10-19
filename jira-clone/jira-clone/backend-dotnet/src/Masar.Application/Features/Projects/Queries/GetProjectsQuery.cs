using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Projects.Queries;

public record GetProjectsQuery(string? SearchQuery) : IRequest<IEnumerable<ProjectDto>>;

public class GetProjectsQueryHandler : IRequestHandler<GetProjectsQuery, IEnumerable<ProjectDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetProjectsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IEnumerable<ProjectDto>> Handle(GetProjectsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Projects
            .Include(p => p.Members)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.SearchQuery))
        {
            var search = request.SearchQuery.Trim().ToLowerInvariant();
            query = query.Where(p => p.Name.ToLower().Contains(search) || p.Key.ToLower().Contains(search));
        }

        var projects = await query.OrderBy(p => p.Name).ToListAsync(cancellationToken);
        var currentUserId = _currentUser.UserId;

        var starredKeys = string.IsNullOrEmpty(currentUserId)
            ? new HashSet<string>()
            : (await _context.ProjectStars
                .Where(s => s.UserId == currentUserId)
                .Select(s => s.ProjectKey)
                .ToListAsync(cancellationToken)).ToHashSet();

        var result = new List<ProjectDto>();

        foreach (var project in projects)
        {
            // Calculate stats
            var total = await _context.Issues.CountAsync(i => i.ProjectKey == project.Key, cancellationToken);
            var done = await _context.Issues.CountAsync(i => i.ProjectKey == project.Key && i.Status != null && i.Status.Category == "done", cancellationToken);
            var lastActivity = await _context.Issues
                .Where(i => i.ProjectKey == project.Key)
                .MaxAsync(i => (DateTimeOffset?)i.UpdatedAt, cancellationToken);

            var member = project.Members.FirstOrDefault(m => m.UserId == currentUserId);
            var role = _currentUser.IsAdmin || project.LeadId == currentUserId ? "admin" : (member?.Role ?? (project.Access == "open" ? "member" : (project.Access == "limited" ? "viewer" : null)));

            // If private and not a member and not site admin, don't show
            if (project.Access == "private" && role == null && !_currentUser.IsAdmin)
            {
                continue;
            }

            var stats = new ProjectStatsDto(total, done, total - done, lastActivity);

            result.Add(new ProjectDto(
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
                starredKeys.Contains(project.Key),
                stats
            ));
        }

        return result;
    }
}
