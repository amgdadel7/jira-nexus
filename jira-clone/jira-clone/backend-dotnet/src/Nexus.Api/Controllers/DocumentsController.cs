using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/documents")]
public class DocumentsController(ICurrentUser current) : ControllerBase
{
    [HttpGet]
    public IActionResult ListDocuments([FromQuery] Guid projectId)
    {
        return Ok(new[]
        {
            new { Id = "doc-1", Title = "Product Requirements Document (PRD) - Nexus Platform", Category = "Product Specs", Author = "Amjad A.", UpdatedAt = "Yesterday at 15:30" },
            new { Id = "doc-2", Title = "Architecture & Database Schema Overview", Category = "Engineering", Author = "Alex K.", UpdatedAt = "3 days ago" },
            new { Id = "doc-3", Title = "Sprint 24 Retrospective & Action Items", Category = "Sprint Notes", Author = "Sarah M.", UpdatedAt = "Oct 12, 2026" }
        });
    }

    [HttpPost]
    public IActionResult CreateDocument([FromBody] CreateDocDto dto)
    {
        return Ok(new
        {
            Id = $"doc-{Guid.NewGuid()}",
            dto.Title,
            dto.Content,
            dto.Category,
            Author = current.UserId.ToString(),
            UpdatedAt = "Just now"
        });
    }

    public record CreateDocDto(string Title, string Content, string Category);
}
