using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Workspace;

// ---------- Saved Filters ----------

public record GetFiltersQuery : IRequest<IEnumerable<FilterDto>>;

public class GetFiltersQueryHandler : IRequestHandler<GetFiltersQuery, IEnumerable<FilterDto>>
{
    private readonly IApplicationDbContext _context;

    public GetFiltersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<FilterDto>> Handle(GetFiltersQuery request, CancellationToken cancellationToken)
    {
        var filters = await _context.SavedFilters
            .Include(f => f.Owner)
            .OrderBy(f => f.Name)
            .ToListAsync(cancellationToken);

        return filters.Select(f => new FilterDto(
            f.Id,
            f.Name,
            f.Description,
            f.Jql,
            f.Owner != null ? new UserDto(f.Owner.Id, f.Owner.Name, f.Owner.Email, f.Owner.Color, f.Owner.Role, f.Owner.Active, f.Owner.Title, null, f.Owner.Bot) : null,
            f.Starred,
            f.CreatedAt,
            f.UpdatedAt
        ));
    }
}

public record CreateFilterCommand(CreateFilterRequest Request) : IRequest<FilterDto>;

public class CreateFilterCommandHandler : IRequestHandler<CreateFilterCommand, FilterDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CreateFilterCommandHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<FilterDto> Handle(CreateFilterCommand command, CancellationToken cancellationToken)
    {
        var req = command.Request;
        var filter = new SavedFilter
        {
            Name = req.Name.Trim(),
            Description = req.Description ?? string.Empty,
            Jql = req.Jql ?? string.Empty,
            OwnerId = _currentUser.UserId ?? "u1",
            Starred = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _context.SavedFilters.Add(filter);
        await _context.SaveChangesAsync(cancellationToken);

        return new FilterDto(filter.Id, filter.Name, filter.Description, filter.Jql, null, false, filter.CreatedAt, filter.UpdatedAt);
    }
}

// ---------- Goals ----------

public record GetGoalsQuery(string? ProjectKey) : IRequest<IEnumerable<GoalDto>>;

public class GetGoalsQueryHandler : IRequestHandler<GetGoalsQuery, IEnumerable<GoalDto>>
{
    private readonly IApplicationDbContext _context;

    public GetGoalsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<GoalDto>> Handle(GetGoalsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Goals.Include(g => g.Owner).Include(g => g.Issues).AsQueryable();
        if (!string.IsNullOrEmpty(request.ProjectKey))
        {
            query = query.Where(g => g.ProjectKey == request.ProjectKey.ToUpperInvariant());
        }

        var goals = await query.OrderBy(g => g.TargetDate).ToListAsync(cancellationToken);
        return goals.Select(g => new GoalDto(
            g.Id,
            g.Name,
            g.Description,
            g.Status,
            g.Owner != null ? new UserDto(g.Owner.Id, g.Owner.Name, g.Owner.Email, g.Owner.Color, g.Owner.Role, g.Owner.Active, g.Owner.Title, null, g.Owner.Bot) : null,
            g.TargetDate,
            g.Progress,
            g.Issues.Count,
            0,
            null,
            g.CreatedAt,
            g.UpdatedAt
        ));
    }
}

public record CreateGoalCommand(CreateGoalRequest Request) : IRequest<GoalDto>;

public class CreateGoalCommandHandler : IRequestHandler<CreateGoalCommand, GoalDto>
{
    private readonly IApplicationDbContext _context;

    public CreateGoalCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<GoalDto> Handle(CreateGoalCommand command, CancellationToken cancellationToken)
    {
        var req = command.Request;
        var goal = new Goal
        {
            ProjectKey = req.Project?.ToUpperInvariant(),
            Name = req.Name.Trim(),
            Description = req.Description ?? string.Empty,
            Status = req.Status ?? "on_track",
            OwnerId = req.OwnerId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        if (DateOnly.TryParse(req.TargetDate, out var td)) goal.TargetDate = td;

        _context.Goals.Add(goal);
        await _context.SaveChangesAsync(cancellationToken);

        return new GoalDto(goal.Id, goal.Name, goal.Description, goal.Status, null, goal.TargetDate, 0, 0, 0, null, goal.CreatedAt, goal.UpdatedAt);
    }
}

// ---------- Forms ----------

public record GetFormsQuery(string? ProjectKey) : IRequest<IEnumerable<FormDto>>;

public class GetFormsQueryHandler : IRequestHandler<GetFormsQuery, IEnumerable<FormDto>>
{
    private readonly IApplicationDbContext _context;

