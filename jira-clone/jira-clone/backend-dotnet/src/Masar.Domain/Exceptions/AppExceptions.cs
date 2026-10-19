namespace Masar.Domain.Exceptions;

public abstract class AppException : Exception
{
    public int StatusCode { get; }

    protected AppException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message = "Resource not found.") : base(message, 404) { }
}

public class ValidationException : AppException
{
    public ValidationException(string message = "Invalid input.") : base(message, 400) { }
}

public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "You need to log in.") : base(message, 401) { }
}

public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "You don't have permission to do that.") : base(message, 403) { }
}

public class ConflictException : AppException
{
    public ConflictException(string message = "That already exists.") : base(message, 409) { }
}
