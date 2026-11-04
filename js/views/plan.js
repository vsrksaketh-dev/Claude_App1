// Plan: one simple list of everything to do, grouped by when it is due. Add a task in one line.
import { S, ui, register, remove } from '../core.js';
import { today, daysFromToday, esc, uid, fmtDay, addDays } from '../util.js';
import { empty, chip, check, head } from '../ui.js';
import { openTasks, byRank, completeTask, uncompleteTask, doneToday } from '../logic.js';

const GROUPS = [
  ['over', 'Overdue', t => t.due && daysFromToday(t.due) < 0],
  ['today', 'Today', t => t.due && daysFromToday(t.due) === 0],
  ['week', 'Next 7 days', t => t.due && daysFromToday(t.due) > 0 && daysFromToday(t.due) <= 7],
  ['later', 'Later', t => t.due && daysFromToday(t.due) > 7],
  ['none', 'No date', t => !t.due],
];
const dueText = t => { const n = daysFromToday(t.due); return n < 0 ? `${-n}d late` : n === 0 ? 'today' : n === 1 ? 'tomorrow' : fmtDay(t.due); };

const row = t => t.derived
  ? `<li data-flip="t:${esc(t.id)}"><div class="grow"><span class="title">${esc(t.title)}</span>${t.left ? `<div class="muted">${esc(t.left)}</div>` : ''}</div></li>`
  : `<li data-flip="t:${esc(t.id)}">${check('taskDone', t.id, false)}<div class="grow"><span class="title">${esc(t.title)}</span>
      <div class="meta">${t.due ? `<span class="muted">${esc(dueText(t))}${t.kind && t.kind !== 'Task' ? ' · ' + esc(t.kind) : ''}</span>` : ''}<button class="pri ${t.important ? 'on' : ''}" data-act="taskStar" data-id="${esc(t.id)}" aria-pressed="${!!t.important}">${t.important ? 'Priority' : 'Mark priority'}</button></div></div>
    <button class="ghost danger x" data-act="delTask" data-id="${esc(t.id)}" aria-label="Remove">×</button></li>`;
const doneRow = t => `<li class="done" data-flip="t:${esc(t.id)}">${check('taskUndo', t.id, true)}<div class="grow"><span class="title">${esc(t.title)}</span></div><button class="ghost danger x" data-act="delTask" data-id="${esc(t.id)}" aria-label="Remove">×</button></li>`;

function render() {
  const open = openTasks().sort(byRank), finished = doneToday();
  const earlier = S.tasks.filter(t => t.done && t.doneAt !== today()).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const groups = GROUPS.map(([id, name, f]) => [id, name, open.filter(f)]).filter(g => g[2].length);
  return `${head('Plan', open.length ? `${open.length} open` : 'Nothing open')}
  <form data-form="task" data-keep class="capture"><input name="title" placeholder="Add a task" aria-label="New task" maxlength="140" required>
    <select name="when" aria-label="Due"><option value="">No date</option><option value="0">Today</option><option value="1">Tomorrow</option><option value="7">In a week</option></select><button class="primary">Add</button></form>
  ${groups.length ? `<section class="card">${groups.map(([id, name, list]) => `<h3 class="group-h">${name} ${chip(String(list.length), id === 'over' ? 'bad' : 'plain')}</h3><ul class="list">${list.map(row).join('')}</ul>`).join('')}</section>` : `<section class="card">${empty('Nothing to do. Add something above, or enjoy the quiet.')}</section>`}
  ${finished.length ? `<section class="card"><div class="row between"><h2 style="margin:0">Done today</h2>${chip(String(finished.length), 'ok')}</div><ul class="list" style="margin-top:12px">${finished.map(doneRow).join('')}</ul></section>` : ''}
  ${earlier.length ? `<details class="card"><summary>Earlier (${earlier.length})</summary><ul class="list" style="margin-top:10px">${earlier.slice(0, 15).map(t => `<li class="done"><span class="grow title">${esc(t.title)}</span>${t.doneAt ? chip(fmtDay(t.doneAt), 'plain') : ''}</li>`).join('')}</ul><div class="row"><button class="ghost" data-act="clearDone">Clear these</button></div></details>` : ''}`;
}

register({
  id: 'plan', label: 'Plan', nav: 3, render,
  actions: {
    taskDone: d => completeTask(d.id),
    taskUndo: d => uncompleteTask(d.id),
    taskStar: d => { const t = S.tasks.find(x => x.id === d.id); if (t) t.important = !t.important; },
    delTask: d => remove('tasks', d.id),
    clearDone: () => { S.tasks = S.tasks.filter(t => !t.done || t.doneAt === today()); },
  },
  forms: {
    task: f => { const t = (f.title || '').trim(); if (t) S.tasks.push({ id: uid(), title: t, due: f.when === '' || f.when === undefined ? '' : addDays(today(), Number(f.when)), important: false, done: false, kind: 'Task' }); },
  },
});
