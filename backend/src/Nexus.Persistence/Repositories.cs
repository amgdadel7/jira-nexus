using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Shared;

namespace Nexus.Persistence;

public class IssueRepository(NexusDbContext db) : IIssueRepository
{
    public Task<Issue?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Issues.FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<Issue?> GetByKeyAsync(string key, CancellationToken ct) =>
        db.Issues.FirstOrDefaultAsync(x => x.Key == key, ct);

    public async Task<Paged<Issue>> ListAsync(Guid projectId, string? status, string? query, int page, int size, CancellationToken ct)
    {
        var q = db.Issues.AsNoTracking().Where(i => i.ProjectId == projectId);
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(i => i.Status == status);
        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.ToLower();
            q = q.Where(i => i.Title.ToLower().Contains(term) || i.Key.ToLower().Contains(term));
        }
        var total = await q.CountAsync(ct);
        var items = await q.OrderBy(i => i.Rank).ThenBy(i => i.CreatedAt)
            .Skip((page - 1) * size).Take(size).ToListAsync(ct);
        return new Paged<Issue> { Items = items, Total = total, Page = page, PageSize = size };
    }

    public Task AddAsync(Issue issue, CancellationToken ct) => db.Issues.AddAsync(issue, ct).AsTask();
    public void Remove(Issue issue) => db.Issues.Remove(issue);
}

public class ProjectRepository(NexusDbContext db) : IProjectRepository
{
    public Task<Project?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Projects.FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<IReadOnlyList<Project>> ListByOrgAsync(Guid orgId, CancellationToken ct) =>
        await db.Projects.AsNoTracking().Where(p => p.OrganizationId == orgId).ToListAsync(ct);

    public Task AddAsync(Project project, CancellationToken ct) => db.Projects.AddAsync(project, ct).AsTask();
}

public class UserRepository(NexusDbContext db) : IUserRepository
{
    public Task<AppUser?> GetByEmailAsync(Guid orgId, string email, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.OrganizationId == orgId && u.Email == email, ct);

    public Task<AppUser?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task AddAsync(AppUser user, CancellationToken ct) => db.Users.AddAsync(user, ct).AsTask();
}

public class RefreshTokenRepository(NexusDbContext db) : IRefreshTokenRepository
{
    public Task AddAsync(RefreshToken token, CancellationToken ct) => db.RefreshTokens.AddAsync(token, ct).AsTask();
    public Task<RefreshToken?> GetByHashAsync(string hash, CancellationToken ct) =>
        db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
}
