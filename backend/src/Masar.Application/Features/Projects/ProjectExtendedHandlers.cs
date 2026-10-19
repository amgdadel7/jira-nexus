using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Projects;

// ---------- Project Members ----------

public record GetProjectMembersQuery(string ProjectKey) : IRequest<ProjectMembersResponse>;

public class GetProjectMembersQueryHandler : IRequestHandler<GetProjectMembersQuery, ProjectMembersResponse>
{
    private readonly IApplicationDbContext _context;

    public GetProjectMembersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProjectMembersResponse> Handle(GetProjectMembersQuery request, CancellationToken cancellationToken)
    {
        var key = request.ProjectKey.ToUpperInvariant();
        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Key == key, cancellationToken)
            ?? throw new NotFoundException($"Project {key} not found");

        var members = await _context.ProjectMembers
            .Include(pm => pm.User)
            .Where(pm => pm.ProjectKey == key)
            .ToListAsync(cancellationToken);

        var people = members.Select(m => new ProjectMemberItemDto(
            new UserDto(m.User!.Id, m.User.Name, m.User.Email, m.User.Color, m.User.Role, m.User.Active, m.User.Title, null, m.User.Bot),
            m.Role,
            m.Role,
            "project",
            true,
            m.AddedBy,
            m.AddedAt
        )).ToList();

        var roles = new object[]
        {
            new { id = "admin", name = "Administrator", description = "Can manage project settings and members" },
            new { id = "member", name = "Member", description = "Can create and edit issues" },
            new { id = "viewer", name = "Viewer", description = "Read-only access" }
        };

        return new ProjectMembersResponse(
            new { key = project.Key, name = project.Name, access = project.Access },
            roles,
            project.Access == "open" ? "member" : null,
            people,
            true,
            false
        );
    }
}

public record AddProjectMemberCommand(string ProjectKey, AddProjectMemberRequest Request) : IRequest<ProjectMemberItemDto>;

