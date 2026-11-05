// Everything that happens on a day, in one list: synced calendar events, events typed in by hand, deadlines, things to do,
// the key facts of important emails, and tasks that fall due. The Calendar tab and the home-screen widgets both read this.
import { S, app } from './core.js';
import { calEventsOn, kindOf, stripKind } from './calendar.js';
import { actionKey } from './schedule.js';
import { openTasks } from './logic.js';
import { addDays, parse, today, daysFromToday, occursOn } from './util.js';
import { extractLinks, stripLinks } from './links.js';

const startOf = k => parse(k).getTime();
export const KIND_LABEL = { event: 'Event', due: 'Due', action: 'To do', mail: 'Email', task: 'Task' };

// kind: event | due | action | mail | task. start/end are milliseconds; allDay items have no clock time.
export function agendaOn(k) {
  const out = [];
  calEventsOn(k).forEach(e => {
    const kind = kindOf(e.title);
    const it = { cal: true, kind, title: kind === 'event' ? e.title : stripKind(e.title), start: e.start, end: e.end, allDay: !!e.allDay, where: /^https?:/i.test(e.where || '') ? '' : (e.where || ''), src: e.cal || '', desc: stripLinks((e.desc || '').replace(/\s*Added from email\.?/i, '').trim()), links: extractLinks(`${e.desc || ''} ${e.where || ''}`) };
    if (kind !== 'event') { it.key = actionKey(e); it.done = !!S.inboxDone[it.key]; }
    out.push(it);
  });
  [...(app.brief.events || []), ...S.events].filter(e => occursOn(e, k)).forEach(e => {
    const s = e.time ? new Date(k + 'T' + e.time).getTime() : startOf(k);
    out.push({ kind: 'event', title: e.title, start: s, end: e.time ? s + (Number(e.mins) || 60) * 6e4 : s + 864e5, allDay: !e.time, where: e.where || '', src: '', desc: '', links: extractLinks(e.link || ''), id: S.events.some(x => x.id === e.id) ? e.id : '', interview: !!e.interview, repeat: e.repeat || '' });
  });
  openTasks().filter(t => t.due === k).forEach(t => out.push({ kind: 'task', title: t.title, start: t.time ? new Date(k + 'T' + t.time).getTime() : startOf(k), end: t.time ? new Date(k + 'T' + t.time).getTime() + 18e5 : startOf(k) + 864e5, allDay: !t.time, where: '', src: [t.repeat ? 'repeats ' + t.repeat : '', t.kind && t.kind !== 'Task' ? t.kind : ''].filter(Boolean).join(' · '), desc: '', links: extractLinks(t.link || ''), id: t.id, derived: !!t.derived, view: t.view || '', section: t.section || '' }));
  S.tasks.filter(t => t.done && t.due === k).forEach(t => out.push({ kind: 'task', title: t.title, start: startOf(k), end: startOf(k) + 864e5, allDay: true, where: '', src: '', desc: '', id: t.id, done: true }));
  return out.sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);
}

// A month's worth of dots: which kinds of thing each day holds, plus how many.
export function monthSummary(keys) {
  const m = {};
  keys.forEach(k => { const a = agendaOn(k); m[k] = { n: a.length, kinds: [...new Set(a.map(x => x.kind))] }; });
  return m;
}

// Plain words for how far away a day is.
export const dayWord = k => { const n = daysFromToday(k); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : ''; };
export const range = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));
export const isToday = k => k === today();
