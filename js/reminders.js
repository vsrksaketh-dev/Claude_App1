// Builds the list of local notifications from the current state. Pure: scheduling happens in native.js.
// The list is rebuilt whenever the app is used or put away, so the texts reflect the latest state. Kinds:
//  - a morning briefing and an evening wrap-up for each of the next seven days, with the actual classes and tasks in them
//  - "comeback" nudges two and five days after the last time the app was used (they are replaced on every use, so they only fire if you stay away)
//  - a weekly review on Sunday evening, a backup reminder when one is overdue, deadline and event alerts
// The tone is warm and short. No guilt: a quiet day is fine.
import { S } from './core.js';
import { addDays, today, parse, daysFromToday, rot, clock12 } from './util.js';
import { openTasks, habitDue, habitDone, habitLabel, habitGoal } from './logic.js';
import { agendaOn } from './agenda.js';
import { upcomingTimed } from './calendar.js';

const MAX = 60;   // Android keeps notification alarms cheap; the list is rebuilt every time the app is used

const OPENERS = ['Good morning', 'Fresh day', 'Rise and plan', 'Here is your day', 'New day, new list'];
const QUIET = ['A clear day. Pick one thing worth finishing.', 'Nothing scheduled. A good day to get ahead.', 'Open day. Add the one thing you would be proud to finish.', 'Free to plan: what would make today a win?'];
const WRAP_DONE = ['Nicely done.', 'That counts.', 'Good work today.', 'Steady progress.'];
const WRAP_NONE = ['A quiet day is fine.', 'Tomorrow is a fresh start.', 'Rest is part of the plan.'];

const timedOn = (k, after) => agendaOn(k).filter(e => e.kind === 'event' && !e.allDay && e.end > after).sort((a, b) => a.start - b.start);
const tasksFor = k => openTasks().filter(t => t.due && (k === today() ? t.due <= k : t.due === k));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// "DHRM at 9:00am in CR 14 and 2 more · 3 tasks due"
function dayLine(k, after = 0) {
  const evs = timedOn(k, after), tasks = tasksFor(k), dues = agendaOn(k).filter(e => e.kind === 'due' && !e.done);
  const parts = [];
  if (evs.length) parts.push(`${evs[0].title} at ${clock12(evs[0].start)}${evs[0].where ? ' in ' + evs[0].where : ''}${evs.length > 1 ? ` and ${evs.length - 1} more` : ''}`);
  if (dues.length) parts.push(`${dues[0].title} is due`);
  if (tasks.length) parts.push(`${plural(tasks.length, 'task')} due`);
  return parts.join(' · ');
}

