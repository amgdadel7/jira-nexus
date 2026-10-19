// Jira-style durations: "1w 2d 3h 30m". Working time: 1d = 8h, 1w = 5d (Jira defaults).
const HOURS_PER_DAY = 8;
const DAYS_PER_WEEK = 5;
const UNIT = { w: DAYS_PER_WEEK * HOURS_PER_DAY * 3600, d: HOURS_PER_DAY * 3600, h: 3600, m: 60 };

/** Parses "2h 30m", "1.5h", "90m", "1d" or a number of seconds. Returns seconds or null (empty). Throws on garbage. */
function parseDuration(input) {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') { if (!Number.isFinite(input) || input < 0) throw new Error('Invalid duration.'); return Math.round(input); }
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s) * 60; // a bare number means minutes, like Jira
  let total = 0; let rest = s;
  const re = /^\s*(\d+(?:\.\d+)?)\s*([wdhm])/;
  let m;
  while ((m = re.exec(rest))) { total += Number(m[1]) * UNIT[m[2]]; rest = rest.slice(m[0].length); }
  if (rest.trim()) throw new Error(`“${input}” isn’t a valid duration. Use a format like 2w 4d 6h 45m.`);
  return Math.round(total);
}

/** 37800 -> "1d 2h 30m" (zero -> "0m"). */
function formatDuration(sec) {
  if (sec === null || sec === undefined) return null;
  let s = Math.max(0, Math.round(sec));
  if (s === 0) return '0m';
  const out = [];
  for (const u of ['w', 'd', 'h', 'm']) { const n = Math.floor(s / UNIT[u]); if (n) { out.push(`${n}${u}`); s -= n * UNIT[u]; } }
  return out.join(' ') || '0m';
}

module.exports = { parseDuration, formatDuration, HOURS_PER_DAY, DAYS_PER_WEEK };
