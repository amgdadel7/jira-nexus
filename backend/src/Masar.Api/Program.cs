using System.Text.Json;
using System.Text.Json.Serialization;
using Masar.Api.Middlewares;
using Masar.Api.Services;
using Masar.Application;
using Masar.Infrastructure;
using Masar.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseSentry();

// Mirat Error Monitoring & HTTP services
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IMiratClient, MiratClient>();

// Add Clean Architecture layers

builder.Services.AddApplicationServices();
builder.Services.AddInfrastructure();
builder.Services.AddPersistence(builder.Configuration);

// Add Controllers with JSON camelCase formatting
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

// Configure CORS for Vite client and preview environments
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowClient", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Swagger / OpenAPI documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Masar API - Jira Clone Clean Architecture",
        Version = "v1",
        Description = ".NET 8 Clean Architecture API for Jira Clone (Masar)"
    });
});

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://*:{port}");
}

var app = builder.Build();

// Global Exception Handler
app.UseMiddleware<ErrorHandlingMiddleware>();

// Enable Swagger in all environments for cloud inspection
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Masar API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowClient");

// Session authentication middleware
app.UseMiddleware<SessionAuthMiddleware>();

app.MapGet("/", () => Results.Redirect("/swagger"));
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "Masar .NET API", time = DateTimeOffset.UtcNow }));

// Server-Sent Events (SSE) for presence and real-time updates
app.MapGet("/api/events", async (HttpContext context, CancellationToken ct) =>
{
    context.Response.Headers.Append("Content-Type", "text/event-stream; charset=utf-8");
    context.Response.Headers.Append("Cache-Control", "no-cache, no-transform");
    context.Response.Headers.Append("Connection", "keep-alive");
    context.Response.Headers.Append("X-Accel-Buffering", "no");

    await context.Response.WriteAsync("retry: 3000\n\n", ct);

    var currentUserId = (context.Items["CurrentUser"] as Masar.Domain.Entities.User)?.Id ?? "u1";
    var payload = JsonSerializer.Serialize(new { users = new[] { currentUserId } });

    await context.Response.WriteAsync($"event: hello\ndata: {payload}\n\n", ct);
    await context.Response.Body.FlushAsync(ct);

    await context.Response.WriteAsync($"event: presence\ndata: {payload}\n\n", ct);
    await context.Response.Body.FlushAsync(ct);

    try
    {
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(25000, ct);
            await context.Response.WriteAsync(": ping\n\n", ct);
            await context.Response.Body.FlushAsync(ct);
        }
    }
    catch (OperationCanceledException)
    {
        // Normal client disconnect
    }
});

app.MapControllers();
app.MapGet("/debug-sentry", () => { throw new InvalidOperationException("Masar Sentry Test Exception"); });

app.Run();

