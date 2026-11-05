// Calendar: one place for everything dated. Month, week, day and agenda views over the same list the widgets use:
// synced Google Calendar events, events typed in by hand, deadlines, things to do, email key facts and tasks that fall due.
import { S, ui, app, register, render as rerender } from '../core.js';
import { today, addDays, parse, dateKey, weekStart, esc, EV_REPEATS, uid } from '../util.js';
import { chip, check, empty, head, linkBtns, toast } from '../ui.js';
import { icon } from '../icons.js';
import { colorFor } from '../colors.js';
import { getSources, hasCalendars, lastSync, syncAll } from '../calendar.js';
import { agendaOn, monthSummary, dayWord, range, KIND_LABEL } from '../agenda.js';

const MODES = [['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda']];
const HOUR = 46;                                   // pixels per hour in the week and day grids
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const mode = () => (MODES.some(m => m[0] === ui.sub.calMode) ? ui.sub.calMode : 'month');
const sel = () => ui.sub.calSel || today();
const anchor = () => ui.sub.calAnchor || sel();
const clock = ms => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
const longDay = k => parse(k).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = k => parse(k).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const monthName = k => parse(k).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const addMonths = (k, n) => { const d = parse(k); d.setDate(1); d.setMonth(d.getMonth() + n); return dateKey(d); };
const firstOf = k => k.slice(0, 8) + '01';

