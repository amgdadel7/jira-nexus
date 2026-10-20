using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Masar.Application.Abstractions;

namespace Masar.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var isProduction = string.Equals(environment, "Production", StringComparison.OrdinalIgnoreCase);

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (isProduction)
        {
            if (string.IsNullOrWhiteSpace(connectionString) ||
                connectionString.Contains("YOUR_SECURE_PASSWORD", StringComparison.OrdinalIgnoreCase) ||
                connectionString.Contains("Password=admin", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("FATAL: In production, ConnectionStrings:DefaultConnection must be set with valid production credentials. Insecure/default passwords are not permitted.");
            }
        }
        else if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "Host=localhost;Port=5432;Database=masar;Username=postgres;Password=admin";
        }

        services.AddDbContext<MasarDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<MasarDbContext>());

        return services;
    }
}
