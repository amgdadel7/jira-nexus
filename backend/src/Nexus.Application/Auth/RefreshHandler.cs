using MediatR;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Shared;
using System.Security.Cryptography;

namespace Nexus.Application.Auth;

public class RefreshHandler(
    IRefreshTokenRepository tokens,
    IUserRepository users,
    IJwtTokenService jwt,
    IUnitOfWork uow) : IRequestHandler<RefreshCommand, Result<AuthTokensDto>>
{
    public async Task<Result<AuthTokensDto>> Handle(RefreshCommand req, CancellationToken ct)
    {
        var bytes = Convert.FromBase64String(req.RefreshToken);
        var hash = Convert.ToHexString(SHA256.HashData(bytes));
        var stored = await tokens.GetByHashAsync(hash, ct);
        if (stored is null || stored.RevokedAt is not null || stored.ExpiresAt < DateTimeOffset.UtcNow)
            return Result<AuthTokensDto>.Fail("Invalid refresh token");

        stored.RevokedAt = DateTimeOffset.UtcNow;
        var user = await users.GetByIdAsync(stored.UserId, ct);
        if (user is null) return Result<AuthTokensDto>.Fail("User not found");

        var access = jwt.CreateAccessToken(user, ["Issue.Create", "Issue.Update", "Sprint.Manage", "Board.Manage"]);
        var next = jwt.CreateRefreshToken();
        stored.ReplacedBy = Guid.NewGuid();
        await tokens.AddAsync(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = next.hash,
            ExpiresAt = next.expires
        }, ct);
        await uow.SaveChangesAsync(ct);
        return Result<AuthTokensDto>.Ok(new AuthTokensDto(access, next.token, next.expires, user.Id, user.Name, user.Email));
    }
}