// ---- one row for the selected day, with the right control for what it is ----
function itemRow(it) {
  const time = it.allDay ? '' : `${clock(it.start)}${it.end > it.start ? ' to ' + clock(it.end) : ''}`;
  let lead = '';
  if (it.kind === 'task') lead = it.derived ? `<button data-act="openSource" data-view="${esc(it.view)}" data-section="${esc(it.section)}">Open</button>` : (it.done ? check('taskUndo', it.id, true) : check('taskDone', it.id, false));
  else if (it.key) lead = check('actToggle', it.key, it.done);
  else lead = `<span class="chip">${it.allDay ? 'All day' : clock(it.start)}</span>`;
  const tag = it.kind === 'event' ? (it.interview ? chip('Interview', 'warn') : it.repeat ? chip('Repeats', 'plain') : '') : chip(KIND_LABEL[it.kind], it.kind === 'due' ? 'bad' : it.kind === 'action' ? 'warn' : 'plain');
  const meta = [it.kind !== 'event' && time ? time : it.kind === 'event' && !it.allDay && it.end > it.start ? 'until ' + clock(it.end) : '', it.where, it.src, it.desc].filter(Boolean).join(' · ');
  return `<li data-flip="c:${esc(it.id || it.key || it.title)}:${it.start}" class="cal-item k-${it.kind} ${it.done ? 'done' : ''}" style="--c:${colorFor(it)}">${lead}<div class="grow"><span class="title">${esc(it.title)}</span> ${tag}${meta ? `<div class="muted">${esc(meta)}</div>` : ''}</div>${linkBtns(it.links)}${it.gcal ? `<a class="lk lk-gcal" href="${esc(it.gcal)}" target="_blank" rel="noopener noreferrer" title="Edit in Google Calendar">Edit</a>` : ''}${it.id && it.kind === 'event' ? `<button class="ghost" data-act="calEditEv" data-id="${esc(it.id)}" data-start="${it.start}" aria-label="Edit">${icon('edit', 17)}</button>` : ''}</li>`;
}
const evFields = (e, k) => `<label>Title<input name="title" required value="${esc(e.title || '')}"></label><label>Date<input name="date" type="date" required value="${esc(e.date || k)}"></label><label>Time<input name="time" type="time" value="${esc(e.time || '')}"></label>
  <label>Length<select name="mins">${[[30, '30 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], [180, '3 hours']].map(([v, l]) => `<option value="${v}" ${Number(e.mins || 60) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>Repeat<select name="repeat">${EV_REPEATS.map(([v, l]) => `<option value="${v}" ${(e.repeat || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>Place<input name="where" value="${esc(e.where || '')}" placeholder="Room or Online"></label><label>Link<input name="link" type="url" value="${esc(e.link || '')}" placeholder="Meeting or document link"></label>`;
function evEditor(e, start) {
  if (!e) return '';
  const day = dateKey(new Date(start));
  return `<form data-form="eventSave" data-id="${esc(e.id)}" class="inline ev-edit">${evFields(e, day)}<div class="row"><button class="primary">Save</button>
    ${e.repeat ? `<button type="button" class="ghost danger" data-act="evSkip" data-id="${esc(e.id)}" data-d="${day}">Skip this one</button>` : ''}<button type="button" class="ghost danger" data-act="evDel" data-id="${esc(e.id)}">Delete${e.repeat ? ' all' : ''}</button></div></form>`;
}
app.sheets.event = s => { const e = S.events.find(x => x.id === s.id); return e ? `<h2>${esc(e.title)}</h2>${evEditor(e, s.start || Date.now())}` : ''; };
const itemList = items => items.length ? `<ul class="list">${[...items.filter(i => !i.done), ...items.filter(i => i.done)].map(itemRow).join('')}</ul>` : empty('Nothing planned.');

const addForm = k => `<details ${ui.sub.calAdd ? 'open' : ''}><summary>Add an event on this day</summary><form data-form="event" class="inline">${evFields({}, k)}<button class="primary">Add</button></form></details>`;

function dayCard(k) {
  const items = agendaOn(k);
  const w = dayWord(k);
  return `<section class="card" id="cal-day"><div class="row between"><h2 style="margin:0">${esc(longDay(k))}</h2>${w ? chip(w, k === today() ? '' : 'plain') : ''}</div>
    <div style="margin-top:12px">${itemList(items)}</div>${addForm(k)}</section>`;
}

// ---- month ----
function dots(kinds) { return kinds.slice(0, 4).map(x => `<i class="d-${x}"></i>`).join(''); }
function monthView() {
  const a = anchor(), first = firstOf(a), start = weekStart(first);
  const lastDay = addDays(addMonths(first, 1), -1);
  const weeks = Math.ceil(((parse(lastDay) - parse(start)) / 864e5 + 1) / 7);
  const keys = range(start, weeks * 7);
  const sum = monthSummary(keys);
  return `<div class="card cal-month"><div class="cal-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${keys.map(k => {
      const s = sum[k], out = k.slice(0, 7) !== first.slice(0, 7);
      return `<button class="cal-cell ${out ? 'out' : ''} ${k === today() ? 'today' : ''} ${k === sel() ? 'sel' : ''}" data-act="calPick" data-d="${k}" aria-label="${esc(longDay(k))}${s.n ? ', ' + s.n + ' items' : ''}"><b>${Number(k.slice(8))}</b><span class="cal-dots">${dots(s.kinds)}</span>${s.n > 1 ? `<em>${s.n}</em>` : ''}</button>`;
    }).join('')}</div>
    <div class="cal-key">${[['event', 'Event'], ['due', 'Due'], ['action', 'To do'], ['mail', 'Email'], ['task', 'Task']].map(([k, l]) => `<span><i class="d-${k}"></i>${l}</span>`).join('')}</div></div>`;
}

// ---- week and day: a time grid like Google Calendar ----
function mins(ms) { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
function layout(items) {
  const list = items.filter(i => !i.allDay).map(i => ({ ...i, s: mins(i.start), e: Math.max(mins(i.start) + 25, new Date(i.end).toDateString() === new Date(i.start).toDateString() ? mins(i.end) : 1440) })).sort((a, b) => a.s - b.s || a.e - b.e);
  let cluster = [], end = -1;
  const flush = () => {
    const lanes = [];
    cluster.forEach(it => { let l = lanes.findIndex(x => x <= it.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = it.e; it.lane = l; });
    cluster.forEach(it => { it.n = lanes.length; });
  };
  list.forEach(it => { if (it.s >= end && cluster.length) { flush(); cluster = []; } cluster.push(it); end = cluster.length === 1 ? it.e : Math.max(end, it.e); });
  if (cluster.length) flush();
  return list;
}
function timeGrid(keys, full) {
  const days = keys.map(k => ({ k, items: agendaOn(k) }));
  const timed = days.flatMap(d => layout(d.items));
  const h0 = Math.max(0, Math.min(8, timed.length ? Math.floor(Math.min(...timed.map(t => t.s)) / 60) : 8));
  const h1 = Math.min(24, Math.max(19, timed.length ? Math.ceil(Math.max(...timed.map(t => t.e)) / 60) : 19));
  const nowMin = mins(Date.now());
  const col = d => {
    const blocks = layout(d.items).map(it => `<button class="cal-block k-${it.kind} ${it.n > 1 ? 'tight' : ''}" title="${esc(it.title)}" data-act="calPick" data-d="${d.k}" style="top:${(it.s - h0 * 60) * HOUR / 60}px;height:${Math.max(20, (it.e - it.s) * HOUR / 60 - 2)}px;left:${it.lane / it.n * 100}%;width:${100 / it.n}%"><b>${esc(it.title)}</b>${full ? `<span>${clock(it.start)}${it.where ? ' · ' + esc(it.where) : ''}</span>` : ''}</button>`).join('');
    const now = d.k === today() && nowMin >= h0 * 60 && nowMin <= h1 * 60 ? `<i class="cal-now" style="top:${(nowMin - h0 * 60) * HOUR / 60}px"></i>` : '';
    return `<div class="cal-col ${d.k === sel() ? 'sel' : ''}">${blocks}${now}</div>`;
  };
  const allDay = d => {
    const a = d.items.filter(i => i.allDay);
    return `<div class="cal-allday">${(full ? a : a.slice(0, 2)).map(i => `<button class="cal-chip k-${i.kind}" data-act="calPick" data-d="${d.k}">${esc(i.title)}</button>`).join('')}${!full && a.length > 2 ? `<em>+${a.length - 2}</em>` : ''}</div>`;
  };
  const head2 = days.map(d => `<button class="cal-dayhead ${d.k === today() ? 'today' : ''} ${d.k === sel() ? 'sel' : ''}" data-act="${full ? 'calPick' : 'calOpenDay'}" data-d="${d.k}"><span>${parse(d.k).toLocaleDateString('en-IN', { weekday: 'short' })}</span><b>${Number(d.k.slice(8))}</b></button>`).join('');
  const hours = Array.from({ length: h1 - h0 }, (_, i) => `<span style="height:${HOUR}px">${((h0 + i) % 12 || 12)}${h0 + i < 12 ? 'a' : 'p'}</span>`).join('');
  return `<div class="card cal-tg ${full ? 'one' : ''}"><div class="cal-tg-head" style="--n:${days.length}"><span></span>${head2}</div>
    ${days.some(d => d.items.some(i => i.allDay)) ? `<div class="cal-tg-allday" style="--n:${days.length}"><span>all day</span>${days.map(allDay).join('')}</div>` : ''}
    <div class="cal-tg-body" style="--n:${days.length};height:${(h1 - h0) * HOUR}px"><div class="cal-hours">${hours}</div>${days.map(col).join('')}</div></div>`;
}
const weekView = () => timeGrid(range(weekStart(anchor()), 7), false);
const dayView = () => timeGrid([anchor()], true);

// ---- agenda: the next few weeks as a plain list ----
function agendaView() {
  const keys = range(anchor(), 28);
  const blocks = keys.map(k => [k, agendaOn(k)]).filter(([, a]) => a.length);
  return blocks.length ? blocks.map(([k, a]) => `<section class="card"><div class="row between"><h2 style="margin:0">${esc(shortDay(k))}</h2>${dayWord(k) ? chip(dayWord(k), k === today() ? '' : 'plain') : ''}</div><div style="margin-top:10px">${itemList(a)}</div></section>`).join('')
    : `<section class="card">${empty('Nothing planned in the next four weeks.')}</section>`;
}

function title() {
  const m = mode(), a = anchor();
  if (m === 'month') return monthName(a);
  if (m === 'week') { const s = weekStart(a), e = addDays(s, 6); return `${shortDay(s)} to ${shortDay(e)}`; }
  if (m === 'day') return longDay(a);
  return `From ${shortDay(a)}`;
}

function render() {
  const m = mode();
  const syncedAt = lastSync();
  const body = m === 'month' ? monthView() : m === 'week' ? weekView() : m === 'day' ? dayView() : agendaView();
  const errs = getSources().filter(s => s.error).map(s => `<p class="chip warn" style="display:block;margin-top:8px">${esc(s.name)}: ${esc(s.error)}</p>`).join('');
  return `${head('Calendar', 'Everything dated, in one place.', '<button class="pill" data-nav="academics">Classes</button><button class="pill" data-act="calToday">Today</button>')}
  <div class="seg pills" role="tablist">${MODES.map(([id, l]) => `<button role="tab" aria-selected="${m === id}" class="${m === id ? 'on' : ''}" data-act="calMode" data-id="${id}">${l}</button>`).join('')}</div>
  <div class="row between cal-nav"><button class="pill" data-act="calPrev" aria-label="Previous">‹</button><span class="title">${esc(title())}</span><button class="pill" data-act="calNext" aria-label="Next">›</button></div>
  ${body}
  ${m === 'month' || m === 'week' ? dayCard(sel()) : m === 'day' ? `<section class="card"><h2>${esc(longDay(anchor()))}</h2>${itemList(agendaOn(anchor()))}${addForm(anchor())}</section>` : ''}
  <p class="muted">${hasCalendars() ? `Google Calendar synced${syncedAt ? ' ' + Math.max(1, Math.round((Date.now() - syncedAt) / 6e4)) + ' min ago' : ''}. <button class="ghost" data-act="calSync">Sync now</button>` : 'Connect Google Calendar in Settings to see its events here.'}</p>${errs}`;
}

const step = (m, dir) => {
  const a = anchor();
  if (m === 'month') { ui.sub.calAnchor = addMonths(a, dir); ui.sub.calSel = firstOf(ui.sub.calAnchor).slice(0, 7) === today().slice(0, 7) ? today() : firstOf(ui.sub.calAnchor); }
  else if (m === 'week') { ui.sub.calAnchor = addDays(a, 7 * dir); ui.sub.calSel = addDays(sel(), 7 * dir); }
  else if (m === 'day') { ui.sub.calAnchor = addDays(a, dir); ui.sub.calSel = ui.sub.calAnchor; }
  else ui.sub.calAnchor = addDays(a, 14 * dir);
};

register({
  id: 'calendar', label: 'Calendar', nav: 4, render,
  actions: {
    calMode: d => { ui.sub.calMode = d.id; if (d.id === 'day' || d.id === 'week') ui.sub.calAnchor = sel(); if (d.id === 'month') ui.sub.calAnchor = sel(); if (d.id === 'agenda') ui.sub.calAnchor = today(); },
    calPrev: () => step(mode(), -1),
    calNext: () => step(mode(), 1),
    calToday: () => { ui.sub.calSel = today(); ui.sub.calAnchor = today(); },
    calPick: d => { ui.sub.calAdd = false; ui.sub.calSel = d.d; if (mode() === 'month' && d.d.slice(0, 7) !== firstOf(anchor()).slice(0, 7)) ui.sub.calAnchor = d.d; setTimeout(() => document.getElementById('cal-day')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 40); },
    calEditEv: d => { ui.sheet = { kind: 'event', id: d.id, start: Number(d.start) }; },
    evSkip: d => { const e = S.events.find(x => x.id === d.id); if (e) { (e.skip ||= []).push(d.d); ui.sheet = null; toast('Skipped this one', () => { e.skip = e.skip.filter(x => x !== d.d); }); } },
    evDel: d => { const i = S.events.findIndex(x => x.id === d.id); if (i < 0) return; const [e] = S.events.splice(i, 1); ui.sheet = null; toast(`Deleted "${e.title.slice(0, 40)}"`, () => { S.events.splice(i, 0, e); }); },
    calOpenDay: d => { ui.sub.calMode = 'day'; ui.sub.calSel = d.d; ui.sub.calAnchor = d.d; },
    calSync: () => { syncAll(true).then(() => rerender()); },
  },
  forms: {
    eventSave: (f, form) => {
      const e = S.events.find(x => x.id === form.dataset.id); if (!e) return;
      Object.assign(e, { title: (f.title || e.title).trim() || e.title, date: f.date || e.date, time: f.time || '', mins: Number(f.mins) || 60, repeat: f.repeat || '', where: (f.where || '').trim(), link: (f.link || '').trim() });
      ui.sheet = null;
    },
  },
});
