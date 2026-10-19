'use strict';

const DAY = 864e5;
const nowIso = () => new Date().toISOString();
const daysFromNow = (days) => new Date(Date.now() + days * DAY).toISOString();
const today = () => nowIso().slice(0, 10);
const addDays = (isoDate, days) => new Date(Date.parse(isoDate) + days * DAY).toISOString().slice(0, 10);

module.exports = { DAY, nowIso, daysFromNow, today, addDays };
