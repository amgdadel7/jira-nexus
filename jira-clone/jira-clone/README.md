# Masar (مسار)

<img src="docs/masar-logo.svg" width="48" alt="Masar logo">

**Masar** (formerly the "Jira clone") is a full-stack rebuild of the Jira Cloud project experience: the **List** view (`project = KAN ORDER BY cf[10019] ASC`) plus Summary, Timeline, Board, Calendar, Forms, Goals and Code, along with For you, Filters, People, notifications and quick search. It runs on sample data from a fictional "AHD Financial" team, not real Jira data.

- **Frontend:** React 18 + Vite (`client/`)
- **Backend:** Node 20 + Express 5 (`server/`)
- **Database:** SQLite through better-sqlite3. The file lives at `server/data/jira.db` and uploaded files at `server/data/uploads/`.

## Run locally

```bash
npm run install:all     # installs server + client dependencies
npm run build           # builds the client into client/dist
npm start               # http://localhost:3000  (serves API + built client)
```

Development with hot reload: run `npm run dev:server` and `npm run dev:client` in separate terminals. Vite listens on :5173 and proxies `/api` to :3000.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Runs the API test suite (node:test, isolated temporary DB) |
| `npm run seed` | Deletes all data and re-seeds the demo data |

### Demo accounts

Every account uses the password **`password`**.

| Email | Role |
| --- | --- |
| ahmed@ahdfinancial.com | Site admin (every permission everywhere) |
| sara@ahdfinancial.com | KAN project administrator, Payments member |
| omar@ahdfinancial.com | Member; lead (admin) of the private FIN project |
| layla@…, yusuf@… (PAY lead), mona@… | Members (Mona is a Viewer in PAY, Member in FIN) |
| khalid@ahdfinancial.com | External auditor: Viewer in KAN (limited access) and FIN, Member in PAY (open) |

Seeded access levels: **KAN = Limited**, **PAY = Open**, **FIN = Private** (Sara, Layla and Yusuf cannot see FIN).

### Docker

```bash
docker build -t masar .
docker run -p 3000:3000 -v masar-data:/data masar
```

The database and uploads are stored in the `/data` volume.

