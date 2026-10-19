using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;
using System.Security.Cryptography;

namespace Masar.Application.Features.Auth.Commands;

public record LoginCommand(LoginRequest Request, string? UserAgent) : IRequest<LoginResponse>;

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public LoginCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var email = request.Request.Email?.Trim().ToLowerInvariant();
        var password = request.Request.Password;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password))
        {
            throw new ValidationException("Enter your email and password.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email, cancellationToken);

        if (user == null || !_passwordHasher.VerifyPassword(password, user.PasswordHash))
        {
            throw new UnauthorizedException("Incorrect email address and / or password.");
        }

        if (!user.Active)
        {
            throw new ForbiddenException("Your account has been deactivated. Contact an administrator.");
        }

        bool remember = request.Request.Remember ?? true;
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToHexString(tokenBytes).ToLowerInvariant();

        var expiresAt = remember
            ? DateTimeOffset.UtcNow.AddDays(14)
            : DateTimeOffset.UtcNow.AddHours(12);

        var session = new Session
        {
            Token = token,
            UserId = user.Id,
            UserAgent = request.UserAgent?.Length > 300 ? request.UserAgent[..300] : (request.UserAgent ?? string.Empty),
            Remember = remember,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = expiresAt
        };

        _context.Sessions.Add(session);
        await _context.SaveChangesAsync(cancellationToken);

        var userDto = new UserDto(
            user.Id,
            user.Name,
            user.Email,
            user.Color,
            user.Role,
            user.Active,
            user.Title,
            string.IsNullOrEmpty(user.Avatar) ? null : $"/api/avatars/{user.Avatar}",
            user.Bot ? true : null
        );

        return new LoginResponse(userDto, token, expiresAt.ToString("o"), remember);
    }
}
