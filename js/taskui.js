// Everything a single task looks like and does, shared by Home and Tasks: the swipeable row, the edit sheet and the long-press menu.
// Swipe right finishes it; swipe left reveals Snooze (to tomorrow) and Delete (with Undo); tap the title for the sheet; hold for the menu.
import { S, ui, app, register } from './core.js';
import { today, daysFromToday, esc, uid, fmtDay, addDays } from './util.js';
import { chip, check, linkBtns, toast } from './ui.js';
import { icon } from './icons.js';
import { extractLinks } from './links.js';
import { completeTask, REPEATS } from './logic.js';

export const clock = hm => { const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; };
const pad = n => String(n).padStart(2, '0');
const subsOf = t => t.subs || [];
export const dueText = t => { const n = daysFromToday(t.due); return n < 0 ? (n === -1 ? 'Yesterday' : `${-n} days late`) : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDay(t.due); };

// One task as a list row. opts.when: show the date (Tasks shows it, Home's Today list does not need it for today's tasks).
export function taskRow(t, opts = {}) {
  if (t.derived) return `<li data-flip="t:${esc(t.id)}"><div class="grow"><span class="title">${esc(t.title)}</span>${t.left ? `<div class="muted">${esc(t.left)}</div>` : ''}</div></li>`;
  const subs = subsOf(t), sd = subs.filter(s => s.d).length, n = t.due ? daysFromToday(t.due) : null;
  const meta = [];
  if ((t.due && opts.when !== false) || t.time) meta.push(`<span class="${n !== null && n < 0 ? 'late' : ''}">${icon('clock', 13)} ${esc(t.due && opts.when !== false ? dueText(t) : '')}${t.time ? (t.due && opts.when !== false ? ' ' : '') + esc(clock(t.time)) : ''}</span>`);
  if (t.repeat) meta.push(`<span>${icon('repeat', 13)} ${esc(t.repeat)}</span>`);
  if (subs.length) meta.push(`<span>${icon('steps', 13)} ${sd} of ${subs.length} steps</span>`);
  if (t.kind && t.kind !== 'Task') meta.push(`<span>${esc(t.kind)}</span>`);
  return `<li class="sw" data-swipe-done="taskDone" data-id="${esc(t.id)}" data-menu="task:${esc(t.id)}" data-flip="t:${esc(t.id)}">
    <div class="sw-under"><span class="sw-done">${icon('check', 18)} Done</span><span class="sw-right"><button class="sn" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="tom">${icon('snooze', 19)}Tomorrow</button><button class="dl" data-act="delTask" data-id="${esc(t.id)}">${icon('trash', 19)}Delete</button></span></div>
    <div class="sw-row">${check('taskDone', t.id, false)}<div class="grow"><span class="title" data-act="taskEditOpen" data-id="${esc(t.id)}">${esc(t.title)}</span>
      ${meta.length || t.note ? `<div class="tmeta">${meta.join('')}${t.note ? `<span class="tnote">${esc(t.note)}</span>` : ''}</div>` : ''}</div>
      ${linkBtns(extractLinks(t.link || ''))}${t.important ? `<span class="pflag" title="Priority">${icon('flag', 16)}</span>` : ''}
      <button class="ghost edit-btn" data-act="taskEditOpen" data-id="${esc(t.id)}" aria-label="Edit">${icon('edit', 17)}</button></div></li>`;
}
export const doneRow = t => `<li class="done" data-flip="t:${esc(t.id)}"><div class="sw-row">${check('taskUndo', t.id, true)}<div class="grow"><span class="title">${esc(t.title)}</span></div><button class="ghost danger x" data-act="delTask" data-id="${esc(t.id)}" aria-label="Remove">${icon('close', 16)}</button></div></li>`;

