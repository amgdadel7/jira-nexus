using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Application.Features.Auth.Commands;
using Masar.Application.Features.Auth.Queries;

namespace Masar.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IApplicationDbContext _dbContext;

    public AuthController(IMediator mediator, IApplicationDbContext dbContext)
    {
        _mediator = mediator;
        _dbContext = dbContext;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var userAgent = Request.Headers.UserAgent.ToString();
        var result = await _mediator.Send(new LoginCommand(request, userAgent), cancellationToken);

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Expires = result.Remember ? DateTimeOffset.Parse(result.ExpiresAt) : null,
            Path = "/"
        };

        Response.Cookies.Append("jc_session", result.Token, cookieOptions);

        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout(CancellationToken cancellationToken)
    {
        var token = HttpContext.Items["SessionToken"] as string
            ?? Request.Cookies["jc_session"];

        if (!string.IsNullOrEmpty(token))
        {
            var session = await _dbContext.Sessions.FirstOrDefaultAsync(s => s.Token == token, cancellationToken);
            if (session != null)
            {
                _dbContext.Sessions.Remove(session);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        Response.Cookies.Delete("jc_session", new CookieOptions { Path = "/" });
        return Ok(new { ok = true });
    }

    [HttpGet("me")]
    public async Task<ActionResult<AuthMeResponse>> GetMe(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetCurrentUserQuery(), cancellationToken);
        return Ok(result);
    }
}
