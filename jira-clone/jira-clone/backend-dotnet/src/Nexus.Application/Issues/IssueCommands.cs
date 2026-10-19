using FluentValidation;
using MediatR;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;
using Nexus.Shared;

namespace Nexus.Application.Issues;

public record IssueDto(
    Guid Id, string Key, string Title, string Type, string Status, string Priority,
    Guid ProjectId, Guid? SprintId, Guid? AssigneeId, Guid ReporterId,
    int? StoryPoints, string? Description, DateTimeOffset UpdatedAt);

public record CreateIssueCommand(
    Guid ProjectId, string Title, string Type, string Priority,
    Guid? AssigneeId, int? StoryPoints, string? Description) : IRequest<Result<IssueDto>>;

public class CreateIssueValidator : AbstractValidator<CreateIssueCommand>
{
    public CreateIssueValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(240);
        RuleFor(x => x.Type).NotEmpty();
        RuleFor(x => x.Priority).NotEmpty();
    }
}

public class CreateIssueHandler(IIssueRepository issues, IProjectRepository projects, ICurrentUser current, IUnitOfWork uow)
    : IRequestHandler<CreateIssueCommand, Result<IssueDto>>
{
    public async Task<Result<IssueDto>> Handle(CreateIssueCommand req, CancellationToken ct)
    {
        if (!current.Has("Issue.Create")) return Result<IssueDto>.Fail("Forbidden");
        var project = await projects.GetByIdAsync(req.ProjectId, ct);
        if (project is null) return Result<IssueDto>.Fail("Project not found");

        var list = await issues.ListAsync(req.ProjectId, null, null, 1, 1, ct);
        var number = list.Total + 1;
        var issue = new Issue
        {
            ProjectId = req.ProjectId,
            Number = number,
            Key = $"{project.Key}-{number}",
            Title = req.Title.Trim(),
            Type = req.Type,
            Priority = req.Priority,
            Status = "todo",
            AssigneeId = req.AssigneeId,
            ReporterId = current.UserId,
            StoryPoints = req.StoryPoints,
            Description = req.Description
        };
        await issues.AddAsync(issue, ct);
        await uow.SaveChangesAsync(ct);
        return Result<IssueDto>.Ok(Map(issue));
    }

    internal static IssueDto Map(Issue i) => new(
        i.Id, i.Key, i.Title, i.Type, i.Status, i.Priority, i.ProjectId, i.SprintId,
        i.AssigneeId, i.ReporterId, i.StoryPoints, i.Description, i.UpdatedAt);
}

public record MoveIssueCommand(Guid IssueId, string Status, decimal? Rank) : IRequest<Result<IssueDto>>;

public class MoveIssueHandler(IIssueRepository issues, ICurrentUser current, IUnitOfWork uow, IRealtimePublisher realtime)
    : IRequestHandler<MoveIssueCommand, Result<IssueDto>>
{
    public async Task<Result<IssueDto>> Handle(MoveIssueCommand req, CancellationToken ct)
    {
        if (!current.Has("Issue.Update")) return Result<IssueDto>.Fail("Forbidden");
        var issue = await issues.GetByIdAsync(req.IssueId, ct);
        if (issue is null) return Result<IssueDto>.Fail("Issue not found");
        issue.Status = req.Status;
        if (req.Rank.HasValue) issue.Rank = req.Rank.Value;
        issue.UpdatedAt = DateTimeOffset.UtcNow;
        await uow.SaveChangesAsync(ct);
        await realtime.IssueMoved(issue.ProjectId, issue.Id, issue.Status);
        return Result<IssueDto>.Ok(CreateIssueHandler.Map(issue));
    }
}

public record GetIssuesQuery(Guid ProjectId, string? Status, string? Query, int Page = 1, int PageSize = 50)
    : IRequest<Paged<IssueDto>>;

public class GetIssuesHandler(IIssueRepository issues) : IRequestHandler<GetIssuesQuery, Paged<IssueDto>>
{
    public async Task<Paged<IssueDto>> Handle(GetIssuesQuery req, CancellationToken ct)
    {
        var page = await issues.ListAsync(req.ProjectId, req.Status, req.Query, req.Page, req.PageSize, ct);
        return new Paged<IssueDto>
        {
            Items = page.Items.Select(CreateIssueHandler.Map).ToList(),
            Total = page.Total,
            Page = page.Page,
            PageSize = page.PageSize
        };
    }
}
