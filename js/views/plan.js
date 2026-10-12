import { S, ui, register, byId, remove } from '../core.js';
import { today, daysFromToday, esc, uid, fmtDay } from '../util.js';
import { field, empty, chip, bar, tabs, subOf, check, head } from '../ui.js';
import { careerPages, careerOn } from '../sections/career.js';
import { GOAL_AREAS } from '../data.js';
import { openTasks, taskQuadrant, completeTask, goalProgress } from '../logic.js';

const BASE_TABS = [['tasks', 'Tasks'], ['goals', 'Goals']];
const tabList = () => [...BASE_TABS, ...(careerOn() ? [['board', 'Applications'], ['people', 'Network'], ['star', 'Stories']] : [])];
const goalOptions = (sel = '') => `<option value="">No goal</option>${S.goals.filter(g => g.status === 'active').map(g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}`;
const dueChip = t => {
  if (!t.due) return '';
  const n = daysFromToday(t.due);
  return chip(n < 0 ? 'overdue' : n === 0 ? 'today' : n + 'd', n <= 1 ? 'warn' : '');
};

function tasksTab() {
  const triage = S.tasks.filter(t => t.triage);
  const open = openTasks();
  const q = { UI: ['Do first', 'Urgent and important'], I: ['Schedule', 'Important, not urgent'], U: ['Quick or delegate', 'Urgent, not important'], '': ['Drop or later', 'Neither'] };
  const done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  return `
  ${triage.length ? `<div class="card alert"><h2>Sort what you captured</h2>${triage.map(t => `<form data-form="triage" class="inline" style="border-top:1px solid var(--line);padding-top:8px"><input type="hidden" name="id" value="${t.id}"><div class="title" style="grid-column:1/-1">${esc(t.title)}</div>${field('Due', 'due', 'type="date"')}<label>Goal<select name="goal">${goalOptions()}</select></label><label class="check"><input type="checkbox" name="important"> Important</label><button class="primary">Sort</button><button type="button" class="ghost danger" data-act="delTask" data-id="${t.id}">Delete</button></form>`).join('')}</div>` : ''}
  <div class="matrix">${Object.entries(q).map(([k, [name, desc]]) => `<div><h3>${name}</h3><p class="muted">${desc}</p><ul class="list">${open.filter(t => taskQuadrant(t) === k).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).map(t => `<li>${t.derived ? `<button data-act="openSource" data-view="${t.view}" data-section="${t.section}">Open</button>` : check('taskDone', t.id, false)}<div class="grow">${esc(t.title)} ${dueChip(t)} ${t.kind && t.kind !== 'Task' ? chip(esc(t.kind), 'plain') : ''}${t.goalId && byId(S.goals, t.goalId) ? chip(esc(byId(S.goals, t.goalId).title), 'plain') : ''}${t.left ? `<div class="muted">left: ${esc(t.left)}</div>` : t.due ? `<div class="muted">due ${esc(t.due)}</div>` : ''}</div>${t.derived ? '' : `<button class="ghost danger" data-act="delTask" data-id="${t.id}" aria-label="Delete">×</button>`}</li>`).join('')}</ul></div>`).join('')}</div>
  <p class="muted">Urgent means due within 2 days or overdue. Items move between boxes as their deadline approaches.</p>
  ${done.length ? `<details class="card"><summary>Completed (${done.length})</summary><ul class="list">${done.slice(0, 15).map(t => `<li class="done"><span class="grow title">${esc(t.title)}</span>${t.doneAt ? chip(fmtDay(t.doneAt), 'plain') : ''}</li>`).join('')}</ul><button class="ghost" data-act="clearDone">Clear completed</button></details>` : ''}`;
}