// ---- the edit sheet ----
app.sheets.task = s => {
  const t = S.tasks.find(x => x.id === s.id); if (!t) return '';
  return `<form data-form="taskSave" data-id="${esc(t.id)}" class="hedit">
    <label>Task<input name="title" value="${esc(t.title)}" maxlength="160" required></label>
    <div class="inline"><label>Due date<input name="due" type="date" value="${esc(t.due || '')}"></label><label>Time (reminder)<input name="time" type="time" value="${esc(t.time || '')}"></label></div>
    <div class="inline"><label>Repeat<select name="repeat">${REPEATS.map(([k, l]) => `<option value="${k}" ${(t.repeat || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check pri-box"><input type="checkbox" name="important" ${t.important ? 'checked' : ''}> Priority</label></div>
    <label>Link (document, meeting)<input name="link" type="url" value="${esc(t.link || '')}" placeholder="https://"></label>
    <label>Note<textarea name="note" rows="2" placeholder="Details, context, what done looks like">${esc(t.note || '')}</textarea></label>
    <div class="row"><button class="primary">Save</button><button type="button" data-act="sheetClose">Cancel</button></div></form>
  <div class="subs"><h3 class="group-h">Steps</h3>${subsOf(t).length ? `<ul class="list">${subsOf(t).map(x => `<li class="${x.d ? 'done' : ''}">${check('subTick', x.id, x.d, `data-task="${esc(t.id)}"`)}<span class="grow title">${esc(x.x)}</span><button class="ghost danger x" data-act="subDel" data-task="${esc(t.id)}" data-id="${esc(x.id)}" aria-label="Remove step">${icon('close', 15)}</button></li>`).join('')}</ul>` : ''}
    <form data-form="subAdd" data-id="${esc(t.id)}" data-keep class="capture"><input name="x" placeholder="Add a step" aria-label="Add a step" maxlength="120" required><button class="primary">Add</button></form></div>
  <div class="row snooze"><span class="muted">Snooze</span><button type="button" class="pill" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="1h">1 hour</button><button type="button" class="pill" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="tom">Tomorrow</button><button type="button" class="pill" data-act="taskSnooze" data-id="${esc(t.id)}" data-s="week">Next week</button></div>
  <div class="row sheet-foot"><button class="ghost danger" data-act="delTask" data-id="${esc(t.id)}">${icon('trash', 16)} Delete</button><button class="primary" data-act="taskDone" data-id="${esc(t.id)}" data-close-sheet="1">${icon('check', 16)} Done</button></div>`;
};

// ---- the long-press menu ----
app.menus.task = id => {
  const t = S.tasks.find(x => x.id === id); if (!t) return [];
  const items = [
    { label: 'Edit', icon: icon('edit', 19), act: 'taskEditOpen', data: { id } },
    { label: t.important ? 'Remove priority' : 'Mark as priority', icon: icon('flag', 19), act: 'taskStar', data: { id } },
    { label: 'Do it today', icon: icon('calendar', 19), act: 'taskToday', data: { id } },
    { label: 'Snooze to tomorrow', icon: icon('snooze', 19), act: 'taskSnooze', data: { id, s: 'tom' } },
    { label: 'Delete', icon: icon('trash', 19), act: 'delTask', data: { id }, danger: true },
  ];
  items.title = esc(t.title);
  return items;
};

register({
  id: 'taskui', section: true,
  actions: {
    taskEditOpen: d => { ui.sheet = { kind: 'task', id: d.id }; },
    taskDone: d => { completeTask(d.id); if (ui.sheet && ui.sheet.kind === 'task' && ui.sheet.id === d.id) ui.sheet = null; },
    taskStar: d => { const t = S.tasks.find(x => x.id === d.id); if (t) t.important = !t.important; },
    taskToday: d => { const t = S.tasks.find(x => x.id === d.id); if (t) { t.due = today(); toast('Moved to today'); } },
    delTask: d => {
      const i = S.tasks.findIndex(x => x.id === d.id); if (i < 0) return;
      const [t] = S.tasks.splice(i, 1);
      if (ui.sheet && ui.sheet.id === d.id) ui.sheet = null;
      toast(`Deleted "${t.title.slice(0, 40)}"`, () => { S.tasks.splice(Math.min(i, S.tasks.length), 0, t); });
    },
    taskSnooze: d => {
      const t = S.tasks.find(x => x.id === d.id); if (!t) return;
      if (d.s === '1h') { const n = new Date(Date.now() + 36e5); t.due = n.getDate() !== new Date().getDate() ? addDays(today(), 1) : today(); t.time = `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
      else t.due = addDays(today(), d.s === 'week' ? 7 : 1);
      if (ui.sheet && ui.sheet.id === d.id) ui.sheet = null;
      toast(d.s === '1h' ? `Snoozed to ${clock(t.time)}` : `Moved to ${fmtDay(t.due)}`);
    },
    subTick: d => { const t = S.tasks.find(x => x.id === d.task), s = t && subsOf(t).find(x => x.id === d.id); if (s) s.d = !s.d; },
    subDel: d => { const t = S.tasks.find(x => x.id === d.task); if (t) t.subs = subsOf(t).filter(x => x.id !== d.id); },
    // From a free slot on the Today timeline: give the task that slot's time today.
    taskPlace: d => { const t = S.tasks.find(x => x.id === d.id); if (!t) return; t.due = today(); t.time = d.time; ui.sheet = null; toast(`${t.title.slice(0, 30)} at ${clock(d.time)}`); },
  },
  forms: {
    taskSave: (f, form) => {
      const t = S.tasks.find(x => x.id === form.dataset.id); if (!t) return;
      t.title = (f.title || t.title).trim() || t.title; t.due = f.due || ''; t.time = f.time || ''; t.repeat = f.repeat || ''; t.link = (f.link || '').trim(); t.note = (f.note || '').trim(); t.important = !!f.important;
      if ((t.time || t.repeat) && !t.due) t.due = today();
      ui.sheet = null;
    },
    subAdd: (f, form) => { const t = S.tasks.find(x => x.id === form.dataset.id), x = (f.x || '').trim(); if (t && x) (t.subs ||= []).push({ id: uid(), x, d: false }); },
  },
});
