namespace Nexus.Application.Ai;

/// <summary>
/// Optional AI services. Implementations can call Azure OpenAI / the model gateway.
/// Keep the interface in Application so Infrastructure can swap providers.
/// </summary>
public interface IProjectInsights
{
    Task<SprintRisk> PredictSprintRisk(Guid sprintId, CancellationToken ct);
    Task<IReadOnlyList<Guid>> RecommendAssignees(Guid issueId, CancellationToken ct);
    Task<string> CategorizeIssue(string title, string description, CancellationToken ct);
}

public record SprintRisk(Guid SprintId, double SpilloverProbability, string Summary);

public class HeuristicProjectInsights : IProjectInsights
{
    public Task<SprintRisk> PredictSprintRisk(Guid sprintId, CancellationToken ct) =>
        Task.FromResult(new SprintRisk(sprintId, 0.27, "Velocity is tracking 6% under commitment. Watch Payments carry-over."));

    public Task<IReadOnlyList<Guid>> RecommendAssignees(Guid issueId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Guid>>([]);

    public Task<string> CategorizeIssue(string title, string description, CancellationToken ct)
    {
        var text = $"{title} {description}".ToLowerInvariant();
        if (text.Contains("bug") || text.Contains("fail")) return Task.FromResult("bug");
        if (text.Contains("epic")) return Task.FromResult("epic");
        return Task.FromResult("story");
    }
}
