# Nexus architecture

## System

```
Flutter mobile ─┐
Flutter web ────┤
React web ──────┼── REST + SignalR ── ASP.NET Core 8 ── PostgreSQL (Supabase)
                │                         │
                └─────────────────────────┴── Redis cache
```

Clean architecture on the API:

- **Nexus.Api** — HTTP, SignalR, auth middleware, rate limits
- **Nexus.Application** — CQRS (MediatR), validators, DTOs
- **Nexus.Domain** — entities, enums
- **Nexus.Persistence** — EF Core + PostgreSQL
- **Nexus.Infrastructure** — JWT, bcrypt, Redis, Serilog sinks
- **Nexus.Shared** — Result / paging

## Tenancy

Every row is scoped by `organization_id`. JWT carries `sub` (user) and `org`.
RLS policies in `database/schema.sql` are a second line of defense when using Supabase.

## Auth

- Access JWT (15 min) + rotating refresh tokens (SHA-256 at rest)
- Password (bcrypt 12), Google / Microsoft subject columns, 2FA fields
- RBAC: roles × permissions (`Project.*`, `Issue.*`, `Sprint.Manage`, …)

## Realtime

`BoardHub` groups by `project:{id}`. Events:

- `issue.moved`
- `comment.added`
- `sprint.updated`

## Frontend

The **React + Vite** app in `/web` is the production-grade dashboard (this environment cannot compile Flutter or .NET). It uses:

- Mock repositories with 10 projects / 50 users / 100 issues / 5+ sprints
- Zustand stores, TanStack Query, MUI 3, dnd-kit, Recharts
- Swap `src/mock` for Axios against `/api` when the API is deployed

## Supabase

Project ref (from the operator): `rrnkzbktwemwrptinxwf`

Apply `database/schema.sql` then `database/seed.sql`. Store attachments in private buckets with signed URLs issued by the API.

Do **not** commit service-role keys. Set `Supabase__ServiceRoleKey` via secrets.
