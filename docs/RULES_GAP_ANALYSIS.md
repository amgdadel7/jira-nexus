# Gap analysis vs AI_DEVELOPMENT_RULES.md

Reviewed: 2026-10-13 (after envelope + HTTP split)

## Product

Nexus is a bilingual (EN/AR) workspace for engineering teams: board, backlog, sprints, reports, mailbox, team. The login journey must stay: password sign-in (`zoe.m@example.net` / `demo1234`), password create-account (new email, ≥6 chars), OTP as alternate, Google/Outlook (live keys or in-app picker). Value is shipping real work, not a demo shell.

## UX / UI / Design system

Swiss teal, sentence-case, RTL-ready, WCAG focus and paste-friendly auth. Login is still one 383-line screen — hard to review, easy to break tab-clearing of demo credentials. Issue drawer is 266 lines (limit 250). `web/src/utils/` is a forbidden dump name.

## Architecture (66/100)

Presentation / Application / Domain / Infrastructure exists on the Node API. HTTP god-file is gone (routers ≤150). Remaining: god `sqlite.ts` (447, limit 250), `new AuthService()` in routers (DI forbidden), React still `pages/` not `features/{name}/`, entities returned as API `data` (no DTOs). ASP.NET / Flutter / Postgres remain source-only in this sandbox.

## Database (61/100)

SQLite WAL with PK/unique on users.email. `SELECT *` on every list. No FK constraints on issues→projects. Refresh tokens table exists. Postgres schema in `/database` is unused at runtime.

## API (78/100)

REST + `{success,data}` / `{success,errorCode,message}`. Refresh rotation live. Still missing pagination, rate limit, PUT vs PATCH consistency, DTO mapping.

## Security (74/100)

JWT + rotating hashed refresh tokens. Zod on auth bodies. Weaknesses: default `JWT_SECRET`, CORS `origin: true`, no rate limit, demo password in the sign-in fields (intentional for this sandbox).

## Performance (64/100)

`GET /issues` returns the full table. No Redis. No pagination. After this increment: explicit SELECT columns (no `SELECT *`).

## Maintainability (58/100)

Controllers split. Still over limits: sqlite 447, LoginPage 383, IssueDrawer 266, seed 304. `utils/` dump. Almost no tests (Testability 22/100).

## Scores before this increment

| Lens | /100 |
| --- | --- |
| Architecture | 66 |
| Security | 74 |
| Performance | 64 |
| Maintainability | 58 |
| Testability | 22 |

## Scores after this increment

| Lens | /100 |
| --- | --- |
| Architecture | 70 |
| Security | 74 |
| Performance | 68 |
| Maintainability | 70 |
| Testability | 22 |

## Weaknesses (split immediately)

1. `sqlite.ts` god repository (447 > 250) and `SELECT *`.
2. `LoginPage.tsx` (383 > 300).
3. `IssueDrawer.tsx` (266 > 250).
4. `web/src/utils/` forbidden name.
5. `seed.ts` (304 > 300).

## Risks

- Repository split must not recreate `nexus.db`.
- Login extract must keep: demo fields on Sign in, empty fields on Create account, OTP only when chosen.
- Envelope already unwrapped in axios — do not change the contract.

## This increment (then code)

1. Persist the full rules document.
2. Split sqlite into database / mappers / user / workspace / auth repositories; explicit columns.
3. Extract login hero, OAuth, password, OTP into `features/authentication/`.
4. Extract issue comments; rename `utils` → `formatting` + `charting`.
5. Move seed people list out of `seed.ts`.

Not this increment: full React `features/` migration, DI container, DTOs, pagination, rate limit, 90% tests, Postgres runtime.
