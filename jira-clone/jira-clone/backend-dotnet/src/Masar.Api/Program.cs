using System.Text.Json;
using System.Text.Json.Serialization;
using Masar.Api.Middlewares;
using Masar.Application;
using Masar.Infrastructure;
using Masar.Persistence;

var builder = WebApplication.CreateBuilder(args);

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

var app = builder.Build();

// Global Exception Handler
app.UseMiddleware<ErrorHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowClient");

// Session authentication middleware
app.UseMiddleware<SessionAuthMiddleware>();

app.MapControllers();

app.Run();
