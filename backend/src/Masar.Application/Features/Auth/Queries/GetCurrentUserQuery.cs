using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Auth.Queries;

public record GetCurrentUserQuery : IRequest<AuthMeResponse>;

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, AuthMeResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetCurrentUserQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<AuthMeResponse> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserService.IsAuthenticated || string.IsNullOrEmpty(_currentUserService.UserId))
        {
            throw new UnauthorizedException("You need to log in.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId, cancellationToken);

        if (user == null || !user.Active)
        {
            throw new UnauthorizedException("You need to log in.");
        }

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

        return new AuthMeResponse(userDto);
    }
}
