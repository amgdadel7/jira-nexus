using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Application.Features.Issues.Queries;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Workspace;

public record GetWorkspaceMetaQuery(string? ProjectKey) : IRequest<WorkspaceMetaResponse>;

public class GetWorkspaceMetaQueryHandler : IRequestHandler<GetWorkspaceMetaQuery, WorkspaceMetaResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetWorkspaceMetaQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<WorkspaceMetaResponse> Handle(GetWorkspaceMetaQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUser.UserId;
        var userEntity = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken)
            ?? await _context.Users.FirstAsync(u => u.Role == "admin", cancellationToken);

        var currentUserDto = new UserDto(
            userEntity.Id,
            userEntity.Name,
            userEntity.Email,
            userEntity.Color,
            userEntity.Role,
            userEntity.Active,
            userEntity.Title,
            string.IsNullOrEmpty(userEntity.Avatar) ? null : $"/api/avatars/{userEntity.Avatar}",
            userEntity.Bot ? true : null
        );

        var users = (await _context.Users
            .Where(u => u.Active)
            .OrderBy(u => u.Name)
            .ToListAsync(cancellationToken))
            .Select(u => new UserDto(
                u.Id,
                u.Name,
                u.Email,
                u.Color,
                u.Role,
                u.Active,
                u.Title,
                string.IsNullOrEmpty(u.Avatar) ? null : $"/api/avatars/{u.Avatar}",
                u.Bot ? true : null
            ));

        var allProjects = await _context.Projects.OrderBy(p => p.Name).ToListAsync(cancellationToken);
        var starredKeys = (await _context.ProjectStars
            .Where(s => s.UserId == userEntity.Id)
            .Select(s => s.ProjectKey)
            .ToListAsync(cancellationToken)).ToHashSet();

        var wantedKey = (request.ProjectKey ?? "KAN").ToUpperInvariant();
        var currentProject = allProjects.FirstOrDefault(p => p.Key == wantedKey) ?? allProjects.FirstOrDefault();

        var projectsList = allProjects.Select(p => new
        {
            key = p.Key,
            name = p.Name,
            type = p.Type,
            description = p.Description,
            leadId = p.LeadId,
            color = p.Color,
            category = p.Category,
            created = p.CreatedAt,
            access = p.Access,
            workflowId = p.WorkflowId,
            starred = starredKeys.Contains(p.Key),
            myRole = userEntity.Role == "admin" || p.LeadId == userEntity.Id ? "admin" : "member",
            canCreate = true,
            permissions = new[] { "BROWSE_PROJECT", "CREATE_ISSUES", "EDIT_ISSUES", "TRANSITION_ISSUES", "ASSIGN_ISSUES", "ADD_COMMENTS" }
        }).ToList();

        var components = currentProject != null
            ? (await _context.Components.Where(c => c.ProjectKey == currentProject.Key).ToListAsync(cancellationToken))
                .Select(c => (object)new { id = c.Id, name = c.Name, leadId = c.LeadId })
            : Array.Empty<object>();

        var teams = (await _context.Teams.ToListAsync(cancellationToken))
            .Select(t => (object)new { id = t.Id, name = t.Name, color = t.Color });

        var versions = currentProject != null
            ? (await _context.Versions.Where(v => v.ProjectKey == currentProject.Key).ToListAsync(cancellationToken))
                .Select(v => (object)new { id = v.Id, name = v.Name, status = v.Status, releaseDate = v.ReleaseDate })
            : Array.Empty<object>();

        var sprints = currentProject != null
            ? await _context.Sprints.Where(s => s.ProjectKey == currentProject.Key).OrderBy(s => s.Position).ToListAsync(cancellationToken)
            : new List<Masar.Domain.Entities.Sprint>();

        var activeSprint = sprints.FirstOrDefault(s => s.State == "active");
        object? activeSprintObj = activeSprint != null
            ? new { id = activeSprint.Id, name = activeSprint.Name, goal = activeSprint.Goal, startDate = activeSprint.StartDate, endDate = activeSprint.EndDate }
            : null;

        var labels = (await _context.Labels.OrderBy(l => l.Name).Select(l => l.Name).ToListAsync(cancellationToken));

        var types = await _context.IssueTypes.OrderBy(t => t.Position).ToListAsync(cancellationToken);
        var priorities = await _context.Priorities.OrderBy(p => p.Position).ToListAsync(cancellationToken);
        var statuses = await _context.Statuses.OrderBy(s => s.Id).ToListAsync(cancellationToken);
        var resolutions = await _context.Resolutions.OrderBy(r => r.Position).ToListAsync(cancellationToken);

        var workflowEntity = await _context.Workflows
            .Include(w => w.Statuses)
            .ThenInclude(ws => ws.Status)
            .Include(w => w.Transitions)
            .FirstOrDefaultAsync(w => currentProject != null && w.Id == currentProject.WorkflowId, cancellationToken)
            ?? await _context.Workflows.Include(w => w.Statuses).ThenInclude(ws => ws.Status).Include(w => w.Transitions).FirstAsync(cancellationToken);

        var workflowDto = new WorkflowDto(
            workflowEntity.Id,
            workflowEntity.Name,
            workflowEntity.Statuses.OrderBy(ws => ws.Position).Select(ws => new WorkflowStatusDto(
                ws.StatusId,
                ws.Status?.Name ?? string.Empty,
                ws.Status?.Category ?? "todo",
                ws.IsInitial
            )),
            workflowEntity.Transitions.Select(wt => (object)new
            {
                id = wt.Id,
                name = wt.Name,
                fromStatusId = wt.FromStatusId,
                toStatusId = wt.ToStatusId
            })
        );

        object? currentProjectObj = currentProject != null ? new
        {
            key = currentProject.Key,
            name = currentProject.Name,
            type = currentProject.Type,
            description = currentProject.Description,
            leadId = currentProject.LeadId,
            color = currentProject.Color,
            category = currentProject.Category,
            created = currentProject.CreatedAt,
            access = currentProject.Access,
            workflowId = currentProject.WorkflowId,
            starred = starredKeys.Contains(currentProject.Key),
            myRole = "admin",
            canCreate = true,
            permissions = new[] { "BROWSE_PROJECT", "CREATE_ISSUES", "EDIT_ISSUES", "TRANSITION_ISSUES", "ASSIGN_ISSUES", "ADD_COMMENTS" },
            board = new
            {
                wip = new Dictionary<string, int>(),
                swimlanes = currentProject.BoardSwimlanes
            }
        } : null;

        var linkTypes = new object[]
        {
            new { id = "blocks", outward = "blocks", inward = "is blocked by" },
            new { id = "relates", outward = "relates to", inward = "relates to" },
            new { id = "duplicates", outward = "duplicates", inward = "is duplicated by" },
            new { id = "clones", outward = "clones", inward = "is cloned by" }
        };

        var goalStatuses = new[] { "pending", "on_track", "at_risk", "off_track", "done", "cancelled" };

        var planObj = new
        {
            key = "premium",
            name = "Premium",
            status = "active",
            features = new[] { "permissions", "audit", "recycle_bin" },
            limits = new { }
        };

        return new WorkspaceMetaResponse(
            users,
            userEntity.Id,
            currentUserDto,
            new[] { "CREATE_PROJECTS", "MANAGE_GOALS", "MANAGE_TEAMS", "BROWSE_USERS" },
            planObj,
            currentProjectObj,
            projectsList,
            null,
            "admin",
            "Administrator",
            new[] { "BROWSE_PROJECT", "CREATE_ISSUES", "EDIT_ISSUES", "TRANSITION_ISSUES", "ASSIGN_ISSUES", "ADD_COMMENTS" },
            components,
            teams,
            versions,
            activeSprintObj,
            sprints.Select(s => s.Name),
            labels,
            new[] { "kan-web", "payments-service" },
            statuses.Select(s => s.Name),
            priorities.Select(p => p.Name),
            types.Select(t => t.Name),
            workflowDto,
            types.Select(t => (object)new { id = t.Id, name = t.Name, icon = t.Icon, color = t.Color, hierarchyLevel = t.HierarchyLevel }),
            priorities.Select(p => (object)new { id = p.Id, name = p.Name, color = p.Color, icon = p.Icon, isDefault = p.IsDefault }),
            resolutions.Select(r => (object)new { id = r.Id, name = r.Name, isDefault = r.IsDefault }),
            Array.Empty<object>(),
            linkTypes,
            goalStatuses
        );
    }
}

