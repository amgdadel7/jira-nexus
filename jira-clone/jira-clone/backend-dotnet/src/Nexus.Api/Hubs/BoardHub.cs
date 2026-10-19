using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Nexus.Application.Abstractions;

namespace Nexus.Api.Hubs;

[Authorize]
public class BoardHub : Hub
{
    public Task JoinProject(Guid projectId) => Groups.AddToGroupAsync(Context.ConnectionId, $"project:{projectId}");
    public Task LeaveProject(Guid projectId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project:{projectId}");
}

public class SignalRPublisher(IHubContext<BoardHub> hub) : IRealtimePublisher
{
    public Task IssueMoved(Guid projectId, Guid issueId, string status) =>
        hub.Clients.Group($"project:{projectId}").SendAsync("issue.moved", new { issueId, status });

    public Task CommentAdded(Guid projectId, Guid issueId) =>
        hub.Clients.Group($"project:{projectId}").SendAsync("comment.added", new { issueId });

    public Task SprintUpdated(Guid projectId, Guid sprintId) =>
        hub.Clients.Group($"project:{projectId}").SendAsync("sprint.updated", new { sprintId });
}
