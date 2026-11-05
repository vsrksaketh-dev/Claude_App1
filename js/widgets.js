// Home-screen widgets (Android). The app cannot be read by a widget directly, so after every change a small snapshot is
// handed to the native side, which stores it and redraws the widgets. Nothing here runs in a browser.
import { S, ui, app, go, render, commit } from './core.js';
import { today, addDays, daysFromToday, fmtDay, uid } from './util.js';
import { pendingActions } from './schedule.js';
import { agendaOn } from './agenda.js';
import { openTasks, taskQuadrant, habitsOn, habitDone, habitLabel, toggleHabit, dayStreak, completeTask, uncompleteTask, doneToday } from './logic.js';
import { widgetPush, widgetTake } from './native.js';
import { nativeSources } from './calendar.js';
import { PRACTICE } from './casebook.js';
import { quickNote, pageTitle, pagePreview, bookName, checkProgress, addPage } from './notes.js';
import { extractLinks } from './links.js';

const RANK = { UI: 0, I: 1, U: 2, '': 3 };
const clock12 = hm => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const dueLabel = d => { if (!d) return ''; const n = daysFromToday(d); return n < 0 ? 'Overdue' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDay(d); };

// Days the calendar widget can page through, and how many entries the snapshot may carry (a widget has a small budget).
const CAL_BACK = 14, CAL_FWD = 75, CAL_MAX = 700;

