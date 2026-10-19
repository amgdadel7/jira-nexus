'use strict';

const { JqlError } = require('./parser');

/** Relative period such as -7d, 2w, -12h, 30m → ISO timestamp relative to `now`. */
function relativeDate(value, now = new Date()) {
  const m = /^([+-]?)(\d+)([dwhm])$/i.exec(String(value).trim());
  if (!m) return null;
  const n = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const unit = { d: 864e5, w: 7 * 864e5, h: 36e5, m: 6e4 }[m[3].toLowerCase()];
  return new Date(now.getTime() + n * unit).toISOString();
}

/** Evaluates scalar JQL functions (currentUser(), now(), startOfDay() …). */
function evaluateFunction(name, { currentUserId, now = new Date() }) {
  const d = new Date(now.getTime());
  switch (name) {
    case 'currentuser': return currentUserId;
    case 'now': return d.toISOString();
    case 'startofday': d.setUTCHours(0, 0, 0, 0); return d.toISOString();
    case 'endofday': d.setUTCHours(23, 59, 59, 999); return d.toISOString();
    case 'startofweek': d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString();
    case 'endofweek': d.setUTCHours(23, 59, 59, 999); d.setUTCDate(d.getUTCDate() + (6 - d.getUTCDay())); return d.toISOString();
    case 'startofmonth': d.setUTCHours(0, 0, 0, 0); d.setUTCDate(1); return d.toISOString();
    case 'endofmonth': d.setUTCHours(23, 59, 59, 999); d.setUTCMonth(d.getUTCMonth() + 1, 0); return d.toISOString();
    case 'startofyear': d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(0, 1); return d.toISOString();
    default: throw new JqlError(`Unable to find JQL function '${name}()'.`);
  }
}

/** List functions usable with IN: sprint IN openSprints(), fixVersion IN releasedVersions(). */
const LIST_FUNCTIONS = {
  sprint: { opensprints: ['active'], closedsprints: ['closed'], futuresprints: ['future'] },
  fixversion: { releasedversions: ['released'], unreleasedversions: ['unreleased'], archivedversions: ['archived'] },
};

module.exports = { relativeDate, evaluateFunction, LIST_FUNCTIONS };
