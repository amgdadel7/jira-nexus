using System.Net;
using System.Text.Json;
using Masar.Domain.Exceptions;

namespace Masar.Api.Middlewares;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var statusCode = HttpStatusCode.InternalServerError;
        string message = exception.Message;

        switch (exception)
        {
            case NotFoundException:
                statusCode = HttpStatusCode.NotFound;
                break;
            case ValidationException:
                statusCode = HttpStatusCode.BadRequest;
                break;
            case UnauthorizedException:
                statusCode = HttpStatusCode.Unauthorized;
                break;
            case ForbiddenException:
                statusCode = HttpStatusCode.Forbidden;
                break;
            case ConflictException:
                statusCode = HttpStatusCode.Conflict;
                break;
            default:
                _logger.LogError(exception, "Unhandled exception occurred: {Message}", exception.Message);
                message = exception.Message;
                break;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var response = new { error = message };
        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
