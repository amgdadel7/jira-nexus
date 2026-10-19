namespace Masar.Domain.Constants;

public static class Permissions
{
    public const string BrowseProject = "BROWSE_PROJECT";
    public const string AdministerProject = "ADMINISTER_PROJECT";
    public const string CreateIssues = "CREATE_ISSUES";
    public const string EditIssues = "EDIT_ISSUES";
    public const string TransitionIssues = "TRANSITION_ISSUES";
    public const string AssignIssues = "ASSIGN_ISSUES";
    public const string LinkIssues = "LINK_ISSUES";
    public const string DeleteIssues = "DELETE_ISSUES";
    public const string AddComments = "ADD_COMMENTS";
    public const string DeleteAllComments = "DELETE_ALL_COMMENTS";
    public const string CreateAttachments = "CREATE_ATTACHMENTS";
    public const string DeleteAllAttachments = "DELETE_ALL_ATTACHMENTS";
    public const string ManageSprints = "MANAGE_SPRINTS";
    public const string ManageVersions = "MANAGE_VERSIONS";
    public const string WorkOnIssues = "WORK_ON_ISSUES";
    public const string EditAllWorklogs = "EDIT_ALL_WORKLOGS";

    public static readonly string[] All =
    [
        BrowseProject, AdministerProject, CreateIssues, EditIssues, TransitionIssues,
        AssignIssues, LinkIssues, DeleteIssues, AddComments, DeleteAllComments,
        CreateAttachments, DeleteAllAttachments, ManageSprints, ManageVersions,
        WorkOnIssues, EditAllWorklogs
    ];

    public static readonly Dictionary<string, string[]> DefaultScheme = new()
    {
        [BrowseProject] = ["admin", "member", "viewer"],
        [AdministerProject] = ["admin"],
        [CreateIssues] = ["admin", "member"],
        [EditIssues] = ["admin", "member"],
        [TransitionIssues] = ["admin", "member"],
        [AssignIssues] = ["admin", "member"],
        [LinkIssues] = ["admin", "member"],
        [DeleteIssues] = ["admin"],
        [AddComments] = ["admin", "member", "viewer"],
        [DeleteAllComments] = ["admin"],
        [CreateAttachments] = ["admin", "member"],
        [DeleteAllAttachments] = ["admin"],
        [ManageSprints] = ["admin", "member"],
        [ManageVersions] = ["admin"],
        [WorkOnIssues] = ["admin", "member"],
        [EditAllWorklogs] = ["admin"]
    };
}

public static class GlobalPermissions
{
    public const string CreateProjects = "CREATE_PROJECTS";
    public const string ManageGoals = "MANAGE_GOALS";
    public const string ManageTeams = "MANAGE_TEAMS";
    public const string BrowseUsers = "BROWSE_USERS";

    public static readonly string[] All = [CreateProjects, ManageGoals, ManageTeams, BrowseUsers];
}
