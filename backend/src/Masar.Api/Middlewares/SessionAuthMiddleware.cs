using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;

namespace Masar.Api.Middlewares;

public class SessionAuthMiddleware
{
    private readonly RequestDelegate _next;

    public SessionAuthMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IApplicationDbContext dbContext)
    {
        string? token = null;

        if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            var headerVal = authHeader.ToString();
            if (headerVal.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                token = headerVal["Bearer ".Length..].Trim();
            }
        }

        if (string.IsNullOrEmpty(token) && context.Request.Headers.TryGetValue("X-JC-Auth", out var jcAuthHeader))
        {
            token = jcAuthHeader.ToString().Trim();
        }

        if (string.IsNullOrEmpty(token) && context.Request.Headers.TryGetValue("X-Auth-Token", out var xAuthHeader))
        {
            token = xAuthHeader.ToString().Trim();
        }

        if (string.IsNullOrEmpty(token) && context.Request.Query.TryGetValue("access_token", out var queryToken))
        {
            token = queryToken.ToString().Trim();
        }

        if (string.IsNullOrEmpty(token) && context.Request.Cookies.TryGetValue("jc_session", out var cookieToken))
        {
            token = cookieToken.Trim();
        }

        if (!string.IsNullOrEmpty(token))
        {
            var now = DateTimeOffset.UtcNow;
            var session = await dbContext.Sessions
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.Token == token && s.ExpiresAt > now);

            if (session?.User != null && session.User.Active)
            {
                context.Items["CurrentUser"] = session.User;
                context.Items["SessionToken"] = token;

                var claims = new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, session.User.Id),
                    new(ClaimTypes.Name, session.User.Name),
                    new(ClaimTypes.Email, session.User.Email),
                    new(ClaimTypes.Role, session.User.Role)
                };

                var identity = new ClaimsIdentity(claims, "SessionAuth");
                context.User = new ClaimsPrincipal(identity);

                if (session.LastSeenAt == null || (now - session.LastSeenAt.Value).TotalMinutes > 5)
                {
                    session.LastSeenAt = now;
                    await dbContext.SaveChangesAsync();
                }
            }
        }

        await _next(context);
    }
}
