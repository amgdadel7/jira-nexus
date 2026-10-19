using Microsoft.EntityFrameworkCore;
using Nexus.Application.Abstractions;
using Nexus.Domain.Entities;

namespace Nexus.Persistence;

public class NexusDbContext(DbContextOptions<NexusDbContext> options) : DbContext(options), IUnitOfWork
{
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Sprint> Sprints => Set<Sprint>();
    public DbSet<Issue> Issues => Set<Issue>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<IssueLabel> IssueLabels => Set<IssueLabel>();
    public DbSet<IssueLink> IssueLinks => Set<IssueLink>();
    public DbSet<Worklog> Worklogs => Set<Worklog>();
    public DbSet<IssueWatcher> IssueWatchers => Set<IssueWatcher>();
    public DbSet<CustomField> CustomFields => Set<CustomField>();
    public DbSet<IntakeForm> IntakeForms => Set<IntakeForm>();
    public DbSet<FormSubmission> FormSubmissions => Set<FormSubmission>();
    public DbSet<GitRepository> GitRepositories => Set<GitRepository>();
    public DbSet<GitPullRequest> GitPullRequests => Set<GitPullRequest>();
    public DbSet<AutomationRule> AutomationRules => Set<AutomationRule>();
    public DbSet<WorkType> WorkTypes => Set<WorkType>();
    public DbSet<WorkTypeScheme> WorkTypeSchemes => Set<WorkTypeScheme>();
    public DbSet<WorkTypeSchemeItem> WorkTypeSchemeItems => Set<WorkTypeSchemeItem>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Organization>(e =>
        {
            e.ToTable("organizations");
            e.HasIndex(x => x.Slug).IsUnique();
        });
        model.Entity<AppUser>(e =>
        {
            e.ToTable("users");
            e.HasIndex(x => new { x.OrganizationId, x.Email }).IsUnique();
        });
        model.Entity<Project>(e =>
        {
            e.ToTable("projects");
            e.HasIndex(x => new { x.OrganizationId, x.Key }).IsUnique();
        });
        model.Entity<Issue>(e =>
        {
            e.ToTable("issues");
            e.HasIndex(x => x.Key).IsUnique();
            e.HasIndex(x => new { x.ProjectId, x.Status, x.Rank });
            e.HasMany(x => x.Labels).WithOne().HasForeignKey(x => x.IssueId);
        });
        model.Entity<IssueLabel>(e =>
        {
            e.ToTable("issue_labels");
            e.HasKey(x => new { x.IssueId, x.Label });
        });
        model.Entity<IssueWatcher>(e =>
        {
            e.ToTable("issue_watchers");
            e.HasKey(x => new { x.IssueId, x.UserId });
        });
        model.Entity<Sprint>().ToTable("sprints");
        model.Entity<Comment>().ToTable("comments");
        model.Entity<RefreshToken>().ToTable("refresh_tokens");
        model.Entity<Notification>().ToTable("notifications");
        model.Entity<AuditLog>().ToTable("audit_logs");
        model.Entity<IssueLink>().ToTable("issue_links");
        model.Entity<Worklog>().ToTable("worklogs");
        model.Entity<CustomField>().ToTable("custom_fields");
        model.Entity<IntakeForm>().ToTable("intake_forms");
        model.Entity<FormSubmission>().ToTable("form_submissions");
        model.Entity<GitRepository>().ToTable("git_repositories");
        model.Entity<GitPullRequest>().ToTable("git_pull_requests");
        model.Entity<AutomationRule>().ToTable("automation_rules");
        model.Entity<WorkType>().ToTable("work_types");
        model.Entity<WorkTypeScheme>().ToTable("work_type_schemes");
        model.Entity<WorkTypeSchemeItem>(e =>
        {
            e.ToTable("work_type_scheme_items");
            e.HasKey(x => new { x.SchemeId, x.WorkTypeId });
        });
    }
}
