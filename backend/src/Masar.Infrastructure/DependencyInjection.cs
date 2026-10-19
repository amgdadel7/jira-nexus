using Microsoft.Extensions.DependencyInjection;
using Masar.Application.Abstractions;
using Masar.Infrastructure.Services;

namespace Masar.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        return services;
    }
}