public class AddProjectMemberCommandHandler : IRequestHandler<AddProjectMemberCommand, ProjectMemberItemDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public AddProjectMemberCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<ProjectMemberItemDto> Handle(AddProjectMemberCommand command, CancellationToken cancellationToken)
    {
        var key = command.ProjectKey.ToUpperInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == command.Request.UserId, cancellationToken)
            ?? throw new NotFoundException("User not found");

        var existing = await _context.ProjectMembers
            .FirstOrDefaultAsync(pm => pm.ProjectKey == key && pm.UserId == user.Id, cancellationToken);

        if (existing != null)
        {
            existing.Role = command.Request.Role;
        }
        else
        {
            _context.ProjectMembers.Add(new ProjectMember
            {
                ProjectKey = key,
                UserId = user.Id,
                Role = command.Request.Role,
                AddedBy = _currentUser.UserId,
                AddedAt = DateTimeOffset.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new ProjectMemberItemDto(
            new UserDto(user.Id, user.Name, user.Email, user.Color, user.Role, user.Active, user.Title, null, user.Bot),
            command.Request.Role,
            command.Request.Role,
            "project",
            true,
            _currentUser.UserId,
            DateTimeOffset.UtcNow
        );
    }
}

public record RemoveProjectMemberCommand(string ProjectKey, string UserId) : IRequest<bool>;

public class RemoveProjectMemberCommandHandler : IRequestHandler<RemoveProjectMemberCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public RemoveProjectMemberCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(RemoveProjectMemberCommand command, CancellationToken cancellationToken)
    {
        var key = command.ProjectKey.ToUpperInvariant();
        var existing = await _context.ProjectMembers
            .FirstOrDefaultAsync(pm => pm.ProjectKey == key && pm.UserId == command.UserId, cancellationToken);

        if (existing != null)
        {
            _context.ProjectMembers.Remove(existing);
            await _context.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}

// ---------- Permissions ----------

public record GetProjectPermissionsQuery(string ProjectKey) : IRequest<object>;

public class GetProjectPermissionsQueryHandler : IRequestHandler<GetProjectPermissionsQuery, object>
{
    private readonly IApplicationDbContext _context;

    public GetProjectPermissionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<object> Handle(GetProjectPermissionsQuery request, CancellationToken cancellationToken)
    {
        var key = request.ProjectKey.ToUpperInvariant();
        var entries = await _context.PermissionSchemeEntries
            .Where(e => e.ProjectKey == key)
            .ToListAsync(cancellationToken);

        var scheme = new Dictionary<string, List<string>>
        {
            ["BROWSE_PROJECT"] = new() { "admin", "member", "viewer" },
            ["CREATE_ISSUES"] = new() { "admin", "member" },
            ["EDIT_ISSUES"] = new() { "admin", "member" },
            ["TRANSITION_ISSUES"] = new() { "admin", "member" },
            ["ASSIGN_ISSUES"] = new() { "admin", "member" },
            ["ADD_COMMENTS"] = new() { "admin", "member" },
            ["DELETE_ISSUES"] = new() { "admin" },
            ["ADMINISTER_PROJECT"] = new() { "admin" }
        };

        foreach (var entry in entries)
        {
            if (!scheme.ContainsKey(entry.Permission)) scheme[entry.Permission] = new List<string>();
            if (!scheme[entry.Permission].Contains(entry.Role)) scheme[entry.Permission].Add(entry.Role);
        }

        return new { projectKey = key, custom = entries.Count > 0, scheme };
    }
}

// ---------- Teams ----------

public record GetTeamsQuery : IRequest<IEnumerable<TeamDto>>;

public class GetTeamsQueryHandler : IRequestHandler<GetTeamsQuery, IEnumerable<TeamDto>>
{
    private readonly IApplicationDbContext _context;

    public GetTeamsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<TeamDto>> Handle(GetTeamsQuery request, CancellationToken cancellationToken)
    {
        var teams = await _context.Teams
            .Include(t => t.Members)
            .ThenInclude(tm => tm.User)
            .OrderBy(t => t.Name)
            .ToListAsync(cancellationToken);

        return teams.Select(t => new TeamDto(
            t.Id,
            t.Name,
            t.Description,
            t.Color,
            t.Members.Where(m => m.User != null).Select(m => new UserDto(m.User!.Id, m.User.Name, m.User.Email, m.User.Color, m.User.Role, m.User.Active, m.User.Title, null, m.User.Bot)),
            t.Members.Count,
            t.CreatedAt
        ));
    }
}

public record CreateTeamCommand(CreateTeamRequest Request) : IRequest<TeamDto>;

public class CreateTeamCommandHandler : IRequestHandler<CreateTeamCommand, TeamDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CreateTeamCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<TeamDto> Handle(CreateTeamCommand command, CancellationToken cancellationToken)
    {
        var req = command.Request;
        var team = new Team
        {
            Name = req.Name.Trim(),
            Description = req.Description ?? string.Empty,
            Color = req.Color ?? "#0C66E4",
            CreatedBy = _currentUser.UserId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        if (req.Members != null)
        {
            foreach (var uid in req.Members)
            {
                team.Members.Add(new TeamMember { UserId = uid });
            }
        }

        _context.Teams.Add(team);
        await _context.SaveChangesAsync(cancellationToken);

        return new TeamDto(team.Id, team.Name, team.Description, team.Color, Array.Empty<UserDto>(), team.Members.Count, team.CreatedAt);
    }
}

// ---------- Trash & Audit ----------

public record GetTrashQuery(string? ProjectKey) : IRequest<IEnumerable<TrashItemDto>>;

public class GetTrashQueryHandler : IRequestHandler<GetTrashQuery, IEnumerable<TrashItemDto>>
{
    private readonly IApplicationDbContext _context;

    public GetTrashQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<TrashItemDto>> Handle(GetTrashQuery request, CancellationToken cancellationToken)
    {
        var query = _context.TrashItems.AsQueryable();
        if (!string.IsNullOrEmpty(request.ProjectKey))
        {
            query = query.Where(t => t.ProjectKey == request.ProjectKey.ToUpperInvariant());
        }

        var items = await query.OrderByDescending(t => t.DeletedAt).ToListAsync(cancellationToken);
        return items.Select(t => new TrashItemDto(
            t.Id,
            t.IssueKey,
            t.Summary,
            t.Type,
            t.Status,
            t.DeletedById,
            t.DeletedAt,
            t.ExpiresAt
        ));
    }
}

public record GetAuditLogQuery(string? ProjectKey) : IRequest<IEnumerable<AuditLogDto>>;

public class GetAuditLogQueryHandler : IRequestHandler<GetAuditLogQuery, IEnumerable<AuditLogDto>>
{
    private readonly IApplicationDbContext _context;

    public GetAuditLogQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AuditLogDto>> Handle(GetAuditLogQuery request, CancellationToken cancellationToken)
    {
        var query = _context.AuditLogs.Include(a => a.Actor).AsQueryable();
        if (!string.IsNullOrEmpty(request.ProjectKey))
        {
            query = query.Where(a => a.ProjectKey == request.ProjectKey.ToUpperInvariant());
        }

        var logs = await query.OrderByDescending(a => a.CreatedAt).Take(100).ToListAsync(cancellationToken);
        return logs.Select(a => new AuditLogDto(
            a.Id,
            a.CreatedAt,
            a.Actor != null ? new UserDto(a.Actor.Id, a.Actor.Name, a.Actor.Email, a.Actor.Color, a.Actor.Role, a.Actor.Active, a.Actor.Title, null, a.Actor.Bot) : null,
            a.Action,
            a.Target,
            JsonSerializer.Deserialize<object>(a.DetailsJson ?? "{}")
        ));
    }
}
