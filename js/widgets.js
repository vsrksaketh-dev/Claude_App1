// Home-screen widgets (Android). The app cannot be read by a widget directly, so after every change a small snapshot is
// handed to the native side, which stores it and redraws the widgets. Nothing here runs in a browser.
import { S, ui, app, go, render, commit } from './core.js';
import { today, addDays, daysFromToday, fmtDay } from './util.js';
import { dayItems, pendingActions } from './schedule.js';
import { openTasks, taskQuadrant, habitsOn, habitDone, dayStreak, completeTask, learnCount, focusOn } from './logic.js';
import { widgetPush, widgetTake } from './native.js';

const RANK = { UI: 0, I: 1, U: 2, '': 3 };
const dueLabel = d => { if (!d) return ''; const n = daysFromToday(d); return n < 0 ? 'Overdue' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDay(d); };

export function buildSnapshot() {
  const t = today();
  const events = [];
  [0, 1, 2, 3].forEach(i => { const k = addDays(t, i); dayItems(k).forEach(e => events.push({ d: k, s: e.start, e: e.end, title: e.title, where: e.where || '', allDay: !!e.allDay, src: e.src || '' })); });
  events.sort((a, b) => a.s - b.s);
  const open = openTasks().sort((a, b) => (RANK[taskQuadrant(a)] - RANK[taskQuadrant(b)]) || (a.due || '9').localeCompare(b.due || '9'));
  const hs = habitsOn(t);
  const news = (app.news.items || []).filter(n => n.kind !== 'fact').slice(0, 16).map(n => ({ cat: n.cat, title: n.title, summary: n.summary || '', why: n.why || '', src: n.src || '', url: /^https?:\/\//.test(n.url || '') ? n.url : '' }));
  return {
    v: 2, at: Date.now(), name: S.profile.name || '',
    events: events.slice(0, 60),
    actions: pendingActions(7).filter(e => !e.done).slice(0, 8).map(e => ({ id: e.key, title: e.label, s: e.start })),
    tasks: open.slice(0, 16).map(x => ({ id: x.id, title: x.title, due: dueLabel(x.due), q: taskQuadrant(x), kind: x.kind && x.kind !== 'Task' ? x.kind : '' })),
    taskCount: open.length,
    dueSoon: open.filter(x => x.due && daysFromToday(x.due) <= 2).length,
    habitList: hs.map(h => ({ id: h.id, name: h.name, done: habitDone(h, t) })).slice(0, 8),
    habits: { done: hs.filter(h => habitDone(h, t)).length, total: hs.length, streak: dayStreak() },
    focusMin: focusOn(t), learn: learnCount(t),
    news,
    newsDate: app.news.date || '',
  };
}

export const pushNow = () => widgetPush(JSON.stringify(buildSnapshot()));
let timer;
export const pushSoon = () => { clearTimeout(timer); timer = setTimeout(pushNow, 700); };

// Things done on a widget while the app was closed (ticking a task, a habit or a deadline) are applied here, in order.
export function applyOps(ops) {
  const t = today();
  ops.forEach(o => {
    if (o.t === 'task') { const x = S.tasks.find(y => y.id === o.id); if (x && !x.done) completeTask(o.id); }
    if (o.t === 'act') S.inboxDone[o.id] = !S.inboxDone[o.id];
    if (o.t === 'habit') { const l = (S.habitLog[t] ||= {}); l[o.id] = !l[o.id]; }
  });
}

// "learn:news", "plan:tasks:add", "track:mind:journal", "home:capture": the tab a widget tap asked for.
export function openTarget(target) {
  if (!target) return;
  const [view, a, b] = target.split(':');
  if (!app.views[view]) return;
  if (view === 'learn' && a) ui.sub.learn = a;
  if (view === 'plan') { if (a) ui.sub.plan = a; if (b === 'add') ui.sub.addTask = true; }
  if (view === 'track' && a) { ui.sub.track = a; if (b) ui.sub[a === 'mind' ? 'mind' : 'trk'] = b; }
  go(view);
  if (view === 'home' && a === 'capture') setTimeout(() => document.querySelector('[data-form=todo] input')?.focus(), 80);
}

export async function syncFromWidgets() {
  const { ops, target } = await widgetTake();
  if (ops.length) { applyOps(ops); commit(); }
  if (target) openTarget(target);
  if (ops.length || target) pushSoon();
}
