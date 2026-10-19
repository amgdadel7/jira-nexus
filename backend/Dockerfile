FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy csproj files and restore
COPY src/Masar.Domain/Masar.Domain.csproj src/Masar.Domain/
COPY src/Masar.Application/Masar.Application.csproj src/Masar.Application/
COPY src/Masar.Persistence/Masar.Persistence.csproj src/Masar.Persistence/
COPY src/Masar.Infrastructure/Masar.Infrastructure.csproj src/Masar.Infrastructure/
COPY src/Masar.Api/Masar.Api.csproj src/Masar.Api/

RUN dotnet restore src/Masar.Api/Masar.Api.csproj

# Copy the rest of the source code
COPY src/ src/

# Publish
RUN dotnet publish src/Masar.Api/Masar.Api.csproj -c Release -o /out

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Masar.Api.dll"]