### Environment variables

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | |
| `DB_PATH` | `server/data/jira.db` | SQLite file |
| `UPLOAD_DIR` | `<DB dir>/uploads` | Attachment storage |
| `SHOW_RESET_LINKS` | off in production | When set to `true`, `POST /auth/forgot` returns the reset link and `POST /auth/signup/start` returns the 6-digit code in the response. This is for demos without email; codes and links are always written to the server log. |
| `PUBLIC_URL` | request host | Public base URL used to build OAuth redirect URIs, e.g. `https://masar.example.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Google sign-in (can also be set in Settings → Security & sign-in) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | – / – / `common` | Microsoft sign-in |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | – | Slack sign-in (OpenID Connect) |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | – | Sign in with Apple (Services ID, team, key id, .p8 contents) |

## Sign up, log in and social login (phase 6)

The screens are modelled on the Atlassian account screens:

- **Log in** (`/login`): email → Continue → password, Remember me, “Can’t log in?”, “Create an account”, demo accounts below the card.
- **Sign up** (`/signup`): email + terms text → **6-digit code** sent by email → full name + password → signed in as a Member. If the email already has an account you are moved to log in.
  There is no mail server, so outside production the code is shown on screen (“Demo mode”) and logged on the server.
- **Or continue with: Google, Microsoft, Apple, Slack.** This is real OAuth 2.0 / OpenID Connect in a popup (full-page redirect if popups are blocked). A provider shows a “not set up” message until an admin enters its client ID and secret in **Settings → Security & sign-in**. That page shows the exact redirect URI to register: `<PUBLIC_URL>/api/auth/oauth/<provider>/callback`.
  Existing accounts are linked by **verified** email. New people get an account only if the sign-up policy allows it and a seat is free.
- **Sign-up policy:** Anyone / Approved domains only / Invite only.

## Plans and billing (phase 6, simulated payments)

| Plan | Price per user | Users | Storage | Permissions & access levels | Audit log | Recycle bin |
| --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | 10 | 2 GB | – | – | 7 days |
| Standard | $7.53 / month, $75.30 / year | 100 | 250 GB | ✓ | – | 30 days |
| Premium | $13.53 / month, $135.30 / year | Unlimited | Unlimited | ✓ | ✓ | 90 days |

- The limits are enforced by the API (HTTP **402** with `code: "plan_limit"` and `upgradeTo`): adding, reactivating or signing up users, uploads, permission schemes, limited/private access, global permissions and the audit log.
  On Free everyone works as a member and projects behave as open. Saved permission settings are kept and come back on upgrade.
- **Settings → Billing & plans** has the overview (usage bars, next payment, card, billing details), plan cards with a monthly/annual toggle, checkout with proration credit, invoices (printable), cancel at period end, resume, and a one-time 14-day trial. Renewals and cancellations are applied lazily when the period ends.
- **Payments are simulated.** Cards are validated (Luhn, expiry, CVC) but only brand + last 4 digits are stored. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds.
- The public pricing page is at `/pricing`. The seeded site is on **Premium (monthly)** with a Visa •••• 4242 card and 3 past invoices.


## Phase 7: time tracking, automation, webhooks, import and Jira motion

- **Time tracking.** Original and remaining estimates, a *Log work* dialog (Jira duration format `2w 4d 6h 45m`, where 1d = 8h and 1w = 5d), and four ways to adjust the remaining estimate: automatically, leave it, set it, or reduce it by an amount. It also adds a *Work log* activity tab, a time-tracking bar in the issue details, a **Timesheet** report (hours per person or work item per day, up to 62 days) and the JQL fields `originalEstimate`, `remainingEstimate` and `timespent`. Permissions: *Work on work items* and *Edit all worklogs*.
- **Votes.** A thumbs-up vote on work items. You can't vote for your own items or for items that are done.
- **Personal settings.** Light, Dark or Match-browser theme (applied before first paint, with an animated cross-fade), a reduce-motion switch, week start, per-type notification switches and a profile-photo upload. Settings are saved per user on the server.
- **Automation.** Project settings → Automation. Rules follow *When* (created, transitioned, assigned, field changed, comment added), *If* (any JQL) and *Then* (assign: balanced, reporter, initiator, lead or a person; transition; priority; label; comment with smart values such as `{{issue.key}}`; watcher; story points). Rules run as the "Automation for Masar" bot and include templates, *Run rule*, run history, an audit log and monthly run limits per plan (Free 100, Standard 1,700, Premium unlimited). Loop protection: the bot's own changes don't trigger rules.
- **Outgoing webhooks.** Site settings → Webhooks. Payloads use the Jira format with HMAC `X-Hub-Signature: sha256=…`, an `X-Masar-Event` header, a JQL filter and event selection. Failed deliveries are retried after 2s and 8s, and there is a delivery log with payload and response, a test ping and redelivery.
- **CSV import.** Project settings → Import work items. You can drop or paste a CSV, columns are mapped by header, and a dry-run preview with row errors runs before anything is created.
- **Motion.** The motion layer uses the official Atlassian Design System tokens (durations 50–600 ms; easings `out.bold`, `inout.bold`, `in.practical` and `out.practical`):
  - Dropdowns and popups grow from their trigger and fade out on exit.
  - Modals scale in and fade out. Exit animations use a detached clone in a closed shadow root, so the DOM is clean immediately.
  - Flags slide in, the stack repositions with FLIP, and flags slide out.
  - Tooltips have a 300 ms delay.
  - The sidebar collapses with an animation, and a hover flyout opens from the left edge or the toggle button.
  - Project tabs have a sliding selection indicator.
  - Skeleton shimmers show while the list, board and issue load.
  - Board cards and list rows flash after a drop or create, and board cards animate to their new position with FLIP.
  - Drop indicators have a terminal dot.
  - The vote count, notification badge and star pop.
  - Chevrons rotate, new comments slide in, and the view fades in.
  - Everything respects `prefers-reduced-motion` and the reduce-motion setting.

Not included: custom workflows (the four statuses are fixed because status order is used in many places across reports and the board).

## Features

- **Projects (multi-project):** a projects directory (search, type filter, sort, star, open-work progress, last activity) and a create-project flow with templates (Scrum software or business), an auto-suggested key and a colour.
  - Every view is scoped to the project in the URL (`/jira/software/projects/<KEY>/<view>`). The sidebar lists starred and recent projects.
  - Business projects hide Backlog, Releases, Reports and sprints.
  - Project settings (name, colour, category, lead, description) can be edited by the lead or an admin; only admins can delete a project (type the key to confirm).
  - The Create dialog can file work into any project. The seed contains **KAN** (AHD Financial), **PAY** (Payments Platform) and **FIN** (Finance Close).
- **Releases:** versions with start and release dates, a status filter (unreleased, released, archived), a progress bar (done, in progress, to do), overdue warnings and a detail panel.
  - Releasing asks what to do with unresolved work: leave it, or move it to another version.
  - Versions can also be unreleased, archived, edited or deleted.
  - The **Fix versions** field appears in the work item panel, Create dialog and list column, and JQL supports `fixVersion = "1.3.0"`.
- **Reports:**
  - **Velocity chart:** committed vs. completed points per closed sprint, plus the average.
  - **Sprint report:** burndown with guideline, completed, not completed and removed work, for any sprint.
  - **Cumulative flow diagram:** 14, 30, 60 or 90 days, with toggleable status bands.
- **Live updates:** Server-Sent Events (`/api/events`). When another user changes a work item, sprint or version, open views refresh automatically. The project header shows who else is online.
- **API tokens:** create personal access tokens (`jcpat_…`) in Profile with an expiry of 30, 90 or 365 days, or none. The token is shown once and can be revoked. Use it with `Authorization: Bearer jcpat_…` for scripts; tokens cannot manage sessions or other tokens.
- **API docs:** an OpenAPI 3 spec at `/api/openapi.json` and a browsable reference at `/api/docs`, linked from Help → Developers.
- **Auth:** email and password login, with passwords hashed using scrypt and rate-limited attempts.
  - The client sends `Authorization: Bearer <token>`, so login also works inside cross-site iframes and embedded previews, where browsers block cookies.
  - The HttpOnly `jc_session` cookie is a fallback. Over HTTPS it is set with `SameSite=None; Secure; Partitioned`.
  - **Remember me** keeps the session for 14 days (token in `localStorage`). Without it, the session lasts 12 hours (token in `sessionStorage`).
  - Includes forgot/reset password, one-click demo accounts, a "session expired" notice, and a Sessions list in the profile (per-device log out, or log out of all other devices).
  - Changing or resetting a password signs out the user's other sessions.
  - **Proxy-proof auth:** the token is sent as `Authorization: Bearer`, as `X-JC-Auth`, and (automatically, if the server reports that no credentials arrived) as `?access_token=`. This works even when a preview proxy strips `Authorization` and the browser blocks cookies. After login the client checks the token on one more request before showing the app. API responses send `Cache-Control: no-store` (no ETags), so proxies can never replay an old 401. 401 responses include `reason` (`no_credentials`, `unknown_session`, `expired`, `deactivated`) and the server logs them. Test: `docs/e2e-proxy-auth.py`.
  - Resetting the demo data (`npm run seed -- --force` or `POST /api/reset`) keeps everyone logged in: live sessions and API tokens are restored for users that still exist. The client also ignores a late 401 from a request sent with an old token, so it cannot log out a fresh login.
- **Backlog:** active and future sprints plus the backlog.
  - Drag items between sections (rank is preserved), use the row "Move to" menu, and create items inline.
  - Create, edit, start or complete sprints. Completing a sprint moves unfinished work to the backlog, another sprint or a new sprint.
- **Board:** an "Active sprint / All work" toggle, and a sprint bar with dates, goal and days left. Includes a Complete sprint action.
- **Dashboards:** gadgets for assigned to me, sprint burndown, created vs. resolved (30 days), work item statistics, saved filter results and the activity stream. Edit mode lets you add, remove and reorder gadgets; the layout is saved per browser.
- **List:** JQL search with rank ordering, sorting, filters, inline editing, bulk actions, drag-to-rank, grouping, column picker, CSV export, pagination (`startAt`/`maxResults`) and saved filters.
- **Work item:** all fields, subtasks, comments with @mentions, history, watchers, issue links (blocks, relates, duplicates, clones), attachments (drag-and-drop, image preview), clone, goals, and a Development panel that creates branches and PRs.
- **Timeline:** Gantt chart of epics and their children. Drag a bar to move it or drag its edges to resize; the start and due dates are saved. Includes a today marker and Weeks/Months/Quarters zoom.
- **Calendar:** month grid by due date. Drag an item to another day to reschedule it, or create an item directly on a day. Unscheduled work sits in a side panel.
- **Forms:** form builder (fields, work type, default assignee, labels). Each submission creates a work item.
- **Goals:** status, owner and target date, with progress calculated from linked work and its children.
- **Code:** branches, commits and PRs per repository. Merging a PR can move its item to Done, and a commit webhook is provided.
- **For you:** work assigned to you, items you've worked on, recently viewed items and starred filters.
- **Notifications:** sent for assignment, mentions, comments and status changes on watched items; checked every 30 seconds.
- **People (admin):** invite users, change roles, and deactivate or reactivate accounts.

### Permissions (phase 5)

- **Project roles:** Administrator, Member and Viewer. Site admins and the project lead are always Administrators.
- **Access levels per project:**
  - *Open*: everyone else is a Member.
  - *Limited*: everyone else is a Viewer.
  - *Private*: only people you add can see it; it returns 404 for everyone else and is hidden from lists, search, SSE and links.
- **Permission scheme per project:** 14 permissions (browse, administer, create, edit, transition, assign, link, delete, comments, attachments, sprints, releases) × 3 roles. It can be edited and reset in *Project settings → Permissions*. Administrators can never lose *Administer project* or *Browse project*.
- **Global permissions** (*People → Global permissions*, site admins only): create projects, manage goals, manage teams, browse users.
- **Project settings page** (`/jira/software/projects/KEY/settings/:section`) has these sections: Details, Access (access level, people and roles), Permissions, Components, Board (WIP limits, swimlanes), Recycle bin and Audit log.
- **Recycle bin:** deleting a work item moves it, with its sub-tasks, comments, attachments, links and history, to the bin for 30 days. You can undo from the toast or restore it later.
- **Audit log:** a per-project log in settings and a site-wide log under *People → Audit log*. It records changes to access, roles, permissions, components, board, teams and users, plus deletes and restores.
- **Components:** each has a lead and a default assignee that auto-assigns new work. Use them in JQL with `component = "Client Portal"`.
- **Teams:** the */jira/teams* page; assign work to a team and query it with `team = "Payments Squad"`.
- **UI follows permissions:** Viewers get a read-only work item (comments still allowed), a locked board, no create or rank controls, and view-only releases and settings.

### JQL support

- **Sprint functions:** `sprint in openSprints()`, `closedSprints()`, `futureSprints()` (also with `not in`).
- **Fields:** project, fixVersion, component, team, key, summary, description, text, status, statusCategory, type, priority, assignee, reporter, labels, created, updated, resolved, duedate, startdate, parent, sprint, "Story Points", rank/`cf[10019]`, comment, watcher and attachments.
- **Operators:** `= != > >= < <= ~ !~ IN, NOT IN, IS EMPTY, IS NOT EMPTY`, combined with AND, OR, NOT and parentheses, plus ORDER BY.
- **Functions:** `currentUser()`, `now()`, `startOfDay()`, `endOfDay()`, `startOfWeek()`, and relative dates such as `-7d`.

## API

All routes are under `/api`. Most list endpoints accept `?project=KEY` (default: KAN). Everything except `/health`, `/openapi.json`, `/docs`, `/auth/login`, `/auth/forgot` and `/auth/reset/*` requires authentication (`Authorization: Bearer <token>` or the session cookie). Errors return `{ "error": "message" }` with a 4xx status. A missing permission returns **403**. A project you can't browse returns **404**, so private projects don't leak.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login` (`{email, password, remember}` → `{user, token, expiresAt}`), `POST /auth/logout`, `GET/PATCH /auth/me`, `POST /auth/forgot`, `GET/POST /auth/reset/:token` |
| Sessions | `GET /auth/sessions`, `DELETE /auth/sessions` (all others), `DELETE /auth/sessions/:id` |
| Sprints | `GET /sprints?state=`, `POST /sprints`, `GET/PATCH/DELETE /sprints/:id`, `POST /sprints/:id/start`, `POST /sprints/:id/complete` (`{moveTo: id \| "new" \| null}`), `POST /sprints/move` (`{keys, sprintId}`) |
| Projects | `GET /projects?q=`, `POST /projects`, `GET/PATCH/DELETE /projects/:key` (delete: admin, `{confirm: KEY}`), `POST/DELETE /projects/:key/star` |
| Versions | `GET /versions?project=&status=`, `POST /versions`, `GET/PATCH/DELETE /versions/:id` (`{moveTo}`), `POST /versions/:id/release` (`{releaseDate, moveUnresolvedTo}`) |
| Reports | `GET /reports/velocity?project=`, `GET /reports/cfd?project=&days=`, `GET /reports/sprint/:id` |
| API tokens | `GET /auth/tokens`, `POST /auth/tokens` (`{name, expiresInDays}` → token shown once), `DELETE /auth/tokens/:id` |
| Live | `GET /events` (SSE: `presence`, `change`) |
| Members & roles | `GET/POST /projects/:key/members` (`{userId, role}`), `PATCH/DELETE /projects/:key/members/:userId` |
| Permissions | `GET/PUT /projects/:key/permissions` (`{scheme: {PERM: [roles]}}`), `POST /projects/:key/permissions/reset`, `GET /mypermissions?project=`, `GET/PUT /permissions/global` |
| Board | `PATCH /projects/:key/board` (`{wip: {Status: n}, swimlanes: none\|assignee\|epic\|priority\|type}`) |
| Components | `GET /components?project=`, `POST /components`, `PATCH /components/:id`, `DELETE /components/:id` (`{moveTo}`) |
| Recycle bin | `GET /trash?project=`, `POST /trash/:id/restore`, `DELETE /trash/:id` (purge) |
| Audit | `GET /audit?project=&action=&actor=&limit=` |
| Teams | `GET/POST /teams`, `GET/PATCH/DELETE /teams/:id` (`members` replaces the list) |
| Time tracking | `GET/POST /issues/:key/worklogs` (`{timeSpent, started, comment, adjustEstimate: auto\|leave\|new\|manual, newEstimate, reduceBy}`), `PATCH/DELETE /worklogs/:id`, `GET /reports/timesheet?project=&from=&to=&user=`; `originalEstimate`/`remainingEstimate` on `POST/PATCH /issues` |
| Votes | `GET/POST/DELETE /issues/:key/votes` |
| Personal settings | `GET/PATCH /auth/me/preferences`, `POST/DELETE /auth/me/avatar` (raw image ≤ 1 MB), `GET /avatars/:file` (public) |
| Automation | `GET/POST /projects/:key/automation`, `GET/PATCH/DELETE /automation/:id`, `GET /automation/:id/runs`, `POST /automation/:id/run` (`{issueKey}`), `GET /projects/:key/automation/audit?status=` |
| Webhooks (admin) | `GET/POST /admin/webhooks`, `PATCH/DELETE /admin/webhooks/:id`, `POST /admin/webhooks/:id/test`, `GET /admin/webhooks/:id/deliveries`, `GET /admin/webhook-deliveries/:id`, `POST /admin/webhook-deliveries/:id/redeliver` |
| Import | `POST /projects/:key/import` (`{csv, dryRun}` or `text/csv` with `?dryRun=1`) |
| Docs | `GET /openapi.json`, `GET /docs` (public) |
| Users | `GET /users`; admin only: `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` (deactivates) |
| Search | `GET /search?jql=&startAt=&maxResults=`, `GET /quicksearch?q=` |
| Work items | `POST /issues`, `GET/PATCH/DELETE /issues/:key`, `POST /issues/:key/clone`, `POST /issues/bulk`, `POST /issues/:key/rank` |
| Comments | `POST /issues/:key/comments`, `PATCH/DELETE /comments/:id` |
| Watchers | `POST/DELETE /issues/:key/watch` |
| Links | `POST /issues/:key/links`, `DELETE /links/:id` |
| Attachments | `POST /issues/:key/attachments` (raw body + `X-Filename` header, 10 MB max), `GET /attachments/:id[?inline=1]`, `DELETE /attachments/:id` |
| Development | `POST /issues/:key/dev`, `GET /dev?kind=&repo=&status=`, `PATCH /dev/:id` (`{status, transition}`), `DELETE /dev/:id`, `POST /webhooks/commits` |
| Filters | `GET/POST /filters`, `PATCH/DELETE /filters/:id` |
| Goals | `GET/POST /goals`, `GET/PATCH/DELETE /goals/:id`, `POST /goals/:id/issues`, `DELETE /goals/:id/issues/:key` |
| Forms | `GET/POST /forms`, `GET/PATCH/DELETE /forms/:id`, `POST /forms/:id/submit` |
| Workspace | `GET /meta?project=`, `PATCH /project`, `GET /activity`, `GET /me/worked-on`, `GET /notifications`, `POST /notifications/read`, `POST /reset` (admin) |

Commit webhook example:

```bash
curl -X POST http://localhost:3000/api/webhooks/commits \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"repo":"kan-web","commits":[{"id":"a1b2c3d","message":"KAN-12 Fix login redirect","authorEmail":"sara@ahdfinancial.com"}]}'
```

## Project layout

```
server/
  app.js            Express app (createApp), SPA fallback
  index.js          entry point
  db.js             schema + migrations
  auth.js           password hashing, sessions, middleware
  seed.js           demo data
  jql.js            JQL → SQL compiler
  lib.js            shared helpers (issue read/update, notifications, rank)
  perms.js          roles, permission schemes, access levels, audit
  trash.js          recycle bin (retention follows the plan)
  billing.js        plans, limits, mock card processing, invoices, proration
  oauth.js          Google / Microsoft / Apple / Slack OAuth + OIDC
  timefmt.js        Jira duration parsing/formatting (1d = 8h, 1w = 5d)
  hooks.js          internal event bus (issue/comment/worklog/sprint events)
  automation.js     rules engine (triggers, JQL conditions, actions, smart values, plan limits)
  webhooks.js       outgoing webhooks (HMAC signing, retries, delivery log)
  routes/           auth.js, signup.js (sign-up, OAuth, admin auth settings), billing.js, access.js,
                    issues.js, workspace.js, sprints.js, projects.js, versions.js, reports.js,
                    phase7.js (worklogs, timesheet, votes, preferences, avatars, automation, webhooks, import)
  events.js         Server-Sent Events hub (presence + change broadcasts)
  openapi.js        OpenAPI 3 spec + /api/docs page
  test/             api.test.js, phase6.test.js (sign-up, fake OAuth provider, billing, limits), phase7.test.js
client/src/
  App.jsx, api.js, icons.jsx (MasarLogo), motion.js (ADS motion tokens, exit ghosts, FLIP, flash, tooltips, theme)
  components/       Shell, LoginPage (log in / sign up / verify / reset), BrandIcons, IssueModal, CreateModal, SettingsModals, ui,
                    TimeTracking (log work, worklogs, votes), Preferences (theme, motion, notifications, photo)
  views/            … BillingPage.jsx (billing, plans, invoices, security settings, public pricing),
                    AutomationPage.jsx (rules + CSV import), WebhooksPage.jsx, ReportsView.jsx (+ Timesheet)
docs/               e2e-phase4/5/6/7.py, e2e-proxy-auth.py, screenshots/, masar-logo.svg
```
