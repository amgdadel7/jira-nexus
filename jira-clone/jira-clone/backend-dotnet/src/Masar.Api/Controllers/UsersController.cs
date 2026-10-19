using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Exceptions;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public UsersController(IApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await _context.Users
            .Where(u => u.Active)
            .OrderBy(u => u.Name)
            .Select(u => new UserDto(
                u.Id,
                u.Name,
                u.Email,
                u.Color,
                u.Role,
                u.Active,
                u.Title,
                u.Avatar != null ? $"/api/avatars/{u.Avatar}" : null,
                u.Bot
            ))
            .ToListAsync(cancellationToken);

        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UserDto>> GetUserById(string id, CancellationToken cancellationToken)
    {
        var u = await _context.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (u == null) throw new NotFoundException($"User {id} not found.");

        return Ok(new UserDto(
            u.Id,
            u.Name,
            u.Email,
            u.Color,
            u.Role,
            u.Active,
            u.Title,
            u.Avatar != null ? $"/api/avatars/{u.Avatar}" : null,
            u.Bot
        ));
    }
}
