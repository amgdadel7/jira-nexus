namespace Masar.Domain.Entities;

public class User
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Color { get; set; } = "#0C66E4";
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = "member";
    public bool Active { get; set; } = true;
    public string Title { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public bool Bot { get; set; } = false;
    public bool EmailVerified { get; set; } = true;
    public string SignupSource { get; set; } = "invite";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Session> Sessions { get; set; } = new List<Session>();
    public ICollection<ProjectMember> ProjectMemberships { get; set; } = new List<ProjectMember>();
    public ICollection<ProjectStar> StarredProjects { get; set; } = new List<ProjectStar>();
}

public class Session
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
    public string UserAgent { get; set; } = string.Empty;
    public bool Remember { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastSeenAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
