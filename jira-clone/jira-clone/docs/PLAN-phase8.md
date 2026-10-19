# Phase 8 – PostgreSQL, full Jira configuration tables, Clean Architecture

User request (Arabic): complete everything still missing (backend/frontend/database/API), add all database
tables, make the project clean architecture + clean code.
Decisions (ask_user): tables = **both** (add missing Jira tables + ERD/docs + numbered migrations);
DB = **PostgreSQL**; architecture = **full Clean Architecture in JavaScript** (no TS).

## Non-negotiables
- HTTP API contract stays backward compatible (frontend + docs/e2e-phase4..7.py + proxy-auth must pass).
- Multi-transport auth (Bearer / X-Auth-Token header / ?access_token / Partitioned cookie) must keep working.
- Every feature from phases 1–7 keeps working.

## Database
- Driver adapter: `pg` Pool when `DATABASE_URL` is set; otherwise embedded PostgreSQL (`@electric-sql/pglite`,
  real Postgres compiled to WASM) stored in `server/data/pgdata` – zero-config dev and tests. One SQL dialect.
- `db.query(sql, params)`, `db.one`, `db.many`, `db.tx(fn)`; AsyncLocalStorage makes repositories join the
  surrounding transaction automatically.
- Numbered SQL migrations in `server/src/infrastructure/database/migrations/NNN_name.sql`, tracked in
  `schema_migrations`, every table/column has `COMMENT ON` → docs generated from the catalog
  (`npm run db:docs` → docs/DATABASE.md with Mermaid ERD + data dictionary).
- Types: timestamptz (ISO strings out), date, boolean, jsonb, double precision rank, text[] where natural.
- Normalised (previously TEXT/JSON on issues): issue_type_id, status_id, priority_id, resolution_id (new),
  sprint_id, fix_version_id, team_id, labels → labels + issue_labels, components → issue_components,
  project permission overrides → permission_scheme_entries, board WIP → board_column_limits,
  user prefs → user_preferences.
- NEW Jira configuration tables: issue_types, priorities, resolutions, statuses, workflows, workflow_statuses,
  workflow_transitions (projects.workflow_id), custom_fields, custom_field_options, project_custom_fields,
  custom_field_values, labels, issue_labels, issue_components, dashboards, dashboard_gadgets,
  permission_scheme_entries, board_column_limits, user_preferences, schema_migrations.
- `issue_view` SQL view flattens names for list/JQL queries.

## Server layout (server/src)
```
main.js                 bootstrap (config → db → migrate → container → http)
config/                 env parsing
shared/                 errors (AppError, NotFound, Forbidden, Validation, PlanLimit), utils (time, crypto, csv)
domain/                 pure business rules, no I/O: duration, rank, jql parser (AST), permissions catalogue,
                        plans + proration, automation catalogue + smart values, workflow rules, issue rules
application/            use-case services per module (depend on repositories via constructor injection),
                        event bus (domain events → automation, webhooks, notifications, SSE)
infrastructure/         database (adapter, migrator, migrations, seed), repositories (Pg*), jql→SQL compiler,
                        storage (files), realtime (SSE hub), http clients (webhook sender, OAuth), mailer
interfaces/http/        express app, middleware, controllers, routes, presenters (DTO), openapi
container.js            composition root (wires everything)
```

## Client layout (client/src)
```
app/        App, Root (auth gate), Shell layout, routing (url <-> state), providers
shared/     api (http client + endpoint modules), ui (one component per file), lib (motion, dates, jql),
            hooks, icons, styles (base, components, motion, theme-dark …)
features/   auth, issues, list, board, backlog, timeline, calendar, forms, goals, code, dashboards, foryou,
            filters, people, projects, releases, reports, settings (one file per section), admin (billing,
            webhooks, workflows, statuses, issue types, priorities, resolutions, custom fields), automation,
            teams, preferences
```

## New product features (missing pieces)
- Custom workflows per project (statuses + transitions editor; board columns follow the workflow;
  status picker only offers allowed transitions; Jira-compatible GET/POST /issues/:key/transitions).
- Admin: statuses, issue types, priorities, resolutions, custom fields (text, paragraph, number, date,
  select, multi-select, user, checkbox, url) with options and per-project assignment; values in issue view,
  create dialog, list columns, JQL (`cf[id]` / field name) and CSV import.
