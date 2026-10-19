# Nexus design system (applied)

UI/UX Pro Max search recommended indigo + Plus Jakarta Sans. That pairing is the 2025 SaaS default, so it was **rejected** under Frontend Design (do not spend free axes on generic looks).

The search *did* lock these, and they are kept:

- Style: **Minimalism & Swiss Style** (enterprise dashboards)
- Product: **Productivity Tool** — functional color, drill-down analytics
- Type pairing: **Fira Sans + Fira Code** (“Dashboard Data”)
- Color family: **B2B Service** navy/slate with a single CTA
- Dials: variance 4, motion 3, density 8
- Charts: line (trend) with distinct stroke styles; compact KPI strip instead of gauges
- A11y: 4.5:1, visible 2px focus, 44px targets, drag alternatives, reduced-motion, autocomplete on auth

## Subject

Engineering work management. Audience: PMs and developers at a desk. Job: see sprint health and move work.

## Color

| Token | Light | Dark |
| --- | --- | --- |
| ink | `#14221F` | `#E6EEEA` |
| paper | `#F2F4F3` | `#0E1614` |
| surface | `#FFFFFF` | `#15201C` |
| teal (action) | `#0F766E` | `#2DD4BF` |
| on-teal | `#FFFFFF` | `#042F2E` |
| muted | `#5C6B66` | `#9BB0A8` |
| line | `#D5DDD9` | `#2A3A35` |
| danger | `#B42318` | `#F97066` |
| warn | `#B45309` | `#FDBA74` |

Teal is the only action color. No gradients. No glass.

## Type

- UI: Fira Sans 400/500/600/700, body 16px, line-height 1.5
- Keys, points, timestamps: Fira Code 500
- Sentence case. No tracked-out all-caps eyebrows.

## Layout

Dense 8px grid. Radius 6px. Borders carry hierarchy; shadows only on overlays. Dashboard hero is the burndown, not six identical KPI cards.

## Motion

150–200ms color/opacity on user actions. No entrance stagger. `prefers-reduced-motion: reduce` disables transitions.

## Signature

Issue keys in Fira Code. Everything else stays quiet.
