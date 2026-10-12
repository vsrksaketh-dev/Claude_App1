// Builds the list of local notifications from the current state. Pure: scheduling happens in native.js.
import { S } from './core.js';
import { addDays, today, parse } from './util.js';
import { openTasks, dueCards } from './logic.js';

const MAX = 40;   // Android keeps notification alarms cheap; the list is rebuilt every time the app is used

export function buildReminders(now = new Date()) {
  const R = S.reminders;
  if (!R.on) return [];
  const out = [];
  const at = (key, h = 8, m = 0) => { const d = parse(key); d.setHours(h, m, 0, 0); return d; };
  const [mh, mm] = R.morning.split(':').map(Number), [eh, em] = R.evening.split(':').map(Number);
  out.push({ id: 1, title: 'Plan your day', body: 'Pick your top 3 and run through your habits.', schedule: { on: { hour: mh, minute: mm }, allowWhileIdle: true } });
  out.push({ id: 2, title: 'Close the day', body: 'Two minutes: reflect and set tomorrow\'s top 3.', schedule: { on: { hour: eh, minute: em }, allowWhileIdle: true } });

  const timed = [];
  if (R.deadlines) {
    openTasks().forEach(t => {
      if (!t.due) return;
      if (t.at) timed.push([new Date(new Date(t.at) - 3 * 36e5), 'Closing in 3 hours', t.title]);
      timed.push([at(addDays(t.due, -1)), 'Due tomorrow', t.title]);
      timed.push([at(t.due), 'Due today', t.title]);
    });
  }
  if (R.cards && dueCards().length) {
    const d = at(today(), 18);
    timed.push([d > now ? d : at(addDays(today(), 1), 18), 'Flashcards due', `${dueCards().length} waiting for review.`]);
  }
  timed.filter(x => x[0] > now).sort((a, b) => a[0] - b[0]).slice(0, MAX)
    .forEach(([when, title, body], i) => out.push({ id: 100 + i, title, body, schedule: { at: when, allowWhileIdle: true } }));
  return out;
}
