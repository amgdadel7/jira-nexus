using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Masar.Application.Abstractions;
using Masar.Domain.Entities;

namespace Masar.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private HttpContext? HttpContext => _httpContextAccessor.HttpContext;

    public User? User => HttpContext?.Items["CurrentUser"] as User;

    public string? UserId => User?.Id ?? HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? HttpContext?.User.FindFirstValue("sub");

    public string? Email => User?.Email ?? HttpContext?.User.FindFirstValue(ClaimTypes.Email);

    public string? Role => User?.Role ?? HttpContext?.User.FindFirstValue(ClaimTypes.Role) ?? "member";

    public bool IsAuthenticated => User != null || (HttpContext?.User.Identity?.IsAuthenticated ?? false);

    public bool IsAdmin => Role == "admin";
}
