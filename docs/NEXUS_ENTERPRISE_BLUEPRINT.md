# Nexus — enterprise work OS

**Classification:** product + architecture blueprint  
**Status:** analysis complete · phased implementation  
**Score of current sandbox build vs this vision: 41 / 100**

This document is the source of truth for the expert team. It precedes code.

---

## 0. Honest baseline (what exists today)

Runnable in this workspace:

| Surface | State |
| --- | --- |
| React + Vite + MUI (EN/AR, RTL) | Live. Auth, board, backlog, sprints, reports, team, mailbox |
| Node Clean Architecture API + SQLite | Live stand-in because **.NET, Flutter, Docker, Postgres cannot run here** |
| ASP.NET Core 8 solution (`backend/`) | Source only |
| Flutter (`flutter_app/`) | Source only |
| `database/schema.sql` | Designed for Supabase Postgres, not applied |
| Redis, OpenSearch, SignalR, Grafana, OpenTelemetry | Specified, not running |

The live UI must keep loading **only from an API**. Mock data is forbidden.

---

## 1. Product analysis

### 1.1 Category

Nexus is a **work operating system** for product and engineering organizations: issue tracking, sprint cadence, delivery analytics, and team operations. It is not a document wiki, not a generic kanban toy, and not a marketing site.

### 1.2 Jobs to be done

| Job | Buyer | Frequency |
| --- | --- | --- |
| See whether this sprint will land | PM, Scrum Master | Daily |
| Move a unit of work without ceremony | Developer, QA | Hourly |
| Plan the next increment without a meeting | Scrum Master, Lead | Weekly |
| Prove delivery health to leadership | Org Admin, PM | Weekly |
| Onboard a contractor with least privilege | Org Admin | Monthly |
| Keep Arabic and English teams on one board | All | Always |

### 1.3 Positioning vs named competitors

| | Jira | Linear | ClickUp | Monday | Azure DevOps | **Nexus** |
| --- | --- | --- | --- | --- | --- | --- |
| Power | High | Medium | High | Medium | High | High (Scrum + Kanban + RBAC) |
| Speed of UI | Low | Very high | Medium | Medium | Low | High (Linear-class chrome) |
| Visual planning | Weak | Weak | Strong | Very strong | Weak | Strong (Swiss KPI + charts, not gauges) |
| Enterprise tenancy | Strong | Growing | Medium | Strong | Strong | Strong (org-scoped rows + JWT `org`) |
| Arabic / RTL | Afterthought | Weak | Weak | Weak | Weak | First-class |
| Opinion | Everything | Issue graph | Kitchen sink | Boards as slides | ALM | **Sprint health + move work** |

**Differentiation (one sentence):** Nexus is the board for teams that already know what they are building — Jira’s model, Linear’s speed, Notion’s quiet type, Monday’s glanceable status, Azure’s tenancy.

### 1.4 What we will not be

- No infinite custom fields in v1.
- No documents/wiki competing with Notion.
- No purple “AI SaaS” chrome, no Plus Jakarta + indigo default.
- No emoji as UI. Icons only.

### 1.5 Product quality score (vision): **88 / 100**

Deductions: OpenSearch/Grafana/OTel are table-stakes later, not v1 differentiators. Shipping them empty would lower trust.

---

## 2. User analysis

### 2.1 Personas

**P1 — Lina, Project Manager (primary)**  
Goal: forecast spillover before Friday. Pain: Jira’s six clicks to a burndown. Motivation: look competent in the steering meeting. Journey: Dashboard → one project board → issue drawer.

**P2 — Yusuf, Scrum Master**  
Goal: start/complete sprint, keep WIP honest. Pain: planning poker in three tools. Motivation: a clean board at standup. Journey: Backlog → assign to sprint → Start sprint.

**P3 — Mei, Team Lead**  
Goal: balance load. Pain: heroes over-assigned. Journey: Team → Reports/workload → reassign on board.

**P4 — Omar, Developer**  
Goal: pick next task, change status, comment, leave. Pain: page reloads, unclear assignee. Journey: Board (keyboard or menu, not only drag) → drawer → comment.

**P5 — Fatima, QA**  
Goal: see what is in Review/Testing. Pain: missing repro steps. Journey: Board filter type=bug, status=testing.

**P6 — Aisha, Org Admin (buyer)**  
Goal: invite, revoke, SSO later, audit. Pain: shadow IT Linear cards. Journey: Team invite → Settings RBAC → Mailbox.

### 2.2 Pains (ranked)

