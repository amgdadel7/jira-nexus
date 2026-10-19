using FluentValidation;
using MediatR;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Shared;

namespace Nexus.Application.Auth;

public record AuthTokensDto(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, Guid UserId, string Name, string Email);

public record LoginCommand(string Email, string Password, Guid OrganizationId) : IRequest<Result<AuthTokensDto>>;

public class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class LoginHandler(
    IUserRepository users,
    IRefreshTokenRepository tokens,
    IJwtTokenService jwt,
    IUnitOfWork uow,
    IPasswordHasher hasher) : IRequestHandler<LoginCommand, Result<AuthTokensDto>>
{
    public async Task<Result<AuthTokensDto>> Handle(LoginCommand req, CancellationToken ct)
    {
        var user = await users.GetByEmailAsync(req.OrganizationId, req.Email, ct);
        if (user is null || user.PasswordHash is null || !hasher.Verify(req.Password, user.PasswordHash))
            return Result<AuthTokensDto>.Fail("Invalid credentials");

        var access = jwt.CreateAccessToken(user, ["Issue.Create", "Issue.Update", "Sprint.Manage", "Board.Manage"]);
        var refresh = jwt.CreateRefreshToken();
        await tokens.AddAsync(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refresh.hash,
            ExpiresAt = refresh.expires
        }, ct);
        await uow.SaveChangesAsync(ct);
        return Result<AuthTokensDto>.Ok(new AuthTokensDto(access, refresh.token, refresh.expires, user.Id, user.Name, user.Email));
    }
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public record RefreshCommand(string RefreshToken) : IRequest<Result<AuthTokensDto>>;
