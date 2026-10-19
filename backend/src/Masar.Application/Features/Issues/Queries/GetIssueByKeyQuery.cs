using MediatR;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Application.DTOs;
using Masar.Domain.Exceptions;

namespace Masar.Application.Features.Issues.Queries;

public record GetIssueByKeyQuery(string Key) : IRequest<IssueDetailDto>;

public class GetIssueByKeyQueryHandler : IRequestHandler<GetIssueByKeyQuery, IssueDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public GetIssueByKeyQueryHandler(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<IssueDetailDto> Handle(GetIssueByKeyQuery request, CancellationToken cancellationToken)
    {
        var key = request.Key.ToUpperInvariant();
        var item = await _context.IssueView.FirstOrDefaultAsync(i => i.Key == key, cancellationToken);

        if (item == null)
        {
            throw new NotFoundException($"Work item {key} does not exist.");
        }

        var baseDto = SearchIssuesQueryHandler.MapIssueDto(item);

        var children = (await _context.IssueView
            .Where(i => i.ParentId == item.Id)
            .OrderBy(i => i.Rank)
            .ToListAsync(cancellationToken))
            .Select(SearchIssuesQueryHandler.MapIssueDto);

        var comments = (await _context.Comments
            .Where(c => c.IssueId == item.Id)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(cancellationToken))
            .Select(c => new CommentDto(c.Id, c.AuthorId, c.Body, c.CreatedAt, c.UpdatedAt));

        var history = (await _context.HistoryEntries
            .Where(h => h.IssueId == item.Id)
            .OrderByDescending(h => h.CreatedAt)
            .ToListAsync(cancellationToken))
            .Select(h => new HistoryDto(h.Id, h.AuthorId, h.Field, h.FromValue, h.ToValue, h.CreatedAt));

        var watchers = await _context.Watchers
            .Where(w => w.IssueId == item.Id)
            .Select(w => w.UserId)
            .ToListAsync(cancellationToken);

        var voters = await _context.Votes
            .Where(v => v.IssueId == item.Id)
            .Select(v => v.UserId)
            .ToListAsync(cancellationToken);

        var viewerId = _currentUser.UserId ?? string.Empty;

        return new IssueDetailDto(baseDto)
        {
            Children = children,
            Comments = comments,
            History = history,
            Watchers = watchers,
            Watching = watchers.Contains(viewerId),
            Voters = voters,
            Voted = voters.Contains(viewerId),
            Permissions = ["BROWSE_PROJECT", "CREATE_ISSUES", "EDIT_ISSUES", "TRANSITION_ISSUES", "ASSIGN_ISSUES", "ADD_COMMENTS"]
        };
    }
}
