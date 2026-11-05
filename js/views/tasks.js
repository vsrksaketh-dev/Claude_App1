// Tasks: everything to do, grouped by when it is due. Add a task in one line; open a task to give it a time (a reminder fires then),
// a repeat, a link, a note and steps (subtasks). Snooze moves it on. Deleting can be undone for a few seconds.
import { S, ui, register } from '../core.js';
import { today, daysFromToday, esc, uid, fmtDay, addDays } from '../util.js';
import { empty, chip, check, head, linkBtns, toast } from '../ui.js';
import { extractLinks } from '../links.js';
import { parseQuick, describe } from '../nlp.js';
import { openTasks, byRank, completeTask, uncompleteTask, doneToday, REPEATS } from '../logic.js';

const te = ui.te = { id: null, filter: 'all' };
const clock = hm => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };
const pad = n => String(n).padStart(2, '0');

const GROUPS = [
  ['over', 'Overdue', t => t.due && daysFromToday(t.due) < 0],
  ['today', 'Today', t => t.due && daysFromToday(t.due) === 0],
  ['week', 'Next 7 days', t => t.due && daysFromToday(t.due) > 0 && daysFromToday(t.due) <= 7],
  ['later', 'Later', t => t.due && daysFromToday(t.due) > 7],
  ['none', 'No date', t => !t.due],
];
const FILTERS = [['all', 'All'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['priority', 'Priority'], ['someday', 'No date']];
const pass = t => ({ all: true, today: t.due && daysFromToday(t.due) <= 0, upcoming: t.due && daysFromToday(t.due) > 0, priority: t.important, someday: !t.due }[te.filter] ?? true);
const dueText = t => { const n = daysFromToday(t.due); return n < 0 ? `${-n}d late` : n === 0 ? 'today' : n === 1 ? 'tomorrow' : fmtDay(t.due); };
const subsOf = t => t.subs || [];

const editor = t => `<form data-form="taskSave" data-id="${esc(t.id)}" class="hedit">
  <label>Task<input name="title" value="${esc(t.title)}" maxlength="140" required></label>
  <div class="inline"><label>Due date<input name="due" type="date" value="${esc(t.due || '')}"></label><label>Time (reminder)<input name="time" type="time" value="${esc(t.time || '')}"></label></div>
  <div class="inline"><label>Repeat<select name="repeat">${REPEATS.map(([k, l]) => `<option value="${k}" ${(t.repeat || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>Link (document, meeting)<input name="link" type="url" value="${esc(t.link || '')}" placeholder="https://"></label></div>
  <label>Note<textarea name="note" rows="2" placeholder="Details, context, what done looks like">${esc(t.note || '')}</textarea></label>
  <div class="row"><button class="primary">Save</button><button type="button" data-act="taskEditOpen" data-id="${esc(t.id)}">Close</button></div>
  <div class="row snooze"><span class="muted">Snooze</span><button type="button" class="pill" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="1h">1 hour</button><button type="button" class="pill" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="tom">Tomorrow</button><button type="button" class="pill" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="week">Next week</button></div></form>
  <div class="subs"><h3 class="group-h">Steps</h3>${subsOf(t).length ? `<ul class="list">${subsOf(t).map(s => `<li class="${s.d ? 'done' : ''}">${check('subTick', s.id, s.d, `data-task="${esc(t.id)}"`)}<span class="grow title">${esc(s.x)}</span><button class="ghost danger x" data-act="subDel" data-task="${esc(t.id)}" data-id="${esc(s.id)}" aria-label="Remove step">×</button></li>`).join('')}</ul>` : ''}
    <form data-form="subAdd" data-id="${esc(t.id)}" data-keep class="capture"><input name="x" placeholder="Add a step" aria-label="Add a step" maxlength="120" required><button class="primary">Add</button></form></div>`;

const row = t => {
  if (t.derived) return `<li data-flip="t:${esc(t.id)}"><div class="grow"><span class="title">${esc(t.title)}</span>${t.left ? `<div class="muted">${esc(t.left)}</div>` : ''}</div></li>`;
  const subs = subsOf(t), sd = subs.filter(s => s.d).length, n = t.due ? daysFromToday(t.due) : null;
  const when = t.due || t.time ? `<span class="muted ${n !== null && n < 0 ? 'late' : ''}">${esc(t.due ? dueText(t) : 'today')}${t.time ? ' ' + esc(clock(t.time)) : ''}${t.kind && t.kind !== 'Task' ? ' · ' + esc(t.kind) : ''}${t.repeat ? ' · repeats ' + esc(t.repeat) : ''}</span>` : '';
  return `<li data-flip="t:${esc(t.id)}" class="${te.id === t.id ? 'editing' : ''}">${check('taskDone', t.id, false)}<div class="grow"><span class="title" data-act="taskEditOpen" data-id="${esc(t.id)}">${esc(t.title)}</span>
      ${t.note && te.id !== t.id ? `<div class="muted task-note">${esc(t.note)}</div>` : ''}
      <div class="meta">${when}${subs.length ? chip(`${sd}/${subs.length} steps`, sd === subs.length ? 'ok' : 'plain') : ''}<button class="pri ${t.important ? 'on' : ''}" data-act="taskStar" data-id="${esc(t.id)}" aria-pressed="${!!t.important}">${t.important ? 'Priority' : 'Mark priority'}</button><button class="pri" data-act="taskEditOpen" data-id="${esc(t.id)}">${te.id === t.id ? 'Close' : 'Edit'}</button></div></div>
    ${linkBtns(extractLinks(t.link || ''))}<button class="ghost danger x" data-act="delTask" data-id="${esc(t.id)}" aria-label="Remove">×</button>${te.id === t.id ? `<div class="task-edit">${editor(t)}</div>` : ''}</li>`;
};
const doneRow = t => `<li class="done" data-flip="t:${esc(t.id)}">${check('taskUndo', t.id, true)}<div class="grow"><span class="title">${esc(t.title)}</span></div><button class="ghost danger x" data-act="delTask" data-id="${esc(t.id)}" aria-label="Remove">×</button></li>`;

function tasksPage() {
  const all = openTasks().sort(byRank), open = all.filter(pass), finished = doneToday();
  const earlier = S.tasks.filter(t => t.done && t.doneAt !== today()).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const groups = GROUPS.map(([id, name, f]) => [id, name, open.filter(f)]).filter(g => g[2].length);
  const count = id => all.filter(t => ({ all: true, today: t.due && daysFromToday(t.due) <= 0, upcoming: t.due && daysFromToday(t.due) > 0, priority: t.important, someday: !t.due }[id])).length;
  return `<form data-form="task" data-keep class="capture wrap"><input name="title" placeholder="Add a task, try: Submit DHRM fri 5pm !" aria-label="New task" maxlength="160" required data-bind="nlp" autocomplete="off"><em class="parsed" hidden></em>
    <select name="when" aria-label="Due"><option value="">No date</option><option value="0">Today</option><option value="1">Tomorrow</option><option value="7">In a week</option></select><input name="time" type="time" aria-label="Reminder time" title="Optional: remind me at this time"><button class="primary">Add</button></form>
  <div class="seg pills" role="tablist" aria-label="Show">${FILTERS.map(([k, l]) => `<button role="tab" aria-selected="${te.filter === k}" class="${te.filter === k ? 'on' : ''}" data-act="taskFilter" data-id="${k}">${l} <i class="cnt">${count(k)}</i></button>`).join('')}</div>
  ${groups.length ? `<section class="card">${groups.map(([id, name, list]) => `<h3 class="group-h">${name} ${chip(String(list.length), id === 'over' ? 'bad' : 'plain')}</h3><ul class="list">${list.map(row).join('')}</ul>`).join('')}</section>` : `<section class="card">${empty(all.length ? 'Nothing in this view.' : 'Nothing to do. Add something above, or enjoy the quiet.')}</section>`}
  ${finished.length ? `<section class="card"><div class="row between"><h2 style="margin:0">Done today</h2>${chip(String(finished.length), 'ok')}</div><ul class="list" style="margin-top:12px">${finished.map(doneRow).join('')}</ul></section>` : ''}
  ${earlier.length ? `<details class="card"><summary>Earlier (${earlier.length})</summary><ul class="list" style="margin-top:10px">${earlier.slice(0, 20).map(t => `<li class="done"><span class="grow title">${esc(t.title)}</span>${t.doneAt ? chip(fmtDay(t.doneAt), 'plain') : ''}<button class="ghost" data-act="taskUndo" data-id="${esc(t.id)}">Reopen</button></li>`).join('')}</ul><div class="row"><button class="ghost" data-act="clearDone">Clear these</button></div></details>` : ''}`;
}

function render() {
  const open = openTasks(), late = open.filter(t => t.due && daysFromToday(t.due) < 0).length;
  return `${head('Tasks', open.length ? `${open.length} open${late ? ` · ${late} overdue` : ''}` : 'Nothing open')}${tasksPage()}`;
}

register({
  id: 'tasks', label: 'Tasks', nav: 2, render,
  actions: {
    taskDone: d => completeTask(d.id),
    taskUndo: d => uncompleteTask(d.id),
    taskStar: d => { const t = S.tasks.find(x => x.id === d.id); if (t) t.important = !t.important; },
    delTask: d => {
      const i = S.tasks.findIndex(x => x.id === d.id); if (i < 0) return;
      const [t] = S.tasks.splice(i, 1);
      toast(`Deleted "${t.title.slice(0, 40)}"`, () => { S.tasks.splice(Math.min(i, S.tasks.length), 0, t); });
    },
    taskEditOpen: d => { te.id = te.id === d.id ? null : d.id; },
    taskFilter: d => { te.filter = d.id; },
    taskSnooze: d => {
      const t = S.tasks.find(x => x.id === d.id); if (!t) return;
      if (d.s === '1h') { const n = new Date(Date.now() + 36e5); t.due = today() > (t.due || '') ? today() : t.due; if (n.getDate() !== new Date().getDate()) t.due = addDays(today(), 1); t.time = `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
      else t.due = addDays(today(), d.s === 'week' ? 7 : 1);
      te.id = null;
      toast(d.s === '1h' ? `Snoozed to ${clock(t.time)}` : `Moved to ${fmtDay(t.due)}`);
    },
    subTick: d => { const t = S.tasks.find(x => x.id === d.task), s = t && subsOf(t).find(x => x.id === d.id); if (s) s.d = !s.d; },
    subDel: d => { const t = S.tasks.find(x => x.id === d.task); if (t) t.subs = subsOf(t).filter(x => x.id !== d.id); },
    clearDone: () => { S.tasks = S.tasks.filter(t => !t.done || t.doneAt === today()); },
  },
  forms: {
    taskSave: (f, form) => {
      const t = S.tasks.find(x => x.id === form.dataset.id); if (!t) return;
      t.title = (f.title || t.title).trim() || t.title; t.due = f.due || ''; t.time = f.time || ''; t.repeat = f.repeat || ''; t.link = (f.link || '').trim(); t.note = (f.note || '').trim();
      if (t.time && !t.due) t.due = today();       // a reminder time needs a day
      if (t.repeat && !t.due) t.due = today();     // so does a repeat
      te.id = null;
    },
    subAdd: (f, form) => { const t = S.tasks.find(x => x.id === form.dataset.id), x = (f.x || '').trim(); if (t && x) (t.subs ||= []).push({ id: uid(), x, d: false }); },
    // Typed words set the date, time, repeat and priority; the date picker and time box win when they are used.
    task: f => {
      const p = parseQuick(f.title || ''); if (!p.title) return;
      const due = f.when !== '' && f.when !== undefined ? addDays(today(), Number(f.when)) : p.due || (f.time ? today() : '');
      S.tasks.push({ id: uid(), title: p.title, due, time: f.time || p.time, repeat: p.repeat, important: p.important, done: false, kind: 'Task' });
    },
  },
});