1. Cannot see sprint risk in 5 seconds.  
2. Drag-only boards fail keyboard and mobile.  
3. Auth that forbids paste / OTP / Google.  
4. English-only boards for Arabic orgs.  
5. Mock data in demos — leadership does not trust it.

### 2.3 Motivations

Speed, predictability, least-privilege, bilingual, “it looks like we paid for this.”

---

## 3. UX analysis

### 3.1 Heuristics (Nielsen) applied to current UI

| # | Heuristic | Current | Gap |
| --- | --- | --- | --- |
| 1 | Visibility of status | KPI strip + sprint % | No live presence beyond seed |
| 2 | Match real world | Sentence case, issue keys | Roadmaps missing |
| 3 | User control | Undo not present | Need toast undo on move |
| 4 | Consistency | Swiss teal system | Keep; do not restyle to indigo |
| 5 | Error prevention | Auth paste allowed | Signup used to collide with demo email — fixed |
| 6 | Recognition | Command palette | Add Issues + people |
| 7 | Flexibility | Filters on board | Saved views later |
| 8 | Minimalist | Good | Admin/roadmap not stuffed into Settings |
| 9 | Recover from errors | Load error had no retry | Retry + sign out added |
| 10 | Help | Sparse | In-context helper text only, no modal tour |

### 3.2 Journeys (happy path)

1. **Sign in (PM):** email+password **or** OTP **or** Google/Outlook identity → dashboard.  
2. **Standup (SM):** open board → filter assignee → move via menu if no pointer.  
3. **Plan (SM):** backlog → add to sprint → start.  
4. **Ship risk (exec):** dashboard burndown + velocity (from API, not fake series).  
5. **Hire (admin):** Team → invite email → mailbox link → accept.

### 3.3 Information architecture

```
Nexus
├── Dashboard          (health)
├── Projects           (portfolio)
├── Board              (execution)
├── Backlog            (planning)
├── Issues             (query)
├── Sprints            (cadence)
├── Roadmap            (v1.1)
├── Reports            (evidence)
├── Team               (people + invite)
├── Calendar           (dates)
├── Mailbox            (OTP/invite outbox in this sandbox)
├── Notifications      (bell + page)
├── Settings           (self)
└── Administration     (org, SSO, audit) — org_admin
```

### 3.4 UX quality score: **76 / 100** (current live UI)

Strong: board alternatives to drag, 44px targets, RTL, command palette. Weak: no undo, no roadmap, no saved views, mailbox is a sandbox stand-in for SMTP.

---

## 4. UI analysis

### 4.1 Visual direction (locked)

Prior design-system search recommended indigo + Plus Jakarta. **Rejected** (generic 2025 SaaS). Locked instead:

- **Swiss / minimal** surfaces, one action color **teal `#0E8F86`**
- Type: **Fira Sans + Fira Code** (keys, points, timestamps)
- Arabic: **IBM Plex Sans Arabic**
- Charts: line with distinct stroke (solid vs dashed), KPI strip not gauges
- Elevation: 1px borders, almost no shadow
- Motion: 180–220ms, honor `prefers-reduced-motion`

Do **not** copy Linear’s near-black-only or Jira’s dense gray. Nexus is paper + teal.

### 4.2 Page layout rules

- Desktop: 232px sidebar, 56px top bar, optional 300px activity rail.  
- Tablet: collapsible sidebar, hide activity rail.  
- Mobile web: hamburger, 1-column board as stacked swimlanes (not 6-column horizontal hell).  
- One primary button per view. Secondary outlined. Destructive text+icon.

### 4.3 Accessibility (WCAG 2.2 AA)

- Contrast ≥ 4.5:1 on body; teal-on-white checked.  
- Focus-visible 2px offset.  
- Hit area 44px.  
- Drag always has a menu alternative.  
- Auth: `autocomplete`, paste allowed.  
- `skip-link` to `#main`.  
- Language switcher changes `dir` and Emotion cache.

### 4.4 UI quality score: **80 / 100**

---

## 5. Architecture analysis & plan

### 5.1 Target runtime (production)

```
React SPA  ──┐
Flutter     ──┼── HTTPS ── ASP.NET Core 8 (YARP-ready)
              │              ├── JWT access 15m + rotating refresh
              │              ├── SignalR /hubs/board
              │              ├── MediatR CQRS
              │              ├── Redis (cache + SignalR backplane)
              │              ├── OpenSearch (issue search)
              │              └── EF Core → PostgreSQL (Supabase)
              └── Supabase Storage (attachments, signed URLs)

OTel → Grafana   GitHub Actions → GHCR → Docker
```

### 5.2 Sandbox runtime (this machine)

```
React SPA ── /api proxy ── Node Clean Architecture (Express)
                              └── SQLite  api/data/nexus.db
```

