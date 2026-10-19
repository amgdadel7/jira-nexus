# Nexus — enterprise project management

Jira-like work management for organizations that run Scrum and Kanban.

| Path | What it is | Runnable here |
| --- | --- | --- |
| `web/` | React 19 + TypeScript + MUI dashboard (EN/AR, RTL) | **Yes — live preview** |
| `api/` | Node Clean Architecture API (Express, SQLite, JWT, OTP, OAuth) | **Yes — `:8080`** |
| `backend/` | ASP.NET Core 8 API (Clean Architecture, CQRS, JWT, SignalR) | Needs .NET 8 |
| `flutter_app/` | Flutter client (Riverpod, GoRouter, Dio) | Needs Flutter SDK |
| `database/` | PostgreSQL / Supabase schema + seed | Apply in Postgres |
| `docker-compose.yml` | API + Postgres + Redis + web | Needs Docker |

The live UI talks **only** to the Node API. There is no frontend mock data.

## Sign in

1. Open the Nexus web preview
2. Email `zoe.m@example.net` / password `demo1234`
3. Or request an email OTP (demo shows the code because mail is in-memory)
4. Google and Outlook need `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`

Invite people from **Team**. OTP and invites appear in **Mailbox**.

## Run locally

```bash
cd api && npm install && npm run dev   # http://127.0.0.1:8080
cd web && npm install && npx vite      # http://localhost:5173  (proxies /api)
```

SQLite file: `api/data/nexus.db`. Seed runs only when the database is empty. `ensureDemoFixes` keeps the canonical admin email.

## Product surface

- Analytics dashboard (KPI strip, burndown, velocity from live sprints)
- Projects (create / open / archive)
- Kanban board (6 columns, filters, drag or keyboard/menu move)
- Backlog + sprint planning
- Issues list
- Sprint start / complete / create
- Issue drawer (edit, comments, delete)
- Reports (burndown, velocity, cycle time, workload)
- Team directory + email invite
- Calendar (due dates + sprint bounds)
- Mailbox, settings, i18n (EN/AR), light/dark

## API

- `POST /api/auth/login` `POST /api/auth/otp/request` `POST /api/auth/otp/verify`
- `GET  /api/auth/google` `GET /api/auth/microsoft`
- `GET  /api/me` `/users` `/projects` `/issues` `/sprints` `/comments`
- `POST /api/projects` `PATCH /api/projects/:id`
- `POST /api/issues` `PATCH /api/issues/:id`
- `POST /api/invites` `GET /api/mailbox`
- `GET  /api/reports/velocity` `GET /api/reports/cycle` `GET /api/search`

## Database / Flutter / ASP.NET

Those trees stay in the repo as source. This sandbox cannot run .NET, Flutter, or Docker.