    public GetFormsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<FormDto>> Handle(GetFormsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.WorkForms.AsQueryable();
        if (!string.IsNullOrEmpty(request.ProjectKey))
        {
            query = query.Where(f => f.ProjectKey == request.ProjectKey.ToUpperInvariant());
        }

        var forms = await query.OrderBy(f => f.Name).ToListAsync(cancellationToken);
        return forms.Select(f => new FormDto(
            f.Id,
            f.ProjectKey,
            f.Name,
            f.Description,
            f.IssueType,
            JsonSerializer.Deserialize<object>(f.FieldsJson ?? "[]") ?? new object[] { },
            f.Enabled,
            f.CreatedAt,
            f.UpdatedAt
        ));
    }
}

// ---------- Custom Fields ----------

public record GetCustomFieldsQuery : IRequest<IEnumerable<CustomFieldDto>>;

public class GetCustomFieldsQueryHandler : IRequestHandler<GetCustomFieldsQuery, IEnumerable<CustomFieldDto>>
{
    private readonly IApplicationDbContext _context;

    public GetCustomFieldsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<CustomFieldDto>> Handle(GetCustomFieldsQuery request, CancellationToken cancellationToken)
    {
        var fields = await _context.CustomFields.OrderBy(cf => cf.Name).ToListAsync(cancellationToken);
        return fields.Select(cf => new CustomFieldDto(
            cf.Id,
            cf.Name,
            cf.Description,
            cf.Type,
            JsonSerializer.Deserialize<object>(cf.OptionsJson ?? "[]"),
            cf.Searchable,
            cf.CreatedAt
        ));
    }
}

// ---------- Automation Rules ----------

public record GetAutomationRulesQuery(string? ProjectKey) : IRequest<IEnumerable<AutomationRuleDto>>;

public class GetAutomationRulesQueryHandler : IRequestHandler<GetAutomationRulesQuery, IEnumerable<AutomationRuleDto>>
{
    private readonly IApplicationDbContext _context;

    public GetAutomationRulesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AutomationRuleDto>> Handle(GetAutomationRulesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.AutomationRules.Include(ar => ar.CreatedBy).AsQueryable();
        if (!string.IsNullOrEmpty(request.ProjectKey))
        {
            query = query.Where(ar => ar.ProjectKey == request.ProjectKey.ToUpperInvariant());
        }

        var rules = await query.OrderBy(ar => ar.Name).ToListAsync(cancellationToken);
        return rules.Select(ar => new AutomationRuleDto(
            ar.Id,
            ar.ProjectKey,
            ar.Name,
            ar.Description,
            ar.Enabled,
            ar.Trigger,
            ar.Condition,
            JsonSerializer.Deserialize<object>(ar.ActionsJson ?? "[]") ?? new object[] { },
            ar.CreatedBy != null ? new UserDto(ar.CreatedBy.Id, ar.CreatedBy.Name, ar.CreatedBy.Email, ar.CreatedBy.Color, ar.CreatedBy.Role, ar.CreatedBy.Active, ar.CreatedBy.Title, null, ar.CreatedBy.Bot) : null,
            ar.CreatedAt,
            ar.UpdatedAt
        ));
    }
}

// ---------- Webhooks ----------

public record GetWebhooksQuery : IRequest<IEnumerable<WebhookDto>>;

public class GetWebhooksQueryHandler : IRequestHandler<GetWebhooksQuery, IEnumerable<WebhookDto>>
{
    private readonly IApplicationDbContext _context;

    public GetWebhooksQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<WebhookDto>> Handle(GetWebhooksQuery request, CancellationToken cancellationToken)
    {
        var hooks = await _context.Webhooks.Include(w => w.CreatedBy).OrderBy(w => w.Name).ToListAsync(cancellationToken);
        return hooks.Select(w => new WebhookDto(
            w.Id,
            w.Name,
            w.Url,
            JsonSerializer.Deserialize<object>(w.EventsJson ?? "[]") ?? new object[] { },
            w.Jql,
            w.Enabled,
            w.CreatedBy != null ? new UserDto(w.CreatedBy.Id, w.CreatedBy.Name, w.CreatedBy.Email, w.CreatedBy.Color, w.CreatedBy.Role, w.CreatedBy.Active, w.CreatedBy.Title, null, w.CreatedBy.Bot) : null,
            w.CreatedAt,
            w.UpdatedAt
        ));
    }
}
