using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/ai")]
public class AiAssistantController : ControllerBase
{
    [HttpPost("rovo")]
    public IActionResult AskRovo([FromBody] RovoQueryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
        {
            return BadRequest(new { error = "Prompt is required" });
        }

        var prompt = request.Prompt.ToLowerInvariant();
        string answer;
        var matchedKeys = new List<string>();

        if (prompt.Contains("blocker") || prompt.Contains("bug"))
        {
            answer = "Found 1 high priority blocker item: **KAN-1: Complete analysis**. Recommended to complete before pulling new work items.";
            matchedKeys.Add("KAN-1");
        }
        else if (prompt.Contains("acceptance criteria") || prompt.Contains("criteria"))
        {
            answer = "### Generated Acceptance Criteria:\n- **Given** user opens Jira issue board\n- **When** drag and dropping an issue\n- **Then** status updates and is persisted in database without page reload.";
            matchedKeys.Add("KAN-1");
        }
        else if (prompt.Contains("workload") || prompt.Contains("sprint"))
        {
            answer = "### Workload Summary:\n- Total active items: 2\n- 1 In Progress, 1 Done\n- Velocity is within expected parameters.";
        }
        else
        {
            answer = $"Rovo evaluated your request: \"{request.Prompt}\" against project context. All project components and database tables are aligned.";
        }

        return Ok(new
        {
            response = answer,
            matchedIssues = matchedKeys,
            model = "atlassian-intelligence-rovo-v1",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpPost("jql-search")]
    public IActionResult JqlSearch([FromBody] JqlSearchRequest request)
    {
        // Simple JQL verification and mock parser
        var jql = request.Jql ?? string.Empty;
        var isValid = !jql.EndsWith("AND", StringComparison.OrdinalIgnoreCase) &&
                      !jql.EndsWith("OR", StringComparison.OrdinalIgnoreCase);

        return Ok(new
        {
            valid = isValid,
            jql,
            interpretedFields = new[] { "status", "priority", "assignee", "type" },
            executedAt = DateTime.UtcNow
        });
    }

    public record RovoQueryRequest(string Prompt, string? ProjectKey);
    public record JqlSearchRequest(string Jql);
}