- Resolution field (set automatically on Done-category transition unless chosen).
- Labels admin (rename/merge/delete), server-side dashboards with gadgets.

## Progress log
- [x] A infrastructure (config, adapters pg+pglite, sql builder, Database façade w/ ALS tx, migrator, 9 migrations, 59 tables) – verified on PG 17 + PGlite
- [ ] B domain modules
- [ ] C repositories/services/controllers per module
- [ ] D seed
- [ ] E tests on PostgreSQL
- [ ] F new config features (API + UI)
- [ ] G client restructure
- [ ] H docs (DATABASE.md, ERD, README, docker-compose with postgres)
- [ ] I full regression, reseed, restart

### C – detailed status (nothing in C executed yet; smoke test pending)
Written: repositories User, Auth, Settings, Audit, Billing, Project, Config, Issue, Sprint, Version, Component, Team, Trash,
Notification, Comment, Link, Attachment, Development, Worklog, Vote, CustomField · storage/FileStorage ·
services Actor, AccessControl, Billing, Audit, Catalog, Auth, User, Notification, events/EventBus (db.afterCommit),
issues/{IssueFieldResolver, IssueGuard, IssueService, IssueQueryService, TrashService}, customFields/CustomFieldService ·
http: handler, authTransport, middleware auth/errorHandler, presenters users/billing, controllers auth/billing.
Database.tx now runs afterCommit callbacks after commit; 009 view has link_count.
TODO C: GoalRepository(forIssue …), Filter/Form/Workspace(activity, quicksearch, worked-on, meta)/Development services,
Comment/Link/Attachment services, Sprint/Version/Component/Team/Project/ProjectAccess services, phase7 (worklogs, votes,
prefs, avatar, timesheet, automation, webhooks, import), signup/oauth, reports, openapi, presenters/issues, controllers,
container.js, realtime SSE hub, app.js, index.js. Then smoke test (see Current State in memory).

- [x] Interface layer (core): controllers issues/workspace/projects/planning/customFields + auth/billing; container.js; LiveUpdates + broadcaster; interfaces/http/app.js; src/main.js (bootstrap).
- [x] Demo seed ported: src/infrastructure/database/seeds/demoSeed.js (reset+migrate, keeps sessions/tokens/oauth; custom fields on KAN; spike via real IssueService.delete).
- [x] Smoke test on PG (masar_test) via server/_t.js + _checks*.js: 28 GETs, 19 JQL, ~45 writes, permission checks (omar/khalid/sara) all OK.
- [x] Ported + smoke-tested: reports (velocity/cfd/sprint/timesheet), worklogs, votes, prefs, avatar (public /api/avatars), automation (engine on EventBus + service), webhooks (service + sender, retries), CSV import. Seed split in 2 tx (spike before rules).
- [ ] Still to port: signup+oauth (+ /admin/site, /admin/auth-providers), openapi, admin reset, switch server/index.js to src/main.js.

### Progress (session 3)
- [x] Ported: signup + OAuth (IdentityRepository, OAuthGateway, AuthProviderService, SignupService, signup.controller, oauthPage presenter), /admin/site, /admin/auth-providers, POST /reset (MaintenanceService + injected demoSeeder), OpenAPI moved to src/interfaces/http/openapi.js (v8.0.0, 124 paths, all 180 routes documented).
- [x] Route parity with the old server: 0 routes missing.
- [x] src/cli/db.js (migrate | status | seed [--force] | reset); main.js seeds on first boot (SEED_ON_BOOT=false to skip); root package.json db:* scripts.
- [x] Tests ported to test/helpers/testServer.js (TEST_DATABASE_URL or in-memory PGlite). api.test.js 30/30 on PostgreSQL. phase6/phase7 not run yet.
- [x] Fix: "not an epic" = hierarchy_level < 1 (was >= 0, excluded sub-tasks) in ReportRepository + demoSeed.
- [ ] server/index.js still the old SQLite entry → switch to src/main.js; delete legacy files after phase6/7 tests pass.
- [ ] NEW REQUEST: .NET 8 Clean Architecture backend + frontend Clean Architecture (see ask_user answers).