Flutter / `dotnet` / Docker / Redis / OpenSearch **cannot execute here**. Their trees stay as source and must not drift conceptually from the Node stand-in.

### 5.3 Clean architecture + DDD + CQRS (ASP.NET)

| Layer | Responsibility | Never does |
| --- | --- | --- |
| Api | HTTP, SignalR, auth middleware, rate limit | SQL |
| Application | Commands/Queries (MediatR), validators, DTOs | EF types |
| Domain | Aggregates: Organization, Project, Sprint, Issue, User | I/O |
| Persistence | EF, migrations, RLS-aware filters | HTTP |
| Infrastructure | JWT, mail, Redis, OpenSearch, storage | Domain rules |

**Aggregates:** `Organization` (tenancy root), `Project` (key, members), `Sprint` (commitment), `Issue` (status machine), `IdentityUser` (auth).

**Issue status machine:** `backlog → todo → in_progress → review → testing → done` (backward allowed; audit on every transition).

### 5.4 Node stand-in mapping

`api/src/domain` → entities/ports  
`api/src/application` → AuthService, WorkspaceService  
`api/src/infrastructure` → sqlite, jwt, mail  
`api/src/presentation` → HTTP  

CQRS on Node is not MediatR; commands are service methods. Acceptable only as a **runnable facade**.

### 5.5 Architecture quality score (target): **90 / 100** · (sandbox): **62 / 100**

---

## 6. Database design

### 6.1 Tenancy

Every business row has `organization_id`. JWT claim `org`. Supabase RLS: `organization_id = (auth.jwt() ->> 'org')::uuid`.

### 6.2 Core entities (already in `database/schema.sql`)

Organizations, workspaces, users, refresh_tokens, roles, permissions, role_permissions, memberships, projects, project_members, sprints, issues, comments, activities, notifications, attachments, invites, otps.

### 6.3 Indexes (required)

- `issues (organization_id, project_id, status, rank)`
- `issues using gin (title gin_trgm_ops)` for search until OpenSearch
- `issues (assignee_id, status)` workload
- `refresh_tokens (user_id, expires_at)` where revoked_at is null
- `notifications (user_id, read, created_at desc)`

### 6.4 Attachments

Private bucket `issue-files/{org}/{issue}/{uuid}`. API issues signed URLs (60s). Never expose service role to the browser.

### 6.5 SQLite stand-in

Mirrors a subset (no RLS, no pgcrypto). Seed: 50 users, 10 projects, 100 issues, canonical admin `zoe.m@example.net`.

### 6.6 Database quality score (schema): **84 / 100** · (applied in sandbox): **55 / 100**

---

## 7. API design

### 7.1 Auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register` | name, email, password ≥ 6 |
| POST | `/api/auth/login` | email+password → access + refresh |
| POST | `/api/auth/refresh` | rotating refresh (production) |
| POST | `/api/auth/otp/request` | login \| signup |
| POST | `/api/auth/otp/verify` | |
| GET | `/api/auth/google` | real OAuth or workspace identity |
| GET | `/api/auth/microsoft` | Outlook |
| POST | `/api/auth/logout` | revoke refresh family |

Access JWT 15 min in production (sandbox currently 12h for DX). Refresh 7d, SHA-256 at rest, rotate, detect reuse.

### 7.2 Workspace

`GET/POST /api/projects` · `PATCH /api/projects/{id}`  
`GET/POST /api/issues` · `PATCH /api/issues/{id}` · `POST /api/issues/{id}/move`  
`GET/POST /api/sprints` · `POST /api/sprints/{id}/start|complete`  
`GET /api/search?q=` · `GET /api/reports/velocity|cycle`  
`POST /api/invites` · `GET /api/mailbox` (sandbox mail)  
SignalR hub `/hubs/board` — `issue.moved`, `comment.added`, `sprint.updated`

### 7.3 Error shape

`{ "error": "human sentence", "code": "issue.not_found", "traceId": "..." }`  
Never stack traces to clients.

---

## 8. Security review

### 8.1 Threat model (STRIDE lite)

| Threat | Mitigation |
| --- | --- |
| Stolen access token | Short TTL + refresh rotation |
| Refresh reuse | Revoke family, force re-login |
| IDOR across orgs | org claim + query filters + RLS |
| Invite token leak | Hash at rest, 7-day expiry, single use |
| OTP brute force | 6-digit, 10 min, consume on read, rate limit |
| XSS | React default escape, no `dangerouslySetInnerHTML` for issue body until markdown sanitizer |
| CSRF | Bearer header, not cookie-only (sandbox). Production: cookie refresh with `SameSite=strict` + CSRF on refresh |
| SSRF via OAuth | Allowlisted token URLs only |
| Secrets in repo | No Supabase service role; JWT secret env |

