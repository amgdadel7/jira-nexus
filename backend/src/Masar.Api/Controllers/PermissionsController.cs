using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Domain.Entities;

namespace Masar.Api.Controllers;

[ApiController]
public class PermissionsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    private static readonly object[] GlobalPermissionsList = new[]
    {
        new { key = "CREATE_PROJECTS", name = "Create projects", description = "Create new projects (the creator becomes the project lead)." },
        new { key = "MANAGE_GOALS", name = "Manage goals", description = "Create, edit and delete goals." },
        new { key = "MANAGE_TEAMS", name = "Manage teams", description = "Create teams and change any team’s members." },
        new { key = "BROWSE_USERS", name = "Browse users", description = "See the People directory and user profiles." }
    };

    private static readonly object[] RolesList = new[]
    {
        new { id = "admin", label = "Site administrators" },
        new { id = "member", label = "All users" }
    };

    private static readonly Dictionary<string, List<string>> DefaultGlobalScheme = new()
    {
        ["CREATE_PROJECTS"] = new() { "admin", "member" },
        ["MANAGE_GOALS"] = new() { "admin", "member" },
        ["MANAGE_TEAMS"] = new() { "admin", "member" },
        ["BROWSE_USERS"] = new() { "admin", "member" }
    };

    private static Dictionary<string, List<string>> _currentGlobalScheme = new(DefaultGlobalScheme);

    public PermissionsController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet("api/permissions/global")]
    public ActionResult GetGlobalPermissions()
    {
        var currentUser = HttpContext.Items["CurrentUser"] as User;
        var isAdmin = currentUser?.Role == "admin" || _currentUserService.Role == "admin" || currentUser == null;

        var userRole = currentUser?.Role ?? "admin";
        var mine = _currentGlobalScheme
            .Where(kv => (userRole == "admin" && kv.Value.Contains("admin")) || kv.Value.Contains("member"))
            .Select(kv => kv.Key)
            .ToList();

        return Ok(new
        {
            permissions = GlobalPermissionsList,
            roles = RolesList,
            scheme = _currentGlobalScheme,
            defaults = DefaultGlobalScheme,
            mine,
            canManage = isAdmin,
            planLocked = false
        });
    }

    [HttpPut("api/permissions/global")]
    public ActionResult SaveGlobalPermissions([FromBody] SaveGlobalPermissionsRequest request)
    {
        if (request?.Scheme != null)
        {
            foreach (var kvp in request.Scheme)
            {
                var roles = new HashSet<string>(kvp.Value) { "admin" };
                _currentGlobalScheme[kvp.Key] = roles.ToList();
            }
        }

        return Ok(new { scheme = _currentGlobalScheme });
    }

    [HttpGet("api/mypermissions")]
    public ActionResult GetMyPermissions([FromQuery] string? project = "KAN")
    {
        var projKey = (project ?? "KAN").ToUpperInvariant();
        var currentUser = HttpContext.Items["CurrentUser"] as User;
        var role = currentUser?.Role ?? "admin";

        var projectPermissions = new List<string>
        {
            "BROWSE_PROJECT",
            "ADMINISTER_PROJECT",
            "CREATE_ISSUES",
            "EDIT_ISSUES",
            "TRANSITION_ISSUES",
            "ASSIGN_ISSUES",
            "LINK_ISSUES",
            "DELETE_ISSUES",
            "ADD_COMMENTS",
            "DELETE_ALL_COMMENTS",
            "CREATE_ATTACHMENTS",
            "DELETE_ALL_ATTACHMENTS",
            "MANAGE_SPRINTS",
            "MANAGE_VERSIONS"
        };

        var globalPerms = _currentGlobalScheme
            .Where(kv => kv.Value.Contains(role) || (role == "admin" && kv.Value.Contains("admin")))
            .Select(kv => kv.Key)
            .ToList();

        return Ok(new
        {
            project = projKey,
            role,
            permissions = projectPermissions,
            global = globalPerms
        });
    }

    [HttpPut("api/projects/{key}/permissions")]
    public async Task<ActionResult> SaveProjectPermissions(string key, [FromBody] SaveProjectPermissionsRequest request, CancellationToken cancellationToken)
    {
        var projKey = key.ToUpperInvariant();
        if (request?.Scheme != null)
        {
            var existing = await _context.PermissionSchemeEntries
                .Where(e => e.ProjectKey == projKey)
                .ToListAsync(cancellationToken);

            _context.PermissionSchemeEntries.RemoveRange(existing);

            foreach (var (perm, roles) in request.Scheme)
            {
                foreach (var r in roles)
                {
                    _context.PermissionSchemeEntries.Add(new PermissionSchemeEntry
                    {
                        ProjectKey = projKey,
                        Permission = perm,
                        Role = r
                    });
                }
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        return Ok(new { ok = true, scheme = request?.Scheme });
    }

    [HttpPost("api/projects/{key}/permissions/reset")]
    public async Task<ActionResult> ResetProjectPermissions(string key, CancellationToken cancellationToken)
    {
        var projKey = key.ToUpperInvariant();
        var existing = await _context.PermissionSchemeEntries
            .Where(e => e.ProjectKey == projKey)
            .ToListAsync(cancellationToken);

        _context.PermissionSchemeEntries.RemoveRange(existing);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { ok = true });
    }
}

public class SaveGlobalPermissionsRequest
{
    public Dictionary<string, List<string>>? Scheme { get; set; }
}

public class SaveProjectPermissionsRequest
{
    public Dictionary<string, List<string>>? Scheme { get; set; }
}
