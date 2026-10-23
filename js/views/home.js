// Home: what needs you today. Priorities first, then the day's schedule, a quick to-do list and habits.
import { S, ui, app, register, byId, remove, render as rerender } from '../core.js';
import { today, addDays, daysFromToday, esc, fmtDay, uid, pick } from '../util.js';
import { field, empty, chip, check } from '../ui.js';
import { getSources, hasCalendars, lastSync, syncAll } from '../calendar.js';
import { dayItems, pendingActions } from '../schedule.js';
import { habitsOn, habitDone, habitStreak, openTasks, dayStreak, byRank, doneToday, doneLast, uncompleteTask } from '../logic.js';

const when = ms => new Date(ms).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };

function nudges() {
  const out = [];
  // Overdue and due-soon tasks are no longer repeated here: the to-do list at the top already ranks them first.
  const triage = S.tasks.filter(t => t.triage).length;
  if (triage) out.push(`${triage} captured item${triage > 1 ? 's' : ''} to sort in Plan`);
  if (!S.meta.lastBackup || daysFromToday(S.meta.lastBackup) <= -30) out.push('Back up your data in Settings');
  app.nudgeSources.forEach(f => out.push(...f()));
  return out;
}

const MOTTOS = ['Small steps, big week.', 'One thing at a time.', 'Future you says thanks.', 'Start with the easy win.', 'Progress, not perfect.', 'Quick wins first, then the big one.', 'You have more time than you think.', 'Tick it, then breathe.', 'Do the next small thing.', 'Make today a little lighter.', 'Show up, the rest follows.', 'Be kind to tomorrow-you.', 'Tiny habits, big glow-up.', 'Finish one, feel the momentum.'];
const dueChip = t => { if (!t.due) return ''; const n = daysFromToday(t.due); return n < 0 ? chip('overdue', 'bad') : n === 0 ? chip('today', 'bad') : n === 1 ? chip('tomorrow', 'warn') : ''; };
const todoRow = x => x.derived
  ? `<li data-flip="t:${esc(x.id)}"><button data-act="openSource" data-view="${esc(x.view)}" data-section="${esc(x.section)}">Open</button><div class="grow"><span class="title">${esc(x.title)}</span><div class="muted">${esc(x.left || '')}${x.due ? ' · due ' + esc(fmtDay(x.due)) : ''}</div></div>${dueChip(x)}</li>`
  : `<li data-flip="t:${esc(x.id)}">${check('taskDone', x.id, false)}<div class="grow"><span class="title">${esc(x.title)}</span>${x.due ? `<div class="muted">due ${esc(fmtDay(x.due))}</div>` : ''}</div>${dueChip(x)}<button class="ghost danger" data-act="delTask" data-id="${esc(x.id)}" aria-label="Remove">×</button></li>`;
const doneRow = x => `<li class="done" data-flip="t:${esc(x.id)}">${check('taskUndo', x.id, true)}<div class="grow"><span class="title">${esc(x.title)}</span></div><button class="ghost danger" data-act="delTask" data-id="${esc(x.id)}" aria-label="Remove">×</button></li>`;
const SHOW = 8;