export function buildSnapshot() {
  const t = today();
  const cal = [];
  for (let i = -CAL_BACK; i <= CAL_FWD && cal.length < CAL_MAX; i++) {
    const k = addDays(t, i);
    agendaOn(k).forEach(e => cal.push({ d: k, s: e.start, e: e.end, t: e.title, w: e.where || '', a: e.allDay ? 1 : 0, k: e.kind, id: e.kind === 'task' ? e.id : (e.key || ''), x: e.done ? 1 : 0, dv: e.derived ? 1 : 0, o: e.cal ? 1 : 0, u: (e.links && e.links[0] ? e.links[0].url : ''), uk: (e.links && e.links[0] ? e.links[0].kind : '') }));
  }
  const open = openTasks().sort((a, b) => (RANK[taskQuadrant(a)] - RANK[taskQuadrant(b)]) || (a.due || '9').localeCompare(b.due || '9'));
  const hs = habitsOn(t);
  const news = (app.news.items || []).filter(n => n.kind !== 'fact').slice(0, 24).map(n => ({ cat: n.cat, title: n.title, summary: n.summary || '', why: n.why || '', src: n.src || '', url: /^https?:\/\//.test(n.url || '') ? n.url : '' }));
  return {
    v: 3, at: Date.now(), name: S.profile.name || '', today: t,
    cal,
    actions: pendingActions(7).filter(e => !e.done).slice(0, 12).map(e => ({ id: e.key, title: e.label, s: e.start, mail: !!e.mail })),
    // Open tasks in priority order (i keeps that order), then the ones ticked today (dn: 1) so a widget can show them struck at the bottom and undo them.
    tasks: [...open.slice(0, 60).map((x, i) => ({ id: x.id, title: x.title, due: dueLabel(x.due), dd: x.due || '', tm: x.time ? clock12(x.time) : '', st: (x.subs || []).length ? `${x.subs.filter(y => y.d).length}/${x.subs.length}` : '', imp: x.important ? 1 : 0, u: (extractLinks(x.link || '')[0] || {}).url || '', uk: (extractLinks(x.link || '')[0] || {}).kind || '', q: taskQuadrant(x), kind: x.kind && x.kind !== 'Task' ? x.kind : '', dv: x.derived ? 1 : 0, i, dn: 0 })),
      ...doneToday().slice(0, 12).map((x, i) => ({ id: x.id, title: x.title, due: '', dd: '', q: taskQuadrant(x), kind: '', dv: 0, i: 100 + i, dn: 1 }))],
    taskCount: open.length,
    dueSoon: open.filter(x => x.due && daysFromToday(x.due) <= 2).length,
    habitList: hs.map(h => ({ id: h.id, name: h.name, done: habitDone(h, t), wk: habitLabel(h, t) })).slice(0, 14),
    habits: { done: hs.filter(h => habitDone(h, t)).length, total: hs.length, streak: dayStreak() },
    news,
    newsDate: app.news.date || '',
    saved: [...S.saved].sort((a, b) => b.at - a.at).slice(0, 12).map(n => ({ cat: n.cat, title: n.title, summary: n.summary || '', why: n.why || '', src: n.src || '', url: /^https?:\/\//.test(n.url || '') ? n.url : '' })),
    // Notes widget: pinned pages first, then the most recently edited
    notes: S.pages.filter(p => !p.trashed).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.upd || b.at) - (a.upd || a.at)).slice(0, 14)
      .map(p => ({ id: p.id, t: pageTitle(p).slice(0, 120), p: pagePreview(p).slice(0, 160), b: bookName(p.bookId), pin: p.pinned ? 1 : 0, at: p.upd || p.at, ck: (checkProgress(p) ? `${checkProgress(p).done}/${checkProgress(p).total}` : '') })),
    notesCount: S.pages.filter(p => !p.trashed).length,
    problems: PRACTICE.map(p => p.q),            // the Problem of the day widget picks one by the date
  };
}

export const pushNow = () => widgetPush(JSON.stringify(buildSnapshot()), nativeSources());
let timer;
export const pushSoon = () => { clearTimeout(timer); timer = setTimeout(pushNow, 700); };

// Things done on a widget while the app was closed (ticking a task, a habit or a deadline) are applied here, in order.
export function applyOps(ops) {
  const t = today();
  ops.forEach(o => {
    if (o.t === 'task') { const x = S.tasks.find(y => y.id === o.id); if (x) { if (o.on === false) uncompleteTask(o.id); else if (!x.done) completeTask(o.id); } }
    if (o.t === 'act') S.inboxDone[o.id] = !S.inboxDone[o.id];
    if (o.t === 'habit') { const h = S.habits.find(y => y.id === o.id); if (h) toggleHabit(h, t); }
    // Text shared into the app from another app: the first line becomes a task, and the whole text is kept as a note when there is more to it.
    if (o.t === 'capture') {
      const lines = String(o.id || '').split('\n').map(x => x.trim()).filter(Boolean), title = (lines[0] || '').slice(0, 140);
      // A shared article (some text plus one link, as browsers and news apps share) goes to Learn > Saved to read later.
      const url = (String(o.id).match(/https?:\/\/\S+/) || [])[0], words = String(o.id).replace(/https?:\/\/\S+/g, '').trim();
      if (url && words.split(/\s+/).filter(Boolean).length <= 30) {
        const host = (url.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] || 'Link';
        if (!S.saved.some(x => x.url === url)) S.saved.push({ cat: 'Saved', title: (words.split('\n')[0] || host).slice(0, 160), summary: '', why: '', src: host, url, at: Date.now() });
        ui.sub.learn = 'news'; ui.sub.newsCat = 'Saved';
        return;
      }
      if (title) { S.tasks.push({ id: uid(), title, due: '', important: false, done: false, kind: 'Task' }); if (lines.length > 1 || (lines[0] || '').length > 140) quickNote(lines.join('\n'), { shared: true }); }
    }
  });
}

// "learn:news", "plan:tasks:add", "home:capture", "calendar:day:2026-10-23": the tab a widget tap asked for.
// Widgets placed before the Track tab was removed may still send "track:..."; those open Home, where habits now live.
export function openTarget(target) {
  if (!target) return;
  let [view, a, b] = target.split(':');
  if (view === 'track') view = 'home';
  if (view === 'plan') view = a === 'notes' ? 'notes' : 'tasks';   // the old Plan tab is now Tasks and Notes
  // Notes widget: open a page, start a new page, or jot
  if (view === 'notes' && ui.nb) {
    if (a === 'page' && S.pages.some(p => p.id === b && !p.trashed)) { ui.nb.page = b; ui.nb.more = false; }
    else if (a === 'new') { const p = addPage({}); ui.nb.page = p.id; ui.nb.focus = { sel: '.pg-title' }; }
    else ui.nb.page = null;
  }
  if (view === 'tasks' && ui.te && a === 'task' && S.tasks.some(t => t.id === b)) { ui.te.id = b; ui.te.filter = 'all'; }
  if (!app.views[view]) return;
  if (view === 'learn' && ['news', 'cases'].includes(a)) ui.sub.learn = a;
  if (view === 'calendar') { if (['month', 'week', 'day', 'agenda'].includes(a)) ui.sub.calMode = a; ui.sub.calAdd = a === 'add'; if (/^\d{4}-\d{2}-\d{2}$/.test(b || a || '')) { ui.sub.calSel = ui.sub.calAnchor = b || a; if (!ui.sub.calMode) ui.sub.calMode = 'month'; } }
  go(view);
  if ((view === 'home' && a === 'capture') || ((view === 'tasks' || view === 'notes') && (b === 'add' || a === 'add'))) setTimeout(() => document.querySelector('[data-form=quick] input, [data-form=task] input, [data-form=jot] input')?.focus(), 80);
}

export async function syncFromWidgets() {
  const { ops, target } = await widgetTake();
  if (ops.length) { applyOps(ops); commit(); }
  if (target) openTarget(target);
  if (ops.length || target) pushSoon();
}
