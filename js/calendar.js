// Google Calendar (or any ICS feed) sync. The user pastes a calendar's private iCal address once;
// the app re-reads it on open, on return to the app and every few minutes, so edits in Google Calendar show up here.
// The addresses are secret, so they live only on this device (their own storage key, not in S and not in backups).
import { parseICS, eventsOnDay } from './ics.js';
import { today, addDays, uid, parse } from './util.js';
import { httpGetText, isNative } from './native.js';

const SRC_KEY = 'daily-driver-cal-sources';
const CACHE_KEY = 'daily-driver-cal-cache';
const MIN_GAP = 2 * 60e3;          // automatic syncs are skipped if one just ran
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

let sources = load(SRC_KEY, []);     // [{ id, name, url }]
let cache = load(CACHE_KEY, {});     // { id: { at, events[], error } }
let running = null;
const listeners = [];

export const onCalendarChange = f => listeners.push(f);
export const getSources = () => sources.map(s => ({ ...s, ...(cache[s.id] || {}), count: (cache[s.id]?.events || []).length }));
export const hasCalendars = () => sources.length > 0;
export const lastSync = () => Math.max(0, ...sources.map(s => cache[s.id]?.at || 0));

export function normalizeUrl(raw) {
  let u = (raw || '').trim().replace(/^webcal:\/\//i, 'https://');
  if (!/^https:\/\//i.test(u) && !/^http:\/\/localhost[:/]/i.test(u)) throw new Error('Paste the full https:// iCal address.');
  return u;
}
export function addSource(name, url) {
  const s = { id: uid(), name: (name || '').trim() || 'Calendar', url: normalizeUrl(url) };
  sources.push(s); store(SRC_KEY, sources);
  return s;
}
export function removeSource(id) {
  sources = sources.filter(s => s.id !== id); delete cache[id];
  store(SRC_KEY, sources); store(CACHE_KEY, cache);
  listeners.forEach(f => f());
}

const windowMs = () => [parse(addDays(today(), -1)).getTime(), parse(addDays(today(), 63)).getTime()];

async function syncOne(s) {
  const [a, b] = windowMs();
  try {
    const text = await httpGetText(s.url);
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('That link did not return a calendar. Use the "Secret address in iCal format".');
    const r = parseICS(text, a, b);
    cache[s.id] = { at: Date.now(), events: r.events, error: '' };
  } catch (e) {
    const msg = e instanceof TypeError && !isNative() ? 'Browsers block reading calendar links. Open the Android app to sync.' : (e.message || 'Could not reach the calendar.');
    cache[s.id] = { ...(cache[s.id] || { events: [] }), error: msg };
  }
}

// force = true for a manual sync; automatic syncs are throttled.
export function syncAll(force = false) {
  if (!sources.length) return Promise.resolve();
  if (running) return running;
  if (!force && Date.now() - lastSync() < MIN_GAP) return Promise.resolve();
  running = Promise.all(sources.map(syncOne)).then(() => { store(CACHE_KEY, cache); listeners.forEach(f => f()); }).finally(() => { running = null; });
  return running;
}

// ---- reading ----
// Events whose title, description or location contain any hidden word are left out (default: "not mine", for shared or copied entries).
const FILTER_KEY = 'daily-driver-cal-filter';
export const getHidden = () => load(FILTER_KEY, 'not mine');
export const setHidden = text => { store(FILTER_KEY, (text || '').trim()); listeners.forEach(f => f()); };
const hiddenWords = () => getHidden().split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
const visible = e => { const w = hiddenWords(); if (!w.length) return true; const hay = `${e.title} ${e.desc || ''} ${e.where || ''}`.toLowerCase(); return !w.some(x => hay.includes(x)); };
const all = () => sources.flatMap(s => (cache[s.id]?.events || []).filter(visible).map(e => ({ ...e, cal: s.name })));
export const calEventsOn = dateKey => eventsOnDay(all(), dateKey).sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);
// Calendar entries titled "Action: ...", "Due: ..." or "Deadline: ..." are treated as things that need you.
const ACTION = /^(action|due|deadline)\s*[:·-]\s*/i;
export const actionEvents = days => {
  const now = Date.now(), lim = now + days * 864e5;
  return all().filter(e => ACTION.test(e.title) && e.end >= now && e.start < lim).sort((a, b) => a.start - b.start).map(e => ({ ...e, label: e.title.replace(ACTION, '') }));
};
// "Mail: ..." entries are the key facts of an important email that has no date to act on. They stay for a week or until ticked.
const MAIL = /^mail\s*[:·-]\s*/i;
export const isMail = title => MAIL.test(title);
export const mailEvents = days => {
  const now = Date.now();
  return all().filter(e => MAIL.test(e.title) && e.start >= now - days * 864e5 && e.start < now + 864e5).sort((a, b) => b.start - a.start).map(e => ({ ...e, label: e.title.replace(MAIL, '') }));
};
export const upcomingTimed = hours => { const now = Date.now(); return all().filter(e => !e.allDay && e.start > now && e.start < now + hours * 36e5).sort((a, b) => a.start - b.start); };
