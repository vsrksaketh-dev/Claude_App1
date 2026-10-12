// Home-screen widgets (Android). The app cannot be read by a widget directly, so after every change a small snapshot is
// handed to the native side, which stores it and redraws the widgets. Nothing here runs in a browser.
import { S, app } from './core.js';
import { today, addDays, daysFromToday, fmtDay } from './util.js';
import { dayItems } from './schedule.js';
import { openTasks, taskQuadrant, habitsOn, habitDone, dayStreak } from './logic.js';
import { actionEvents } from './calendar.js';
import { widgetPush } from './native.js';

const RANK = { UI: 0, I: 1, U: 2, '': 3 };
const dueLabel = d => { if (!d) return ''; const n = daysFromToday(d); return n < 0 ? 'Overdue' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDay(d); };

export function buildSnapshot() {
  const t = today();
  const events = [];
  [0, 1, 2, 3].forEach(i => dayItems(addDays(t, i)).forEach(e => events.push({ s: e.start, e: e.end, title: e.title, where: e.where || '', allDay: !!e.allDay, src: e.src || '' })));
  events.sort((a, b) => a.s - b.s);
  const open = openTasks().sort((a, b) => (RANK[taskQuadrant(a)] - RANK[taskQuadrant(b)]) || (a.due || '9').localeCompare(b.due || '9'));
  const hs = habitsOn(t);
  const items = (app.news.items || []).filter(n => n.kind !== 'fact');
  const byCat = {};
  items.forEach(n => (byCat[n.cat] ||= []).push(n));
  const news = [];
  for (let i = 0; news.length < 6 && i < 3; i++) Object.values(byCat).forEach(list => { if (list[i] && news.length < 6) news.push({ cat: list[i].cat, title: list[i].title }); });
  return {
    v: 1, at: Date.now(), name: S.profile.name || '',
    events: events.slice(0, 40),
    actions: actionEvents(7).slice(0, 6).map(e => ({ title: e.label, s: e.start })),
    tasks: open.slice(0, 10).map(x => ({ title: x.title, due: dueLabel(x.due), q: taskQuadrant(x) })),
    taskCount: open.length,
    dueSoon: open.filter(x => x.due && daysFromToday(x.due) <= 2).length,
    top3: (S.mits[t] || []).map(m => ({ text: m.text, done: !!m.done })),
    habits: { done: hs.filter(h => habitDone(h, t)).length, total: hs.length, streak: dayStreak() },
    news,
    newsDate: app.news.date || '',
  };
}

export const pushNow = () => widgetPush(JSON.stringify(buildSnapshot()));
let timer;
export const pushSoon = () => { clearTimeout(timer); timer = setTimeout(pushNow, 700); };