function render() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const t = today();
  const evs = dayItems(t);
  const soon = [1, 2, 3].map(i => [addDays(t, i), dayItems(addDays(t, i))]).filter(x => x[1].length);
  const syncedAt = lastSync();
  const nd = nudges();
  const acts = pendingActions(7);
  const briefMail = app.brief.source === 'sample' ? [] : (app.brief.inbox || []);
  const hs = habitsOn(t);
  const order = { morning: 0, anytime: 1, evening: 2 };
  const j = S.journal[t];
  const todos = openTasks().sort(byRank);
  const finished = doneToday();
  const habitsDone = hs.filter(x => habitDone(x, t)).length;
  const hasAttention = acts.length || briefMail.length || nd.length;
  const outstanding = acts.some(e => !e.done) || briefMail.length || nd.length;
  return `
  <section class="hero"><div class="hero-top"><p class="hero-date">${esc(fmtDay(t))}</p><button class="pill" data-nav="settings">Settings</button></div>
    <h1>${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</h1>
    <p class="hero-motto">${esc(pick(MOTTOS))}</p>
    <div class="hero-stats"><span class="stat"><b>${finished.length}</b>done today</span>${hs.length ? `<span class="stat"><b>${habitsDone}/${hs.length}</b>habits</span>` : ''}${dayStreak() ? `<span class="stat"><b>${dayStreak()}</b>day streak</span>` : ''}</div></section>
  <form data-form="quick" class="capture"><input name="text" placeholder="Capture a task or idea" aria-label="Quick capture" required><button class="primary">Add</button></form>

  <section class="card"><div class="row between"><h2 style="margin:0">To-do</h2>${todos.length ? chip(todos.length + ' left') : chip('all done', 'ok')}</div>
    <div style="margin-top:12px">${todos.length || finished.length ? `<ul class="list">${todos.slice(0, SHOW).map(todoRow).join('')}${finished.map(doneRow).join('')}</ul>${todos.length > SHOW ? `<div class="todo-more"><button class="ghost" data-nav="plan">+${todos.length - SHOW} more in Plan</button></div>` : ''}` : empty('Nothing to do. Enjoy it, or capture something above.')}</div>
    <details><summary>Add to the list</summary><form data-form="todo" class="capture inline-add"><input name="text" placeholder="Add something to do" aria-label="Add a to-do" maxlength="140" required><button class="primary">Add</button></form></details>
  </section>

  <section class="card ${outstanding ? 'alert' : ''}"><h2>Needs your attention</h2>
    ${hasAttention ? `<ul class="list">
      ${doneLast(acts, e => e.done).map(e => `<li data-flip="a:${esc(e.key)}" class="${e.done ? 'done' : e.dueToday ? 'due-today' : ''}">${check('actToggle', e.key, e.done)}<div class="grow"><span class="title">${esc(e.label)}</span><div class="muted">${e.mail ? esc(e.note || 'Important email') : esc(when(e.start)) + (e.cal ? ' · ' + esc(e.cal) : '')}</div></div>${e.done ? chip('Done', 'ok') : e.mail ? chip(esc(new Date(e.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), 'plain') : chip(e.dueToday ? 'Today' : esc(when(e.start)), e.dueToday ? 'bad' : 'warn')}</li>`).join('')}
      ${doneLast(briefMail, x => S.inboxDone[x.id]).map(x => `<li data-flip="m:${esc(x.id)}" class="${S.inboxDone[x.id] ? 'done' : ''}">${check('inbox', x.id, S.inboxDone[x.id])}<div class="grow"><span class="title">${esc(x.from)}: ${esc(x.subject)}</span><div class="muted">${esc(x.action)}</div></div>${x.due ? `<button class="ghost" data-act="inboxTask" data-id="${x.id}">Add to tasks</button>` : ''}</li>`).join('')}
      ${nd.map(n => `<li><span class="grow">${n}</span></li>`).join('')}</ul>` : empty('All clear. Nothing needs you right now.')}
  </section>

  ${app.todayCards.map(f => f()).join('')}

  <section class="card"><div class="row between"><h2 style="margin:0">Today's schedule</h2>${hasCalendars() ? `<button class="ghost" data-act="calSync" aria-label="Sync calendar now">Sync${syncedAt ? ' · ' + ago(syncedAt) : ''}</button>` : ''}</div>
    ${getSources().filter(s => s.error).map(s => `<p class="chip warn" style="display:block;margin-top:10px">${esc(s.name)}: ${esc(s.error)}</p>`).join('')}
    <div style="margin-top:12px">${evs.length ? `<ul class="list">${evs.map(e => `<li class="${e.past ? 'done' : ''}"><span class="chip">${esc(e.time)}</span><div class="grow"><span class="title">${esc(e.title)}</span>${e.interview ? ' ' + chip('Interview', 'warn') : ''}${e.src ? ' ' + chip(esc(e.src), 'plain') : ''}<div class="muted">${[e.until ? 'until ' + e.until : '', e.where].filter(Boolean).map(esc).join(' · ')}</div></div>${e.id ? `<button class="ghost danger" data-act="delEvent" data-id="${e.id}" aria-label="Remove">×</button>` : ''}</li>`).join('')}</ul>` : empty(hasCalendars() ? 'Nothing scheduled today.' : 'No events yet.')}</div>
    ${hasCalendars() ? '' : '<div class="row" style="margin-top:10px"><button data-nav="settings">Connect Google Calendar</button></div>'}
    ${soon.length ? `<details><summary>Next 3 days</summary>${soon.map(([k, list]) => `<h3>${fmtDay(k)}</h3><ul class="list">${list.map(e => `<li><span class="chip">${esc(e.time)}</span><div class="grow"><span class="title">${esc(e.title)}</span>${e.src ? ' ' + chip(esc(e.src), 'plain') : ''}${e.where ? `<div class="muted">${esc(e.where)}</div>` : ''}</div></li>`).join('')}</ul>`).join('')}</details>` : ''}
    <details><summary>Add an event</summary><form data-form="event" class="inline">${field('Title', 'title', 'required')}${field('Date', 'date', `type="date" required value="${t}"`)}${field('Time', 'time', 'type="time"')}<button class="primary">Add</button></form></details>
  </section>

  <section class="card"><div class="row between"><h2 style="margin:0">Habits ${chip(`${dayStreak()} day streak`, 'ok')}</h2><button class="ghost" data-go="track:trackers">Open Track</button></div>
    <div style="margin-top:12px">${hs.length ? `<ul class="list">${doneLast([...hs].sort((a, b) => order[a.when] - order[b.when]), x => habitDone(x, t)).map(x => `<li data-flip="h:${esc(x.id)}" class="${habitDone(x, t) ? 'done' : ''}">${check('habit', x.id, habitDone(x, t))}<span class="grow title">${esc(x.name)}</span>${chip(x.when, 'plain')}${habitStreak(x) > 1 ? chip(habitStreak(x) + 'd') : ''}</li>`).join('')}</ul>` : empty('No habits scheduled today.')}</div>
  </section>

  <section class="card"><h2>Close the day</h2>${j ? `<p>You reflected today. Mood ${j.mood || '-'}/5, energy ${j.energy || '-'}/5.</p>` : '<p class="muted">Two minutes: what went well, what to fix, and what to do tomorrow.</p>'}
    <div class="row" style="margin-top:10px"><button class="${j ? '' : 'primary'}" data-go="track:mind:journal">${j ? 'Edit reflection' : 'Reflect now'}</button></div></section>`;
}

