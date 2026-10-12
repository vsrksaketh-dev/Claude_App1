// The day's items from every source: synced calendars, the brief's events and events typed in by hand.
import { S, app } from './core.js';
import { calEventsOn, actionEvents } from './calendar.js';

const clock = ms => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const dayStart = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

// start, end and allDay are milliseconds and a flag, used by the home-screen widgets as well as the Home screen.
export function dayItems(k) {
  const fromCal = calEventsOn(k).map(e => ({ sort: e.allDay ? 0 : e.start, time: e.allDay ? 'All day' : clock(e.start), until: e.allDay ? '' : clock(e.end), title: e.title, where: e.where, src: e.cal, past: !e.allDay && e.end < Date.now(), start: e.start, end: e.end, allDay: e.allDay }));
  const local = [...(app.brief.events || []), ...S.events].filter(e => e.date === k).map(e => {
    const s = e.time ? new Date(k + 'T' + e.time).getTime() : dayStart(k);
    return { sort: e.time ? s : 0, time: e.time || 'All day', title: e.title, where: e.where, id: e.id, interview: e.interview, start: s, end: e.time ? s + 36e5 : s + 864e5, allDay: !e.time };
  });
  return [...fromCal, ...local].sort((a, b) => a.sort - b.sort);
}

// "Needs your attention" calendar items. Unticked ones leave 15 minutes after their time passes. Ticked ones stay for the
// rest of that day, struck through, so a mistaken tick can be undone.
export const actionKey = e => 'cal|' + e.title + '|' + e.start;
const sameDay = (ms, now) => new Date(ms).toDateString() === new Date(now).toDateString();
export function pendingActions(days) {
  const now = Date.now();
  return actionEvents(days).map(e => ({ ...e, key: actionKey(e), done: !!S.inboxDone[actionKey(e)], dueToday: sameDay(e.start, now) }))
    .filter(e => e.done ? (e.dueToday || e.start < now && sameDay(e.end - 1, now)) : (e.allDay ? e.end > now : now < e.start + 15 * 6e4));
}
