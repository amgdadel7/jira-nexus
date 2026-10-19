using System.Text.Json.Serialization;

namespace Masar.Application.DTOs;

public record LoginRequest(
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("password")] string Password,
    [property: JsonPropertyName("remember")] bool? Remember
);

public record UserDto(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("color")] string Color,
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("active")] bool Active,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("avatarUrl")] string? AvatarUrl,
    [property: JsonPropertyName("bot")] bool? Bot = null
);

public record LoginResponse(
    [property: JsonPropertyName("user")] UserDto User,
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("remember")] bool Remember
);

public record AuthMeResponse(
    [property: JsonPropertyName("user")] UserDto User
);