public record QuickSearchQuery(string? Query) : IRequest<QuickSearchResponse>;

public class QuickSearchQueryHandler : IRequestHandler<QuickSearchQuery, QuickSearchResponse>
{
    private readonly IApplicationDbContext _context;

    public QuickSearchQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<QuickSearchResponse> Handle(QuickSearchQuery request, CancellationToken cancellationToken)
    {
        var text = (request.Query ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(text))
        {
            return new QuickSearchResponse([], [], []);
        }

        var matchingIssues = (await _context.IssueView
            .Where(i => i.Key.ToLower().Contains(text) || i.Summary.ToLower().Contains(text))
            .Take(10)
            .ToListAsync(cancellationToken))
            .Select(SearchIssuesQueryHandler.MapIssueDto);

        var matchingUsers = (await _context.Users
            .Where(u => u.Active && (u.Name.ToLower().Contains(text) || u.Email.ToLower().Contains(text)))
            .Take(10)
            .ToListAsync(cancellationToken))
            .Select(u => new UserDto(
                u.Id,
                u.Name,
                u.Email,
                u.Color,
                u.Role,
                u.Active,
                u.Title,
                string.IsNullOrEmpty(u.Avatar) ? null : $"/api/avatars/{u.Avatar}",
                u.Bot ? true : null
            ));

        return new QuickSearchResponse(matchingIssues, [], matchingUsers);
    }
}
