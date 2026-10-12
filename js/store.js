import { DEFAULT_ROUTINE } from './data.js';

const KEY = 'daily-driver-v1';

const blank = () => ({
  routineItems: DEFAULT_ROUTINE.map((label, i) => ({ id: 'r' + i, label })),
  routineLog: {},          // { 'YYYY-MM-DD': { itemId: true } }
  inboxDone: {},
  events: [],              // { id, title, date, time, interview, company }
  guess: {},               // { date: { text, revealed } }
  tasks: [],               // { id, title, due, important, done }
  deadlines: [],           // { id, title, date, kind }
  apps: [],                // { id, company, role, stage, notes }
  contacts: [],            // { id, name, kind, org, last, cadence, note }
  stars: [],               // { id, title, trait, s, t, a, r }
  subs: [],                // { id, name, amount, day }
  expenses: [],            // { id, date, amount, cat, note }
  budget: 0,
  focus: {},               // { date: minutes }
  timer: { mode: 'focus', len: 25, remaining: 25 * 60, endsAt: null, running: false },
});

let state;
try { state = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { state = blank(); }

let timeout;
export const save = () => {
  clearTimeout(timeout);
  timeout = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }, 100);
};
export const get = () => state;
export const reset = () => { state = blank(); save(); };
export const exportJSON = () => JSON.stringify(state, null, 2);
export const importJSON = text => { state = { ...blank(), ...JSON.parse(text) }; save(); };

export const uid = () => Math.random().toString(36).slice(2, 9);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const daysFromToday = dateISO => Math.round((new Date(dateISO + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
export const dayOfYear = () => Math.floor((new Date(today() + 'T00:00:00') - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
