using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Entities;
using Masar.Domain.Exceptions;
using System.Text.RegularExpressions;

namespace Masar.Application.Features.Issues.Queries;

public record SearchIssuesQuery(string? Jql, int StartAt = 0, int MaxResults = 50) : IRequest<SearchResponse>;

public class SearchIssuesQueryHandler : IRequestHandler<SearchIssuesQuery, SearchResponse>
{
    private readonly IApplicationDbContext _context;

    public SearchIssuesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SearchResponse> Handle(SearchIssuesQuery request, CancellationToken cancellationToken)
    {
        var jql = string.IsNullOrWhiteSpace(request.Jql) ? "project = KAN ORDER BY cf[10019] ASC" : request.Jql;
        var query = _context.IssueView.AsNoTracking();

        // Parse project filter from JQL (e.g. project = KAN or project in (KAN, PAY))
        var projectMatch = Regex.Match(jql, @"project\s*=\s*['""]?([A-Za-z0-9_-]+)['""]?", RegexOptions.IgnoreCase);
        if (projectMatch.Success)
        {
            var projectKey = projectMatch.Groups[1].Value.ToUpperInvariant();
            query = query.Where(i => i.ProjectKey == projectKey);
        }

        // Parse statusCategory filter (e.g. statusCategory = 'done' or statusCategory != 'done')
        var statusCatMatch = Regex.Match(jql, @"statuscategory\s*(!=|<>|=)\s*['""]?([A-Za-z0-9_-]+)['""]?", RegexOptions.IgnoreCase);
        if (statusCatMatch.Success)
        {
            var op = statusCatMatch.Groups[1].Value;
            var cat = statusCatMatch.Groups[2].Value.ToLowerInvariant();
            if (op == "=")
                query = query.Where(i => i.StatusCategory == cat);
            else
                query = query.Where(i => i.StatusCategory != cat);
        }

        // Parse text search (text ~ '...')
        var textMatch = Regex.Match(jql, @"text\s*~\s*['""]([^'""]+)['""]", RegexOptions.IgnoreCase);
        if (textMatch.Success)
        {
            var term = textMatch.Groups[1].Value.ToLowerInvariant();
            query = query.Where(i => i.Summary.ToLower().Contains(term) || i.Description.ToLower().Contains(term) || i.Key.ToLower().Contains(term));
        }

        // Ordering
        bool desc = jql.Contains("DESC", StringComparison.OrdinalIgnoreCase);
        if (jql.Contains("created", StringComparison.OrdinalIgnoreCase))
        {
            query = desc ? query.OrderByDescending(i => i.CreatedAt) : query.OrderBy(i => i.CreatedAt);
        }
        else if (jql.Contains("updated", StringComparison.OrdinalIgnoreCase))
        {
            query = desc ? query.OrderByDescending(i => i.UpdatedAt) : query.OrderBy(i => i.UpdatedAt);
        }
        else
        {
            // Default rank ordering
            query = desc ? query.OrderByDescending(i => i.Rank) : query.OrderBy(i => i.Rank);
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .Skip(request.StartAt)
            .Take(Math.Min(request.MaxResults, 1000))
            .ToListAsync(cancellationToken);

        var issues = rows.Select(MapIssueDto);
        var sortList = new List<SearchSortItemDto>
        {
            new("rank", desc ? "DESC" : "ASC")
        };

        return new SearchResponse(jql, request.StartAt, request.MaxResults, total, sortList, issues);
    }

    public static IssueDto MapIssueDto(IssueViewItem r)
    {
        return new IssueDto(
            r.Id,
            r.Key,
            r.ProjectKey,
            r.Type,
            r.Summary,
            r.Description,
            r.Status,
            r.StatusCategory,
            r.Priority,
            r.Resolution,
            r.AssigneeId,
            r.ReporterId,
            string.IsNullOrEmpty(r.ParentKey) ? null : new IssueParentDto(r.ParentKey, r.ParentSummary ?? string.Empty, r.ParentType ?? string.Empty),
            r.Labels ?? Array.Empty<string>(),
            r.DueDate,
            r.StartDate,
            r.StoryPoints,
            r.Sprint,
            r.FixVersion,
            r.Rank,
            r.Components ?? Array.Empty<string>(),
            r.TeamId,
            r.CreatedAt,
            r.UpdatedAt,
            r.ResolvedAt,
            r.CommentCount,
            r.ChildCount,
            r.ChildDoneCount,
            r.AttachmentCount,
            r.LinkCount,
            r.VoteCount,
            r.OriginalEstimate,
            r.RemainingEstimate,
            r.TimeSpent
        );
    }
}
