import React, { useContext } from 'react'
import { AppCtx } from './ctx.js'

/* ---------- Work type icons (Jira style) ---------- */
export function TypeIcon({ type, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', role: 'img', 'aria-label': type, style: { flexShrink: 0, display: 'block' } }
  switch (type) {
    case 'Bug':
      return (
        <svg {...common}><rect width="16" height="16" rx="3" fill="#E2483D" /><circle cx="8" cy="8" r="3.2" fill="#fff" /></svg>
      )
    case 'Story':
      return (
        <svg {...common}><rect width="16" height="16" rx="3" fill="#63BA3C" /><path d="M5 4h6a.5.5 0 0 1 .5.5V12l-3.5-2.2L4.5 12V4.5A.5.5 0 0 1 5 4z" fill="#fff" /></svg>
      )
    case 'Epic':
      return (
        <svg {...common}><rect width="16" height="16" rx="3" fill="#904EE2" /><path d="M9.2 3 5 9h2.6L6.8 13 11 7H8.4z" fill="#fff" /></svg>
      )
    case 'Subtask':
      return (
        <svg {...common}><rect width="16" height="16" rx="3" fill="#4BADE8" /><rect x="3.5" y="3.5" width="5" height="5" rx=".8" fill="none" stroke="#fff" strokeWidth="1.4" /><rect x="7.5" y="7.5" width="5" height="5" rx=".8" fill="#fff" /></svg>
      )
    default:
      return (
        <svg {...common}><rect width="16" height="16" rx="3" fill="#4BADE8" /><path d="m4.5 8.2 2.3 2.3 4.7-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )
  }
}

/* ---------- Priority icons ---------- */
export function PriorityIcon({ priority, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', role: 'img', 'aria-label': priority, style: { flexShrink: 0, display: 'block' } }
  const chev = (y, up, color) => (
    <path d={up ? `M3.5 ${y + 4} 8 ${y} l4.5 4` : `M3.5 ${y} 8 ${y + 4} l4.5 -4`} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  )
  switch (priority) {
    case 'Highest': return <svg {...common}>{chev(2.5, true, '#E2483D')}{chev(7.5, true, '#E2483D')}</svg>
    case 'High': return <svg {...common}>{chev(5, true, '#F15B50')}</svg>
    case 'Low': return <svg {...common}>{chev(5.5, false, '#1D7AFC')}</svg>
    case 'Lowest': return <svg {...common}>{chev(3, false, '#1D7AFC')}{chev(8, false, '#1D7AFC')}</svg>
    default:
      return (
        <svg {...common}>
          <path d="M3 5.5h10M3 8h10M3 10.5h10" stroke="#E2B203" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
  }
}

/* ---------- Generic UI icons ---------- */
const P = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  group: <><rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="14" width="16" height="6" rx="1.5" /></>,
  more: <><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2" /><circle cx="12" cy="12" r="7" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></>,
  apps: <>{[5, 12, 19].flatMap((x) => [5, 12, 19].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="currentColor" stroke="none" />))}</>,
  sidebar: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9.5 4.5v15" /></>,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  board: <><rect x="3.5" y="4" width="5" height="16" rx="1" /><rect x="9.5" y="4" width="5" height="11" rx="1" /><rect x="15.5" y="4" width="5" height="7" rx="1" /></>,
  summary: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12l6 6" /></>,
  timeline: <path d="M4 6h9M8 12h12M6 18h8" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  forms: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
  goals: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  drag: <>{[9, 15].flatMap((x) => [6, 12, 18].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" fill="currentColor" stroke="none" />))}</>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  comment: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>,
  lightning: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  monitor: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8.5 20h7M12 16.5V20" /></>,
  robot: <><rect x="4.5" y="8" width="15" height="11" rx="3" /><path d="M12 4.5V8M9 13h.01M15 13h.01M9.5 16h5" /><circle cx="12" cy="3.8" r="1" /></>,
  thumbsUp: <><path d="M7.5 10.5v9h-3v-9z" /><path d="M7.5 10.5 11 3.8a2 2 0 0 1 2.6 1.9V9.5h4.6a2 2 0 0 1 2 2.4l-1.3 6a2 2 0 0 1-2 1.6H7.5" /></>,
  webhook: <><path d="M9 7.5a3.5 3.5 0 1 1 5.2 3L17 15.5" /><path d="M7 18.5a3.5 3.5 0 1 1 1-6.8L11 7" /><path d="M17 20a3.5 3.5 0 1 0-1.5-6.6H9" /></>,
  upload: <><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  timer: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M12 2.5V6" /></>,
  play: <path d="M8 5.5v13l10-6.5z" />,
  palette: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.3-1.8-1.3-3 0-1 .8-1.6 1.8-1.6h2.2a4 4 0 0 0 4-4c0-3.7-3.8-6.7-8.5-6.7z" /><circle cx="7.8" cy="11" r="1" /><circle cx="10" cy="7.3" r="1" /><circle cx="14.5" cy="7.3" r="1" /></>,
  columns: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9.5 4.5v15M14.5 4.5v15" /></>,
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  folder: <path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />,
  dashboard: <><rect x="3.5" y="3.5" width="7" height="9" rx="1" /><rect x="13.5" y="3.5" width="7" height="5" rx="1" /><rect x="13.5" y="11.5" width="7" height="9" rx="1" /><rect x="3.5" y="15.5" width="7" height="5" rx="1" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 13.6a5 5 0 0 1 6 4.9" /></>,
  plans: <path d="M4 18 9 9l4 5 3-4 4 8z" />,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  sort: <path d="M8 4v16M4.5 7.5 8 4l3.5 3.5M16 20V4M12.5 16.5 16 20l3.5-3.5" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15" />,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4v4.5H15" /></>,
  edit: <path d="M14.5 5.5l4 4L8 20H4v-4zM12.5 7.5l4 4" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.8" r=".6" fill="currentColor" /></>,
  warning: <><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.3" r=".6" fill="currentColor" /></>,
  backlog: <><rect x="3.5" y="4" width="17" height="4.5" rx="1" /><path d="M4 13h16M4 17.5h16" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.6A10 10 0 0 1 12 5.5c5.5 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.6M6.4 6.9C4 8.6 2.5 12 2.5 12s4 6.5 9.5 6.5a9 9 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  puzzle: <path d="M10 4.5a2 2 0 1 1 4 0V6h4v4h-1.5a2 2 0 1 0 0 4H18v4h-4v-1.5a2 2 0 1 0-4 0V18H6v-4h1.5a2 2 0 1 0 0-4H6V6h4z" />,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4l3 2" /></>,
  team: <><circle cx="8" cy="9" r="3" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M2.5 19c.5-3 2.8-5 5.5-5s5 2 5.5 5M14 14.3c.8-.4 1.6-.6 2.5-.6 2.3 0 4.2 1.7 4.6 4.3" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  attach: <path d="M20 11.5 12.4 19a5 5 0 0 1-7.1-7.1l7.8-7.8a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1" />,
  branch: <><circle cx="6" cy="5.5" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><circle cx="18" cy="8" r="2.2" /><path d="M6 7.7v8.6M18 10.2c0 4-6 3-11.2 6.3" /></>,
  commit: <><circle cx="12" cy="12" r="3.5" /><path d="M3 12h5.5M15.5 12H21" /></>,
  pr: <><circle cx="6" cy="5.5" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><circle cx="18" cy="18.5" r="2.2" /><path d="M6 7.7v8.6M18 16.3V9a3 3 0 0 0-3-3h-4M13 3.5 10.5 6 13 8.5" /></>,
  release: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z" /><circle cx="8" cy="8" r="1.6" /></>,
  reports: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></>,
  live: <><circle cx="12" cy="12" r="2.5" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" /></>,
  book: <><path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2z" /><path d="M4 19.5a2 2 0 0 0 2 2h13v-4" /></>,
  rovo: <><path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" /></>,
}

export function Icon({ name, size = 16, className, style, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, display: 'block', ...style }} aria-hidden="true"
    >
      {P[name]}
    </svg>
  )
}

// Masar (مسار = "path / route") logo: an "M" drawn as a route with a start point and a destination.
let logoSeq = 0
export function MasarLogo({ size = 24, mono = false }) {
  const [id] = React.useState(() => `msr${++logoSeq}`)
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="Masar" role="img" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0747A6" />
          <stop offset=".55" stopColor="#0C66E4" />
          <stop offset="1" stopColor="#1D9BF0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={mono ? 'currentColor' : `url(#${id})`} />
      <path d="M8.5 22.5V12.2a1.6 1.6 0 0 1 2.8-1.1L16 16.4l4.7-5.3a1.6 1.6 0 0 1 2.8 1.1v6.3" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="22.5" r="2.2" fill="#fff" />
      <circle cx="23.5" cy="22.6" r="3" fill="#FFC400" stroke="#fff" strokeWidth="1.4" />
    </svg>
  )
}
/** Wordmark: logo + "Masar" text. */
export function MasarWordmark({ size = 24, color = '#172B4D', gap = 8, fontSize }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, color, fontWeight: 700, fontSize: fontSize || Math.round(size * 0.9), letterSpacing: '-.01em' }}>
      <MasarLogo size={size} /><span>Masar</span>
    </span>
  )
}
// Older components import JiraLogo; it now renders the Masar logo.
export const JiraLogo = MasarLogo

export function ProjectAvatar({ size = 24, color, project }) {
  const ctx = useContext(AppCtx)
  const fill = color || project?.color || ctx?.meta?.project?.color || '#FFAB00'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }} aria-label={project?.name}>
      <rect width="24" height="24" rx="5" fill={fill} />
      <path d="M6 16.5 10 9l3 5 2-3 3 5.5z" fill="#fff" />
      <circle cx="16" cy="7.5" r="1.8" fill="#fff" />
    </svg>
  )
}
