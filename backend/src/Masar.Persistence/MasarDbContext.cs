using System.Text;
using Microsoft.EntityFrameworkCore;
using Masar.Application.Abstractions;
using Masar.Domain.Entities;

namespace Masar.Persistence;

public class MasarDbContext : DbContext, IApplicationDbContext
{
    public MasarDbContext(DbContextOptions<MasarDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<ProjectStar> ProjectStars => Set<ProjectStar>();
    public DbSet<PermissionSchemeEntry> PermissionSchemeEntries => Set<PermissionSchemeEntry>();
    public DbSet<Component> Components => Set<Component>();
    public DbSet<Sprint> Sprints => Set<Sprint>();
    public DbSet<Masar.Domain.Entities.Version> Versions => Set<Masar.Domain.Entities.Version>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<IssueType> IssueTypes => Set<IssueType>();
    public DbSet<Status> Statuses => Set<Status>();
    public DbSet<Priority> Priorities => Set<Priority>();
    public DbSet<Resolution> Resolutions => Set<Resolution>();
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<WorkflowStatus> WorkflowStatuses => Set<WorkflowStatus>();
    public DbSet<WorkflowTransition> WorkflowTransitions => Set<WorkflowTransition>();
    public DbSet<Issue> Issues => Set<Issue>();
    public DbSet<Label> Labels => Set<Label>();
    public DbSet<IssueLabel> IssueLabels => Set<IssueLabel>();
    public DbSet<IssueComponent> IssueComponents => Set<IssueComponent>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<History> HistoryEntries => Set<History>();
    public DbSet<Watcher> Watchers => Set<Watcher>();
    public DbSet<Vote> Votes => Set<Vote>();
    public DbSet<IssueLink> IssueLinks => Set<IssueLink>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<IssueViewItem> IssueView => Set<IssueViewItem>();
    public DbSet<AuditLogEntry> AuditLogs => Set<AuditLogEntry>();
    public DbSet<TrashItem> TrashItems => Set<TrashItem>();
    public DbSet<SavedFilter> SavedFilters => Set<SavedFilter>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<GoalIssue> GoalIssues => Set<GoalIssue>();
    public DbSet<WorkForm> WorkForms => Set<WorkForm>();
    public DbSet<CustomFieldDefinition> CustomFields => Set<CustomFieldDefinition>();
    public DbSet<AutomationRule> AutomationRules => Set<AutomationRule>();
    public DbSet<AutomationRun> AutomationRuns => Set<AutomationRun>();
    public DbSet<WebhookSubscription> Webhooks => Set<WebhookSubscription>();
    public DbSet<SiteSetting> SiteSettings => Set<SiteSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AuditLogEntry>(b =>
        {
            b.ToTable("audit_log");
            b.HasKey(a => a.Id);
            b.HasOne(a => a.Actor).WithMany().HasForeignKey(a => a.ActorId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TrashItem>(b =>
        {
            b.ToTable("trash");
            b.HasKey(t => t.Id);
            b.HasOne(t => t.DeletedBy).WithMany().HasForeignKey(t => t.DeletedById).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SavedFilter>(b =>
        {
            b.ToTable("filters");
            b.HasKey(f => f.Id);
            b.HasOne(f => f.Owner).WithMany().HasForeignKey(f => f.OwnerId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Goal>(b =>
        {
            b.ToTable("goals");
            b.HasKey(g => g.Id);
            b.HasOne(g => g.Owner).WithMany().HasForeignKey(g => g.OwnerId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<GoalIssue>(b =>
        {
            b.ToTable("goal_issues");
            b.HasKey(gi => new { gi.GoalId, gi.IssueId });
            b.HasOne(gi => gi.Goal).WithMany(g => g.Issues).HasForeignKey(gi => gi.GoalId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(gi => gi.Issue).WithMany().HasForeignKey(gi => gi.IssueId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkForm>(b =>
        {
            b.ToTable("forms");
            b.HasKey(f => f.Id);
            b.HasOne(f => f.Project).WithMany().HasForeignKey(f => f.ProjectKey).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CustomFieldDefinition>(b =>
        {
            b.ToTable("custom_fields");
            b.HasKey(cf => cf.Id);
        });

        modelBuilder.Entity<AutomationRule>(b =>
        {
            b.ToTable("automation_rules");
            b.HasKey(ar => ar.Id);
            b.HasOne(ar => ar.Project).WithMany().HasForeignKey(ar => ar.ProjectKey).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(ar => ar.CreatedBy).WithMany().HasForeignKey(ar => ar.CreatedById).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AutomationRun>(b =>
        {
            b.ToTable("automation_runs");
            b.HasKey(run => run.Id);
            b.HasOne(run => run.Rule).WithMany(r => r.Runs).HasForeignKey(run => run.RuleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WebhookSubscription>(b =>
        {
            b.ToTable("webhooks");
            b.HasKey(wh => wh.Id);
            b.HasOne(wh => wh.CreatedBy).WithMany().HasForeignKey(wh => wh.CreatedById).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SiteSetting>(b =>
        {
            b.ToTable("site_settings");
            b.HasKey(s => s.Key);
        });

        // Keys and Table Names
        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(u => u.Id);
        });

        modelBuilder.Entity<Session>(b =>
        {
            b.ToTable("sessions");
            b.HasKey(s => s.Token);
            b.HasOne(s => s.User).WithMany(u => u.Sessions).HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Project>(b =>
        {
            b.ToTable("projects");
            b.HasKey(p => p.Key);
            b.HasOne(p => p.Lead).WithMany().HasForeignKey(p => p.LeadId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProjectMember>(b =>
        {
            b.ToTable("project_members");
            b.HasKey(pm => new { pm.ProjectKey, pm.UserId });
            b.HasOne(pm => pm.Project).WithMany(p => p.Members).HasForeignKey(pm => pm.ProjectKey).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(pm => pm.User).WithMany(u => u.ProjectMemberships).HasForeignKey(pm => pm.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectStar>(b =>
        {
            b.ToTable("project_stars");
            b.HasKey(ps => new { ps.UserId, ps.ProjectKey });
            b.HasOne(ps => ps.User).WithMany(u => u.StarredProjects).HasForeignKey(ps => ps.UserId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(ps => ps.Project).WithMany().HasForeignKey(ps => ps.ProjectKey).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PermissionSchemeEntry>(b =>
        {
            b.ToTable("permission_scheme_entries");
            b.HasKey(e => new { e.ProjectKey, e.Permission, e.Role });
        });

        modelBuilder.Entity<Component>(b =>
        {
            b.ToTable("components");
            b.HasKey(c => c.Id);
            b.HasOne(c => c.Project).WithMany(p => p.Components).HasForeignKey(c => c.ProjectKey).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(c => c.Lead).WithMany().HasForeignKey(c => c.LeadId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Sprint>(b =>
        {
            b.ToTable("sprints");
            b.HasKey(s => s.Id);
            b.HasOne(s => s.Project).WithMany(p => p.Sprints).HasForeignKey(s => s.ProjectKey).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Masar.Domain.Entities.Version>(b =>
        {
            b.ToTable("versions");
            b.HasKey(v => v.Id);
            b.HasOne(v => v.Project).WithMany(p => p.Versions).HasForeignKey(v => v.ProjectKey).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Team>(b =>
        {
            b.ToTable("teams");
            b.HasKey(t => t.Id);
        });

        modelBuilder.Entity<TeamMember>(b =>
        {
            b.ToTable("team_members");
            b.HasKey(tm => new { tm.TeamId, tm.UserId });
            b.HasOne(tm => tm.Team).WithMany(t => t.Members).HasForeignKey(tm => tm.TeamId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(tm => tm.User).WithMany().HasForeignKey(tm => tm.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IssueType>(b =>
        {
            b.ToTable("issue_types");
            b.HasKey(it => it.Id);
        });

        modelBuilder.Entity<Status>(b =>
        {
            b.ToTable("statuses");
            b.HasKey(s => s.Id);
        });

        modelBuilder.Entity<Priority>(b =>
        {
            b.ToTable("priorities");
            b.HasKey(p => p.Id);
        });

        modelBuilder.Entity<Resolution>(b =>
        {
            b.ToTable("resolutions");
            b.HasKey(r => r.Id);
        });

        modelBuilder.Entity<Workflow>(b =>
        {
            b.ToTable("workflows");
            b.HasKey(w => w.Id);
        });

        modelBuilder.Entity<WorkflowStatus>(b =>
        {
            b.ToTable("workflow_statuses");
            b.HasKey(ws => new { ws.WorkflowId, ws.StatusId });
            b.HasOne(ws => ws.Workflow).WithMany(w => w.Statuses).HasForeignKey(ws => ws.WorkflowId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(ws => ws.Status).WithMany().HasForeignKey(ws => ws.StatusId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WorkflowTransition>(b =>
        {
            b.ToTable("workflow_transitions");
            b.HasKey(wt => wt.Id);
            b.HasOne(wt => wt.Workflow).WithMany(w => w.Transitions).HasForeignKey(wt => wt.WorkflowId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Issue>(b =>
        {
            b.ToTable("issues");
            b.HasKey(i => i.Id);
            b.HasOne(i => i.Project).WithMany(p => p.Issues).HasForeignKey(i => i.ProjectKey).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(i => i.IssueType).WithMany().HasForeignKey(i => i.IssueTypeId);
            b.HasOne(i => i.Status).WithMany().HasForeignKey(i => i.StatusId);
            b.HasOne(i => i.Priority).WithMany().HasForeignKey(i => i.PriorityId);
            b.HasOne(i => i.Resolution).WithMany().HasForeignKey(i => i.ResolutionId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(i => i.Assignee).WithMany().HasForeignKey(i => i.AssigneeId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(i => i.Reporter).WithMany().HasForeignKey(i => i.ReporterId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(i => i.Parent).WithMany().HasForeignKey(i => i.ParentId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(i => i.Sprint).WithMany().HasForeignKey(i => i.SprintId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(i => i.FixVersion).WithMany().HasForeignKey(i => i.FixVersionId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(i => i.Team).WithMany().HasForeignKey(i => i.TeamId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Label>(b =>
        {
            b.ToTable("labels");
            b.HasKey(l => l.Id);
        });

        modelBuilder.Entity<IssueLabel>(b =>
        {
            b.ToTable("issue_labels");
            b.HasKey(il => new { il.IssueId, il.LabelId });
            b.HasOne(il => il.Issue).WithMany(i => i.IssueLabels).HasForeignKey(il => il.IssueId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(il => il.Label).WithMany().HasForeignKey(il => il.LabelId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IssueComponent>(b =>
        {
            b.ToTable("issue_components");
            b.HasKey(ic => new { ic.IssueId, ic.ComponentId });
            b.HasOne(ic => ic.Issue).WithMany(i => i.IssueComponents).HasForeignKey(ic => ic.IssueId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(ic => ic.Component).WithMany().HasForeignKey(ic => ic.ComponentId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Comment>(b =>
        {
            b.ToTable("comments");
            b.HasKey(c => c.Id);
            b.HasOne(c => c.Issue).WithMany(i => i.Comments).HasForeignKey(c => c.IssueId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<History>(b =>
        {
            b.ToTable("history");
            b.HasKey(h => h.Id);
            b.HasOne(h => h.Issue).WithMany(i => i.HistoryEntries).HasForeignKey(h => h.IssueId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(h => h.Author).WithMany().HasForeignKey(h => h.AuthorId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Watcher>(b =>
        {
            b.ToTable("watchers");
            b.HasKey(w => new { w.IssueId, w.UserId });
            b.HasOne(w => w.Issue).WithMany(i => i.Watchers).HasForeignKey(w => w.IssueId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(w => w.User).WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Vote>(b =>
        {
            b.ToTable("votes");
            b.HasKey(v => new { v.IssueId, v.UserId });
            b.HasOne(v => v.Issue).WithMany(i => i.Votes).HasForeignKey(v => v.IssueId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(v => v.User).WithMany().HasForeignKey(v => v.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IssueLink>(b =>
        {
            b.ToTable("issue_links");
            b.HasKey(il => il.Id);
            b.HasOne(il => il.Source).WithMany().HasForeignKey(il => il.SourceId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(il => il.Target).WithMany().HasForeignKey(il => il.TargetId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Notification>(b =>
        {
            b.ToTable("notifications");
            b.HasKey(n => n.Id);
        });

        modelBuilder.Entity<IssueViewItem>(b =>
        {
            b.ToView("issue_view");
            b.HasNoKey();
        });

        modelBuilder.Entity<WorkForm>(b =>
        {
            b.ToTable("forms");
            b.HasKey(f => f.Id);
            b.Property(f => f.FieldsJson).HasColumnName("fields");
            b.Property(f => f.Enabled).HasColumnName("enabled");
            b.Ignore(f => f.IssueType);
        });

        modelBuilder.Entity<Goal>(b =>
        {
            b.ToTable("goals");
            b.HasKey(g => g.Id);
            b.HasOne(g => g.Owner).WithMany().HasForeignKey(g => g.OwnerId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<GoalIssue>(b =>
        {
            b.ToTable("goal_issues");
            b.HasKey(gi => new { gi.GoalId, gi.IssueId });
            b.HasOne(gi => gi.Goal).WithMany(g => g.Issues).HasForeignKey(gi => gi.GoalId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(gi => gi.Issue).WithMany().HasForeignKey(gi => gi.IssueId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavedFilter>(b =>
        {
            b.ToTable("filters");
            b.HasKey(f => f.Id);
        });

        modelBuilder.Entity<TrashItem>(b =>
        {
            b.ToTable("trash");
            b.HasKey(t => t.Id);
        });

        modelBuilder.Entity<AuditLogEntry>(b =>
        {
            b.ToTable("audit_log");
            b.HasKey(a => a.Id);
        });

        // Global snake_case column names mapping
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.Name));
            }
        }
    }

    private static string ToSnakeCase(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        var sb = new StringBuilder();
        for (int i = 0; i < input.Length; i++)
        {
            char c = input[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && input[i - 1] != '_') sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }
}
