using Nexus.Domain.Entities;
using Nexus.Shared;

namespace Nexus.Application.Abstractions;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface IIssueRepository
{
    Task<Issue?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<Issue?> GetByKeyAsync(string key, CancellationToken ct);
    Task<Paged<Issue>> ListAsync(Guid projectId, string? status, string? query, int page, int size, CancellationToken ct);
    Task AddAsync(Issue issue, CancellationToken ct);
    void Remove(Issue issue);
}

public interface IProjectRepository
{
    Task<Project?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Project>> ListByOrgAsync(Guid orgId, CancellationToken ct);
    Task AddAsync(Project project, CancellationToken ct);
}

public interface IUserRepository
{
    Task<AppUser?> GetByEmailAsync(Guid orgId, string email, CancellationToken ct);
    Task<AppUser?> GetByIdAsync(Guid id, CancellationToken ct);
    Task AddAsync(AppUser user, CancellationToken ct);
}

public interface IRefreshTokenRepository
{
    Task AddAsync(RefreshToken token, CancellationToken ct);
    Task<RefreshToken?> GetByHashAsync(string hash, CancellationToken ct);
}

public interface IJwtTokenService
{
    string CreateAccessToken(AppUser user, IEnumerable<string> permissions);
    (string token, string hash, DateTimeOffset expires) CreateRefreshToken();
}

public interface ICurrentUser
{
    Guid UserId { get; }
    Guid OrganizationId { get; }
    bool Has(string permission);
}

public interface IRealtimePublisher
{
    Task IssueMoved(Guid projectId, Guid issueId, string status);
    Task CommentAdded(Guid projectId, Guid issueId);
    Task SprintUpdated(Guid projectId, Guid sprintId);
}
