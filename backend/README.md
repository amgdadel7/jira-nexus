# Nexus.Api

ASP.NET Core 8 backend. Clean Architecture + CQRS (MediatR) + EF Core + PostgreSQL + SignalR + JWT.

```
dotnet restore
dotnet test tests/Nexus.Application.Tests
dotnet run --project src/Nexus.Api
```

Configure `ConnectionStrings:Postgres` and `Jwt:Key` before deploying. Apply `../database/schema.sql` first.