function goalsTab() {
  const active = S.goals.filter(g => g.status === 'active'), other = S.goals.filter(g => g.status !== 'active');
  const card = g => {
    const focusMin = Object.values(S.focusTags).reduce((a, d) => a + (d[g.title] || 0), 0);
    const linked = S.habits.filter(h => (g.habitIds || []).includes(h.id));
    const tasks = S.tasks.filter(t => t.goalId === g.id);
    return `<div class="card"><div class="row between"><span class="title">${esc(g.title)}</span><span class="row">${chip(esc(g.area), 'plain')}${chip(esc(g.horizon))}${g.due ? chip(g.due, daysFromToday(g.due) < 14 ? 'warn' : 'plain') : ''}</span></div>
      ${g.why ? `<p class="muted">Why: ${esc(g.why)}</p>` : ''}
      ${bar(goalProgress(g))}<p class="muted">${goalProgress(g)}% · ${tasks.filter(t => t.done).length}/${tasks.length} tasks · ${(focusMin / 60).toFixed(1)}h focus</p>
      <ul class="list">${g.milestones.map(m => `<li class="${m.done ? 'done' : ''}">${check('msDone', g.id, m.done, `data-ms="${m.id}"`)}<span class="grow">${esc(m.text)}</span><button class="ghost danger" data-act="msDel" data-id="${g.id}" data-ms="${m.id}" aria-label="Remove">×</button></li>`).join('')}</ul>
      <form data-form="milestone" class="row" style="flex-wrap:nowrap"><input type="hidden" name="id" value="${g.id}"><input name="text" class="grow" placeholder="Add a milestone" required><button>Add</button></form>
      ${linked.length ? `<p class="muted">Habits: ${linked.map(h => esc(h.name)).join(', ')}</p>` : ''}
      <details><summary>Link a habit, change status</summary>
        <form data-form="goalHabit" class="inline"><input type="hidden" name="id" value="${g.id}"><label>Habit<select name="habit">${S.habits.filter(h => !h.archived && !(g.habitIds || []).includes(h.id)).map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label><button>Link</button></form>
        <div class="row"><button data-act="goalStatus" data-id="${g.id}" data-status="${g.status === 'done' ? 'active' : 'done'}">${g.status === 'done' ? 'Reopen' : 'Mark done'}</button><button data-act="goalStatus" data-id="${g.id}" data-status="${g.status === 'paused' ? 'active' : 'paused'}">${g.status === 'paused' ? 'Resume' : 'Pause'}</button><button class="ghost danger" data-act="goalDel" data-id="${g.id}">Delete</button></div></details></div>`;
  };
  return `${active.length ? active.map(card).join('') : empty('No active goals. Start with one thing you want to be true by the end of the quarter.')}
  <div class="card"><h2>New goal</h2><form data-form="goal">${field('Goal', 'title', 'required placeholder="e.g. Land a marketing role at a FMCG firm"')}${field('Why it matters', 'why')}
    <div class="inline"><label>Area<select name="area">${GOAL_AREAS.map(a => `<option>${a}</option>`).join('')}</select></label><label>Horizon<select name="horizon"><option>quarter</option><option>year</option><option>long term</option></select></label>${field('Target date', 'due', 'type="date"')}</div><button class="primary">Create goal</button></form></div>
  ${other.length ? `<details class="card"><summary>Done and paused (${other.length})</summary>${other.map(card).join('')}</details>` : ''}`;
}

// Floating add button, and the sheet it opens, so a task is always one tap away.
function addSheet() {
  if (!ui.sub.addTask) return '<button class="fab primary" data-act="openAdd">+ Add task</button>';
  return `<div class="sheet-back" data-act="closeAdd"></div>
  <form class="sheet" data-form="task"><div class="row between"><h2 style="margin:0">New task</h2><button type="button" class="ghost" data-act="closeAdd">Cancel</button></div>
    <label>Task<input name="title" required autofocus></label>
    <div class="inline">${field('Due', 'due', 'type="date"')}<label>Type<select name="kind"><option>Task</option><option>Submission</option><option>Exam</option><option>Presentation</option><option>Placement</option></select></label></div>
    <label class="check"><input type="checkbox" name="important" checked> Important</label>
    <details><summary>Link to a goal</summary><label>Goal<select name="goal">${goalOptions()}</select></label></details>
    <button class="primary">Add task</button></form>`;
}

function render() {
  const TABS = tabList();
  const pages = { tasks: tasksTab, goals: goalsTab, ...careerPages };
  const sub = pages[subOf('plan', TABS)] ? subOf('plan', TABS) : 'tasks';
  return `${head('Plan', 'Tasks, goals and applications.')}${tabs('plan', TABS)}${pages[sub]()}${sub === 'tasks' ? addSheet() : ''}`;
}

register({
  id: 'plan', label: 'Plan', nav: 3, render,
  actions: {
    openAdd: () => { ui.sub.addTask = true; },
    closeAdd: () => { ui.sub.addTask = false; },
    taskDone: d => completeTask(d.id),
    delTask: d => remove('tasks', d.id),
    clearDone: () => { S.tasks = S.tasks.filter(t => !t.done); },
    msDone: d => { const m = byId(byId(S.goals, d.id).milestones, d.ms); m.done = !m.done; },
    msDel: d => { const g = byId(S.goals, d.id); g.milestones = g.milestones.filter(m => m.id !== d.ms); },
    goalStatus: d => { byId(S.goals, d.id).status = d.status; },
    goalDel: d => { remove('goals', d.id); S.tasks.forEach(t => { if (t.goalId === d.id) t.goalId = ''; }); },
  },
  forms: {
    task: f => { ui.sub.addTask = false; S.tasks.push({ id: uid(), title: f.title, due: f.due, important: !!f.important, done: false, kind: f.kind, goalId: f.goal || '' }); },
    triage: f => { const t = byId(S.tasks, f.id); Object.assign(t, { triage: false, due: f.due, important: !!f.important, goalId: f.goal }); },
    goal: f => S.goals.push({ id: uid(), title: f.title, why: f.why, area: f.area, horizon: f.horizon, due: f.due, status: 'active', milestones: [], habitIds: [], created: today() }),
    milestone: f => byId(S.goals, f.id).milestones.push({ id: uid(), text: f.text, done: false }),
    goalHabit: f => { const g = byId(S.goals, f.id); if (f.habit && !(g.habitIds ||= []).includes(f.habit)) g.habitIds.push(f.habit); },
  },
});