register({
  id: 'home', label: 'Home', nav: 1, render,
  actions: {
    habit: d => { const l = (S.habitLog[today()] ||= {}); l[d.id] = !l[d.id]; },
    inbox: d => { S.inboxDone[d.id] = !S.inboxDone[d.id]; },
    actToggle: d => { S.inboxDone[d.id] = !S.inboxDone[d.id]; },
    taskUndo: d => uncompleteTask(d.id),
    delEvent: d => remove('events', d.id),
    calSync: () => { syncAll(true).then(() => rerender()); },
    learnTick: d => { const k = d.key || d.id; const l = (S.learnDone[today()] ||= {}); l[k] = !l[k]; },
    inboxTask: d => {
      const m = (app.brief.inbox || []).find(i => i.id === d.id); if (!m) return;
      const title = `${m.from}: ${m.subject}`;
      if (!S.tasks.some(t => t.title === title)) S.tasks.push({ id: uid(), title, due: m.due.slice(0, 10), important: true, done: false, kind: m.tag === 'Placement' ? 'Placement' : 'Task' });
    },
  },
  forms: {
    quick: f => S.tasks.push({ id: uid(), title: f.text.trim(), done: false, triage: true, kind: 'Task' }),
    todo: f => { const t = f.text.trim(); if (t) S.tasks.push({ id: uid(), title: t, done: false, important: true, kind: 'Task' }); },
    event: f => S.events.push({ id: uid(), title: f.title, date: f.date, time: f.time }),
  },
});