export function buildReminders(now = new Date()) {
  const R = S.reminders;
  if (!R.on) return [];
  const out = [];
  const at = (key, h = 8, m = 0) => { const d = parse(key); d.setHours(h, m, 0, 0); return d; };
  const [mh, mm] = (R.morning || '07:30').split(':').map(Number), [eh, em] = (R.evening || '21:00').split(':').map(Number);
  const name = S.profile.name ? ', ' + S.profile.name : '';
  let id = 200;
  const add = (title, body, when, extra = {}) => { if (when > now) out.push({ id: id++, title, body, schedule: { at: when, allowWhileIdle: true }, ...extra }); };

  for (let i = 0; i < 7; i++) {
    const k = addDays(today(), i);
    if (R.briefing !== false) {
      const line = dayLine(k, i === 0 ? at(k, mh, mm).getTime() : 0);
      add(rot(OPENERS, k) + name, line || rot(QUIET, k), at(k, mh, mm));
    }
    if (R.wrap !== false) {
      const next = addDays(k, 1), tomorrow = dayLine(next);
      let body;
      if (i === 0) {
        const done = S.tasks.filter(t => t.done && t.doneAt === k).length;
        body = (done ? `${plural(done, 'thing')} ticked off today. ${rot(WRAP_DONE, k)}` : `Nothing ticked today. ${rot(WRAP_NONE, k)}`) + (tomorrow ? ` Tomorrow: ${tomorrow}.` : ' Tomorrow is open: add one thing.');
      } else body = tomorrow ? `Tomorrow: ${tomorrow}.` : 'Take a minute: what is the one thing for tomorrow?';
      add('Wrap up the day', body, at(k, eh, em));
    }
  }
  // Habit nudges at the time set on each habit, skipped on days it is already done or its weekly goal is met
  if (R.habits !== false) {
    S.habits.filter(h => !h.archived && h.time && /^\d{2}:\d{2}$/.test(h.time)).forEach(h => {
      const [hh, hm] = h.time.split(':').map(Number);
      for (let i = 0; i < 7; i++) {
        const k = addDays(today(), i);
        if (i === 0 ? !habitDue(h, k) || habitDone(h, k) : !h.days.includes(parse(k).getDay()) && !habitGoal(h)) continue;
        add('Time for ' + h.name, habitGoal(h) ? `${habitLabel(h, today())} this week so far. A small start counts.` : 'A small start counts.', at(k, hh, hm), i === 0 ? { actionTypeId: 'DD_HABIT', extra: { habit: h.id, day: k } } : {});
      }
    });
  }
  if (R.comeback !== false) {
    const soon = openTasks().filter(t => t.due && daysFromToday(t.due) <= 3).length;
    add('Your list is waiting', soon ? `${plural(soon, 'thing')} due in the next few days. Two minutes is enough.` : 'Nothing urgent. A quick look at your week keeps it that way.', at(addDays(today(), 2), 11, 0));
    add('Still here whenever you are', 'Your calendar, tasks and notes are up to date. One tap to catch up.', at(addDays(today(), 5), 19, 0));
  }
  if (R.weekly !== false) {
    const daysToSun = (7 - now.getDay()) % 7 || 7;      // the coming Sunday, never today if it is already evening
    const sun = at(addDays(today(), now.getDay() === 0 && now.getHours() < 19 ? 0 : daysToSun), 19, 0);
    add('Your week in review', 'See what you got done and what is coming. It takes a minute.', sun);
  }
  const lastSafe = S.meta.lastBackup || S.meta.since || today();
  if (R.backup !== false && daysFromToday(lastSafe) <= -21) {
    const sat = (6 - now.getDay() + 7) % 7 || 7;
    add('Back up your data', 'Settings, then Export backup. It takes thirty seconds.', at(addDays(today(), sat), 11, 0));
  }

  const timed = [];
  if (R.deadlines) {
    openTasks().forEach(t => {
      if (!t.due) return;
      if (t.at) timed.push([new Date(new Date(t.at) - 3 * 36e5), 'Closing in 3 hours', t.title]);
      timed.push([at(addDays(t.due, -1)), 'Due tomorrow', t.title]);
      timed.push([at(t.due), 'Due today', t.title, { task: t.id }]);
    });
  }
  // Tasks with a time set: a reminder at that time (and ten minutes before it for the ones marked priority)
  if (R.taskTimes !== false) {
    openTasks().filter(t => t.due && t.time).forEach(t => {
      const [hh, hm] = t.time.split(':').map(Number), when = parse(t.due); when.setHours(hh, hm, 0, 0);
      timed.push([when, t.title, 'Reminder' + (t.link ? ' · open the app for the link' : ''), { task: t.id }]);
      if (t.important) timed.push([new Date(when - 10 * 6e4), t.title, 'In 10 minutes', { task: t.id }]);
    });
  }
  if (R.events) {
    upcomingTimed(48).forEach(e => timed.push([new Date(e.start - 15 * 6e4), e.title, 'Starts in 15 minutes' + (e.where ? ' · ' + e.where : '')]));
    [today(), addDays(today(), 1)].forEach(k => agendaOn(k).filter(e => e.kind === 'event' && !e.cal && !e.allDay).forEach(e => timed.push([new Date(e.start - 15 * 6e4), e.title, 'Starts in 15 minutes' + (e.where ? ' · ' + e.where : '') + (e.links && e.links.length ? ' · tap to join' : '')])));
  }
  timed.filter(x => x[0] > now).sort((a, b) => a[0] - b[0]).slice(0, MAX)
    // Task reminders carry Done and Snooze buttons (handled in main.js through native.js).
    .forEach(([when, title, body, extra], i) => out.push({ id: 1000 + i, title, body, schedule: { at: when, allowWhileIdle: true }, ...(extra ? { actionTypeId: 'DD_TASK', extra } : {}) }));
  return out;
}
