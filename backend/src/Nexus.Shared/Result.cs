namespace Nexus.Shared;

public class Result
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public static Result Ok() => new() { Succeeded = true };
    public static Result Fail(string error) => new() { Succeeded = false, Error = error };
}

public class Result<T> : Result
{
    public T? Value { get; init; }
    public static Result<T> Ok(T value) => new() { Succeeded = true, Value = value };
    public static new Result<T> Fail(string error) => new() { Succeeded = false, Error = error };
}

public class Paged<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public required int Total { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
}
