using System.Security.Claims;
using Nexus.Application.Abstractions;

namespace Nexus.Api.Services;

public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid UserId => Guid.Parse(accessor.HttpContext!.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? accessor.HttpContext.User.FindFirstValue("sub")
        ?? Guid.Empty.ToString());

    public Guid OrganizationId => Guid.Parse(accessor.HttpContext!.User.FindFirstValue("org") ?? Guid.Empty.ToString());

    public bool Has(string permission) =>
        accessor.HttpContext!.User.HasClaim("perm", permission) ||
        accessor.HttpContext.User.IsInRole("super_admin");
}
