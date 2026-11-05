// Tasks: everything to do, grouped by when it is due. Type a task in plain words ("Submit DHRM fri 5pm !"); open one for its sheet
// (time and reminder, repeat, link, note, steps, snooze). Rows swipe: right to finish, left to snooze or delete. See js/taskui.js.
import { S, ui, register } from '../core.js';
import { today, daysFromToday, esc, uid, fmtDay, addDays } from '../util.js';
import { empty, chip, head } from '../ui.js';
import { icon } from '../icons.js';
import { openTasks, byRank, uncompleteTask, doneToday } from '../logic.js';
import { parseQuick } from '../nlp.js';
import { taskRow, doneRow } from '../taskui.js';

const te = ui.te = { id: null, filter: 'all' };
const GROUPS = [
  ['over', 'Overdue', t => t.due && daysFromToday(t.due) < 0],
  ['today', 'Today', t => t.due && daysFromToday(t.due) === 0],
  ['week', 'Next 7 days', t => t.due && daysFromToday(t.due) > 0 && daysFromToday(t.due) <= 7],
  ['later', 'Later', t => t.due && daysFromToday(t.due) > 7],
  ['none', 'No date', t => !t.due],
];
const FILTERS = [['all', 'All'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['priority', 'Priority'], ['someday', 'No date']];
const test = (id, t) => ({ all: true, today: t.due && daysFromToday(t.due) <= 0, upcoming: t.due && daysFromToday(t.due) > 0, priority: t.important, someday: !t.due }[id]);

function render() {
  const all = openTasks().sort(byRank), open = all.filter(t => test(te.filter, t)), finished = doneToday();
  const late = all.filter(t => t.due && daysFromToday(t.due) < 0).length;
  const earlier = S.tasks.filter(t => t.done && t.doneAt !== today()).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const groups = GROUPS.map(([id, name, f]) => [id, name, open.filter(f)]).filter(g => g[2].length);
  return `${head('Tasks', all.length ? `${all.length} open${late ? ` · ${late} overdue` : ''}` : 'Nothing open')}
  <form data-form="task" data-keep class="capture wrap">${icon('plus', 18)}<input name="title" placeholder="Add a task, try: Submit DHRM fri 5pm !" aria-label="New task" maxlength="160" required data-bind="nlp" autocomplete="off"><em class="parsed" hidden></em>
    <select name="when" aria-label="Due"><option value="">Date from words</option><option value="0">Today</option><option value="1">Tomorrow</option><option value="7">In a week</option></select><input name="time" type="time" aria-label="Reminder time" title="Optional: remind me at this time"><button class="primary">Add</button></form>
  <div class="seg pills" role="tablist" aria-label="Show">${FILTERS.map(([k, l]) => `<button role="tab" aria-selected="${te.filter === k}" class="${te.filter === k ? 'on' : ''}" data-act="taskFilter" data-id="${k}">${l} <i class="cnt">${all.filter(t => test(k, t)).length}</i></button>`).join('')}</div>
  ${groups.length ? groups.map(([id, name, list]) => `<section class="card"><h2 class="${id === 'over' ? 'late' : ''}">${name} <span class="cnt">${list.length}</span></h2><ul class="list">${list.map(t => taskRow(t)).join('')}</ul></section>`).join('') : `<section class="card">${empty(all.length ? 'Nothing in this view.' : 'Nothing to do. Add something above, or enjoy the quiet.')}</section>`}
  ${finished.length ? `<section class="card"><h2>Done today <span class="cnt">${finished.length}</span></h2><ul class="list">${finished.map(doneRow).join('')}</ul></section>` : ''}
  ${earlier.length ? `<details class="card"><summary>Earlier (${earlier.length})</summary><ul class="list" style="margin-top:6px">${earlier.slice(0, 20).map(t => `<li class="done"><span class="grow title">${esc(t.title)}</span>${t.doneAt ? chip(fmtDay(t.doneAt), 'plain') : ''}<button class="ghost" data-act="taskUndo" data-id="${esc(t.id)}">Reopen</button></li>`).join('')}</ul><div class="row"><button class="ghost" data-act="clearDone">Clear these</button></div></details>` : ''}
  <p class="muted hint">Swipe a task right to finish it, left to snooze or delete. Hold for more.</p>`;
}

register({
  id: 'tasks', label: 'Tasks', nav: 2, render,
  actions: {
    taskUndo: d => uncompleteTask(d.id),
    taskFilter: d => { te.filter = d.id; },
    clearDone: () => { S.tasks = S.tasks.filter(t => !t.done || t.doneAt === today()); },
  },
  forms: {
    // Typed words set the date, time, repeat and priority; the date picker and time box win when they are used.
    task: f => {
      const p = parseQuick(f.title || ''); if (!p.title) return;
      const due = f.when !== '' && f.when !== undefined ? addDays(today(), Number(f.when)) : p.due || (f.time ? today() : '');
      S.tasks.push({ id: uid(), title: p.title, due, time: f.time || p.time, repeat: p.repeat, important: p.important, done: false, kind: 'Task' });
    },
  },
});
