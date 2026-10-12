// Persistent state. One JSON blob in localStorage, versioned so it can be migrated as the app grows.
import { DEFAULT_HABITS } from './data.js';
import { today, uid } from './util.js';

const KEY = 'daily-driver-v2';
const OLD_KEY = 'daily-driver-v1';
export const SCHEMA = 2;

export const blank = () => ({
  v: SCHEMA,
  profile: { name: '', roll: '' },
  modules: { career: true, money: true },     // optional areas, switch off in Settings
  meta: { lastBackup: '' },
  habits: DEFAULT_HABITS.map(([name, when]) => ({ id: uid(), name, when, days: [0, 1, 2, 3, 4, 5, 6], created: today() })),
  habitLog: {},                // { date: { habitId: true } }
  mits: {},                    // { date: [{ id, text, done, taskId }] }  top three for the day
  tasks: [],                   // { id, title, due, important, done, doneAt, kind, goalId, triage }
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
  events: [], inboxDone: {},
  apps: [], contacts: [], stars: [],                  // career module
  subs: [], expenses: [], budget: 0,                  // money module
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
  ['profile', 'modules', 'meta', 'stats', 'timer'].forEach(k => { n[k] = { ...base[k], ...(o[k] || {}) }; });
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
