using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public NotificationsController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult> GetNotifications(CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (string.IsNullOrEmpty(userId))
        {
            return Ok(new { unread = 0, items = Array.Empty<object>() });
        }

        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new
            {
                id = n.Id,
                actorId = n.ActorId,
                type = n.Type,
                message = n.Message,
                read = n.Read,
                created = n.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var unreadCount = await _context.Notifications
            .CountAsync(n => n.UserId == userId && !n.Read, cancellationToken);

        return Ok(new
        {
            unread = unreadCount,
            items = notifications
        });
    }

    [HttpPost("read")]
    public async Task<ActionResult> MarkAsRead([FromBody] MarkReadRequest? request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        if (!string.IsNullOrEmpty(userId))
        {
            var query = _context.Notifications.Where(n => n.UserId == userId && !n.Read);
            if (request?.Ids != null && request.Ids.Count > 0)
            {
                query = query.Where(n => request.Ids.Contains(n.Id));
            }

            var toUpdate = await query.ToListAsync(cancellationToken);
            foreach (var n in toUpdate)
            {
                n.Read = true;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        return Ok(new { ok = true });
    }
}

public class MarkReadRequest
{
    public List<int>? Ids { get; set; }
}