### 8.2 OWASP Top 10 (v1 posture)

A01 Broken access: RBAC matrix (`Issue.Create` … `User.Manage`).  
A02 Crypto: bcrypt 12 / 10 sandbox; TLS at edge.  
A03 Injection: parameterized SQL / EF.  
A04 Insecure design: status machine in domain.  
A05 Misconfig: no open CORS in production (sandbox `origin: true` is **dev only**).  
A07 Auth: OTP + password + OAuth; paste allowed.  
A09 Logging: audit table for issue/sprint/auth events.  
A10 SSRF: OAuth allowlist.

### 8.3 Permission matrix (excerpt)

| | Viewer | Dev | QA | Lead | SM | PM | Org Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Issue.Read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Issue.Update | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Issue.Delete | | | | ✓ | ✓ | ✓ | ✓ |
| Sprint.Manage | | | | | ✓ | ✓ | ✓ |
| Project.Create | | | | | | ✓ | ✓ |
| User.Manage | | | | | | | ✓ |

### 8.4 Security score (design): **86 / 100** · (sandbox CORS/JWT TTL): **70 / 100**

---

## 9. Performance review

| Layer | Rule |
| --- | --- |
| React | Virtualize board columns > 80 cards; Query for server lists later; Zustand for ephemeral UI |
| API | Pagination `cursor` on issues; never unbounded list in production (sandbox 100 is OK) |
| DB | Composite indexes above; no N+1 comments (batch by issue_id) |
| Cache | Redis: project board snapshot 5s; user session 60s |
| Search | Trgm now; OpenSearch when issue count > 50k |
| Flutter | `ListView.builder`, const widgets, Dio cache interceptor, offline hive of last board |
| Charts | Pre-aggregate velocity in SQL, not in the browser for orgs > 20 sprints |

### 9.1 Performance score (target): **85 / 100** · (sandbox unbounded GET /issues): **68 / 100**

---

## 10. Design system decisions

Tokens (already in `web/src/theme` + `design-system/nexus/MASTER.md`):

| Token | Light | Dark |
| --- | --- | --- |
| ink | `#10232B` | `#E8F3EF` |
| paper | `#F3F7F6` | `#071412` |
| surface | `#FFFFFF` | `#10211E` |
| action | `#0E8F86` | `#2DD4BF` |
| danger | `#C81E1E` | `#F97066` |
| line | `#D3E0DC` | `#1E3530` |

Spacing 4pt grid. Radius 4–8. Type 16 body / 22 page title / 13 mono keys.  
Components: Button contained/outlined/text, 44px; TextField; Dialog; Drawer; KPI card; Issue card with 4px type rail.

**Do not** introduce a second primary color.

Design system score: **82 / 100**

---

## 11. Implementation plan (phased)

### Phase 0 — sandbox truth (done / keep)

Runnable React + Node API, no mock, EN/AR, seed `zoe.m@example.net` / `demo1234`.

### Phase 1 — auth completeness (this increment)

Password login, register, OTP, Google/Outlook identity, invite, refresh-token *shape* on Node.

### Phase 2 — work completeness

Roadmap page, Administration, undo on move, issue search pagination, attachments metadata.

### Phase 3 — production backend

ASP.NET 8 wired to schema.sql, SignalR, Redis, refresh rotation, RLS.

### Phase 4 — Flutter

Riverpod + Dio against the same contracts; offline board.

### Phase 5 — platform

OpenSearch, OTel+Grafana, GH Actions, backup.

**Do not** implement Phase 3–5 as fake Docker that cannot start in this environment.

---

## 12. AI review scores (current product)

| Lens | /100 | Note |
| --- | --- | --- |
| Product | 72 | Core JTBD present; roadmap/admin missing |
| UX | 76 | Fast paths good; undo/saved views missing |
| Design | 80 | Distinctive Swiss teal |
| Architecture | 62 | Two backends; Node is the only runtime |
| Security | 70 | Auth works; refresh rotation not in Node yet |
| Scalability | 48 | SQLite, no Redis/search/bus |
| **Weighted** | **41 vs vision / 74 vs sandbox mission** | |

Improvements before more chrome: refresh tokens, pagination, audit log, roadmap, admin.

---

## 13. Non-goals for the next code drop

- Installing .NET / Flutter / Docker in this sandbox  
- Replacing teal with indigo  
- Re-seeding SQLite if `api/data/nexus.db` exists  
- Fake Grafana dashboards
