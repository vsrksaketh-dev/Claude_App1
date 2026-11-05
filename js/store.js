// Persistent state. One JSON blob in localStorage, versioned so it can be migrated as the app grows.
import { DEFAULT_HABITS } from './data.js';
import { today, uid } from './util.js';

const KEY = 'daily-driver-v2';
const OLD_KEY = 'daily-driver-v1';
export const SCHEMA = 2;

export const blank = () => ({
  v: SCHEMA,
  profile: { name: '', roll: '', company: '', joining: '' },   // company and joining date feed the countdown on Home
  theme: 'system',                            // 'light', 'dark' or 'system'
  glass: true,                                // frosted-glass look; false gives solid panes
  modules: { career: true, money: true },     // legacy: those screens were removed, the data below is kept untouched
  meta: { lastBackup: '', since: today(), autoAt: '' },   // since: first run, so the backup nudge waits a couple of weeks
  reminders: { on: false, morning: '07:30', evening: '21:00', briefing: true, wrap: true, comeback: true, weekly: true, backup: true, deadlines: true, cards: false, events: true },   // Android app only
  habits: DEFAULT_HABITS.map(([name, when]) => ({ id: uid(), name, when, days: [0, 1, 2, 3, 4, 5, 6], created: today() })),
  saved: [],                   // news stories kept by the user: { cat, title, summary, why, src, url, at }
  books: [],                   // { id, name, at }  notebooks (pages with no book sit in the built-in Inbox)
  pages: [],                   // { id, title, bookId, blocks[], pinned, at, upd, tp, src, shared, trashed?, files?: [{ id, name, type, size }] }  blocks: { id, t: p|h|b|n|c|q, x, d, l }  (trashed: time it went to Trash; purged after 30 days)  (Notes)
  notes: [],                   // legacy flat notes: converted to pages on load, kept empty afterwards
  habitLog: {},                // { date: { habitId: true } }  done or not, per day
  habitInfo: {},               // { date: { habitId: { n, tag } } }  count so far and what was done (Push, Run...)
  // habits: { id, name, when, days, created, goal?: times a week, target?: count a day, time?: 'HH:MM' nudge, options?: ['Push','Pull'] }
  mits: {},                    // { date: [{ id, text, done, taskId }] }  top three for the day
  tasks: [],                   // { id, title, due, time?: 'HH:MM' (a reminder fires then), repeat?: daily|weekdays|weekly|monthly, link?, note?, subs?: [{ id, x, d }], important, done, doneAt, kind, goalId }  (triage is legacy: such tasks now count as ordinary open tasks)
  // Legacy areas below have no screen any more (Track, Goals, Career, Money). Their data stays in the file and in backups, never dropped.
  goals: [],                   // { id, title, why, area, horizon, due, status, milestones[], habitIds[] }
  journal: {},                 // { date: { mood, energy, wins, lessons, grateful, tomorrow } }
  reviews: {},                 // { weekStart: { well, improve, focus } }
  learnLog: [],                // { id, date, text, topic }
  library: [],                 // { id, title, kind, status, rating, notes[] }
  cards: [],                   // { id, front, back, deck, due, interval, ease, reps, seen }
  learnDone: {},               // { date: { guess, framework, jargon, model, news } }
  guess: {},                   // { date: { text, revealed } }
  stats: { tasksDone: {}, cardsReviewed: {} },
  focus: {},                   // { date: minutes }
  focusTags: {},               // { date: { tag: minutes } }
  timer: { mode: 'focus', len: 25, remaining: 25 * 60, endsAt: null, running: false, tag: '' },
  events: [], inboxDone: {},   // events: { id, title, date, time, mins, repeat?, until?, skip?: [dates], where, link } typed into the app
  apps: [], contacts: [], stars: [],                  // career module
  subs: [], expenses: [], budget: 0,                  // money module
  workouts: [],                // { id, date, type, min, note }
  meals: [], calGoal: 2200,    // meals: { id, date, meal, name, kcal }
});

function migrate(o) {
  const base = blank();
  if (!o.v) {                 // v1 -> v2
    o.habits = (o.routineItems || []).map(r => ({ id: r.id, name: r.label, when: 'morning', days: [0, 1, 2, 3, 4, 5, 6], created: today() }));
    o.habitLog = o.routineLog || {};
    o.tasks = [...(o.tasks || []), ...(o.deadlines || []).map(d => ({ id: d.id, title: d.title, due: d.date, important: true, done: false, kind: d.kind }))];
    ['routineItems', 'routineLog', 'deadlines', 'guess'].forEach(k => k === 'guess' ? 0 : delete o[k]);
  }
  const n = { ...base, ...o, v: SCHEMA };
  // The old flat notes become pages (talking points go in their own book); nothing is dropped.
  if (Array.isArray(o.notes) && o.notes.length) {
    n.books = [...(o.books || [])]; n.pages = [...(o.pages || [])];
    let tp = n.books.find(b => b.name === 'Talking points');
    o.notes.forEach(x => {
      if (x.tp && !tp) { tp = { id: uid(), name: 'Talking points', at: Date.now() }; n.books.push(tp); }
      const lines = String(x.text || '').split('\n');
      const hasTitle = lines[0].trim() && lines[0].length <= 80;
      const first = hasTitle ? lines[0].replace(/^Talking point:\s*/, '') : '', body = hasTitle ? lines.slice(1) : lines;
      n.pages.push({ id: x.id || uid(), title: first, bookId: x.tp ? tp.id : '', pinned: !!x.pinned, at: x.at || Date.now(), upd: x.at || Date.now(), tp: !!x.tp, src: x.src || '', shared: !!x.shared,
        blocks: (body.length ? body : ['']).map(t => ({ id: uid(), t: 'p', x: t })) });
    });
    n.notes = [];
  }
  ['profile', 'modules', 'meta', 'stats', 'timer', 'reminders'].forEach(k => { n[k] = { ...base[k], ...(o[k] || {}) }; });
  return n;
}

let state;
try {
  const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
  state = raw ? migrate(JSON.parse(raw)) : blank();
} catch { state = blank(); }

let timeout;
export const save = () => {
  clearTimeout(timeout);
  timeout = setTimeout(flush, 100);
};
export const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } };
window.addEventListener('pagehide', flush);
export const get = () => state;
export const reset = () => { state = blank(); flush(); };
export const exportJSON = () => JSON.stringify(state, null, 2);
export const importJSON = text => { state = migrate(JSON.parse(text)); flush(); };
