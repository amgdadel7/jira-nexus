# Nexus — Enterprise Project Management

Jira-like enterprise work management platform supporting Scrum, Kanban, and custom workflows.

## System Architecture

| Component | Path | Technology & Pattern | Status |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | `web/` | React 18, Vite, TanStack Query, Tailwind/Vanilla CSS | **Primary Client** |
| **Unified Backend** | `api/` (`src/main.js`) | Node.js, Express, Clean Architecture, PostgreSQL / PGlite | **Approved Runtime** |
| **Legacy Monolith** | `api/` (`index.js` / `app.js`) | Express, SQLite (`better-sqlite3`) | **Legacy** (`npm run start:legacy`) |
| **.NET Backend** | `backend/` | ASP.NET Core 8, MediatR, EF Core | Secondary / Reference |
| **Mobile App** | `flutter_app/` | Flutter, Riverpod, Dio | Mobile Client |

---

## Quick Start (Local Development)

### 1. Unified Backend (Node.js + PostgreSQL)
```bash
cd api
npm install
npm run dev        # Starts unified Clean Architecture API on http://127.0.0.1:3000
```
- By default, uses embedded in-memory PostgreSQL (`PGlite`), requiring zero database installation.
- To connect to an external PostgreSQL server, set `DATABASE_URL=postgres://user:password@localhost:5432/masar`.

### 2. Web Frontend (Vite)
```bash
cd web
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173 (proxies /api to 3000)
```

### 3. Verification & Testing
```bash
# Run all unit, security, and smoke tests
cd api && npm test

# Run smoke test verifying proxy and CRUD
cd api && npm run test:smoke

# Verify API health
cd api && npm run health

# Scan for exposed credentials (values masked)
cd api && npm run check:secrets
```

---

## Demo Accounts (Seeded)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Site Administrator** | `ahmed@ahdfinancial.com` | `password` |
| **Project Lead** | `layla@ahdfinancial.com` | `password` |
| **Team Member** | `omar@ahdfinancial.com` | `password` |

---

## Docker Deployment
```bash
docker compose up -d
```
Runs:
- `backend-node` on port `3000` (PostgreSQL)
- `postgres` on port `5432`
- `web` on port `5173`
