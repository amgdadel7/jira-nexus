using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Persistence;

namespace Nexus.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/forms")]
public class FormsController(NexusDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> ListForms([FromQuery] Guid projectId, CancellationToken ct)
    {
        var forms = await db.IntakeForms
            .Where(x => projectId == Guid.Empty || x.ProjectId == projectId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);
        return Ok(forms);
    }

    [HttpPost]
    public async Task<IActionResult> CreateForm([FromBody] CreateFormDto dto, CancellationToken ct)
    {
        var form = new IntakeForm
        {
            Id = Guid.NewGuid(),
            ProjectId = dto.ProjectId,
            Name = dto.Name,
            Description = dto.Description,
            Icon = dto.Icon ?? "📝",
            Color = dto.Color ?? "#0052CC",
            FieldsJson = dto.FieldsJson ?? "[]",
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.IntakeForms.Add(form);
        await db.SaveChangesAsync(ct);
        return Ok(form);
    }

    [HttpGet("{formId:guid}/submissions")]
    public async Task<IActionResult> GetSubmissions(Guid formId, CancellationToken ct)
    {
        var subs = await db.FormSubmissions
            .Where(x => x.FormId == formId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);
        return Ok(subs);
    }

    [HttpPost("{formId:guid}/submit")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitForm(Guid formId, [FromBody] SubmitDto dto, CancellationToken ct)
    {
        var submission = new FormSubmission
        {
            Id = Guid.NewGuid(),
            FormId = formId,
            Title = dto.Title,
            Submitter = dto.Submitter,
            Status = "New",
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.FormSubmissions.Add(submission);
        await db.SaveChangesAsync(ct);
        return Ok(submission);
    }

    public record CreateFormDto(Guid ProjectId, string Name, string? Description, string? Icon, string? Color, string? FieldsJson);
    public record SubmitDto(string Title, string Submitter);
}
