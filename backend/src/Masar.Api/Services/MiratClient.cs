using System.Text;
using System.Text.Json;

namespace Masar.Api.Services;

public interface IMiratClient
{
    void CaptureException(Exception ex, HttpContext? context = null);
}

public class MiratClient : IMiratClient
{
    private readonly HttpClient _httpClient;
    private readonly string? _dsn;
    private readonly string _environment;
    private readonly string _release;

    public MiratClient(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("MiratClient");
        _httpClient.Timeout = TimeSpan.FromSeconds(3);

        _dsn = configuration["Mirat:Dsn"]
               ?? Environment.GetEnvironmentVariable("MIRAT_DSN")
               ?? string.Empty;

        _environment = configuration["Mirat:Environment"]
                       ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                       ?? "Production";

        _release = "1.0.0";
    }

    public void CaptureException(Exception ex, HttpContext? context = null)
    {
        if (string.IsNullOrWhiteSpace(_dsn)) return;

        _ = Task.Run(async () =>
        {
            try
            {
                var culprit = ex.TargetSite != null
                    ? $"{ex.TargetSite.DeclaringType?.Name}.{ex.TargetSite.Name}"
                    : (context?.Request?.Path.Value ?? "");

                var url = "";
                if (context?.Request is { } req)
                {
                    url = $"{req.Scheme}://{req.Host.Value}{req.Path.Value}";
                }

                var stacktrace = ex.StackTrace ?? "";
                if (stacktrace.Length > 12000) stacktrace = stacktrace[..12000];

                var payload = new
                {
                    type = ex.GetType().Name,
                    message = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message,
                    stacktrace,
                    culprit = culprit.Length > 500 ? culprit[..500] : culprit,
                    url,
                    environment = _environment,
                    release = _release,
                    timestamp = DateTime.UtcNow.ToString("o"),
                    level = "error"
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                await _httpClient.PostAsync(_dsn, content);
            }
            catch
            {
                // Error reporting must never disrupt application flow
            }
        });
    }
}
