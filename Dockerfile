FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy csproj files and restore
COPY backend/src/Masar.Domain/Masar.Domain.csproj backend/src/Masar.Domain/
COPY backend/src/Masar.Application/Masar.Application.csproj backend/src/Masar.Application/
COPY backend/src/Masar.Persistence/Masar.Persistence.csproj backend/src/Masar.Persistence/
COPY backend/src/Masar.Infrastructure/Masar.Infrastructure.csproj backend/src/Masar.Infrastructure/
COPY backend/src/Masar.Api/Masar.Api.csproj backend/src/Masar.Api/

RUN dotnet restore backend/src/Masar.Api/Masar.Api.csproj

# Copy the rest of the source code
COPY backend/src/ backend/src/

# Publish
RUN dotnet publish backend/src/Masar.Api/Masar.Api.csproj -c Release -o /out

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /out ./

ENV ASPNETCORE_HTTP_PORTS=8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Masar.Api.dll"]
