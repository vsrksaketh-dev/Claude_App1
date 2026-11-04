// Builds the list of local notifications from the current state. Pure: scheduling happens in native.js.
import { S } from './core.js';
import { addDays, parse } from './util.js';
import { openTasks } from './logic.js';
import { upcomingTimed } from './calendar.js';

const MAX = 60;   // Android keeps notification alarms cheap; the list is rebuilt every time the app is used

export function buildReminders(now = new Date()) {
  const R = S.reminders;
  if (!R.on) return [];
  const out = [];
  const at = (key, h = 8, m = 0) => { const d = parse(key); d.setHours(h, m, 0, 0); return d; };
  const [mh, mm] = R.morning.split(':').map(Number), [eh, em] = R.evening.split(':').map(Number);
  out.push({ id: 1, title: 'Your day', body: 'Check your tasks and today\'s schedule.', schedule: { on: { hour: mh, minute: mm }, allowWhileIdle: true } });
  out.push({ id: 2, title: 'Tomorrow', body: 'A quick look at what is due and scheduled tomorrow.', schedule: { on: { hour: eh, minute: em }, allowWhileIdle: true } });

  const timed = [];
  if (R.deadlines) {
    openTasks().forEach(t => {
      if (!t.due) return;
      if (t.at) timed.push([new Date(new Date(t.at) - 3 * 36e5), 'Closing in 3 hours', t.title]);
      timed.push([at(addDays(t.due, -1)), 'Due tomorrow', t.title]);
      timed.push([at(t.due), 'Due today', t.title]);
    });
  }
  if (R.events) upcomingTimed(48).forEach(e => timed.push([new Date(e.start - 15 * 6e4), e.title, 'Starts in 15 minutes' + (e.where ? ' · ' + e.where : '')]));
  timed.filter(x => x[0] > now).sort((a, b) => a[0] - b[0]).slice(0, MAX)
    .forEach(([when, title, body], i) => out.push({ id: 100 + i, title, body, schedule: { at: when, allowWhileIdle: true } }));
  return out;
}
