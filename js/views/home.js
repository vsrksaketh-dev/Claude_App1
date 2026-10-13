// Home: what needs you today. Priorities first, then the day's schedule, a quick to-do list and habits.
import { S, ui, app, register, byId, remove, render as rerender } from '../core.js';
import { today, addDays, daysFromToday, esc, fmtDay, uid } from '../util.js';
import { field, empty, chip, check, head } from '../ui.js';
import { getSources, hasCalendars, lastSync, syncAll } from '../calendar.js';
import { dayItems, pendingActions } from '../schedule.js';
import { habitsOn, habitDone, habitStreak, openTasks, dayStreak } from '../logic.js';

const when = ms => new Date(ms).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };

function nudges() {
  const out = [];
  S.tasks.filter(t => !t.done && !t.triage && t.due && daysFromToday(t.due) <= 2).forEach(t => {
    const n = daysFromToday(t.due);
    out.push(`${esc(t.title)} ${n < 0 ? 'is overdue' : n === 0 ? 'is due today' : 'is due in ' + n + ' day(s)'}`);
  });
  const triage = S.tasks.filter(t => t.triage).length;
  if (triage) out.push(`${triage} captured item${triage > 1 ? 's' : ''} to sort in Plan`);
  if (!S.meta.lastBackup || daysFromToday(S.meta.lastBackup) <= -30) out.push('Back up your data in Settings');
  app.nudgeSources.forEach(f => out.push(...f()));
  return out;
}

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
  const todos = openTasks().filter(x => !x.derived).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const hasAttention = acts.length || briefMail.length || nd.length;
  const outstanding = acts.some(e => !e.done) || briefMail.length || nd.length;
  return `
  ${head(`${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}`, fmtDay(t), '<button class="pill" data-nav="settings">Settings</button>')}
  <form data-form="quick" class="capture"><input name="text" placeholder="Capture a task or idea" aria-label="Quick capture" required><button class="primary">Add</button></form>

  <section class="card ${outstanding ? 'alert' : ''}"><h2>Needs your attention</h2>
    ${hasAttention ? `<ul class="list">
      ${acts.map(e => `<li class="${e.done ? 'done' : e.dueToday ? 'due-today' : ''}">${check('actToggle', e.key, e.done)}<div class="grow"><span class="title">${esc(e.label)}</span><div class="muted">${e.mail ? esc(e.note || 'Important email') : esc(when(e.start)) + (e.cal ? ' · ' + esc(e.cal) : '')}</div></div>${e.done ? chip('Done', 'ok') : e.mail ? chip(esc(new Date(e.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), 'plain') : chip(e.dueToday ? 'Today' : esc(when(e.start)), e.dueToday ? 'bad' : 'warn')}</li>`).join('')}
      ${briefMail.map(x => `<li class="${S.inboxDone[x.id] ? 'done' : ''}">${check('inbox', x.id, S.inboxDone[x.id])}<div class="grow"><span class="title">${esc(x.from)}: ${esc(x.subject)}</span><div class="muted">${esc(x.action)}</div></div>${x.due ? `<button class="ghost" data-act="inboxTask" data-id="${x.id}">Add to tasks</button>` : ''}</li>`).join('')}
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

  <section class="card"><h2>To-do</h2>
    <form data-form="todo" class="capture inline-add"><input name="text" placeholder="Add something to do" aria-label="Add a to-do" maxlength="140" required><button class="primary">Add</button></form>
    <div style="margin-top:12px">${todos.length ? `<ul class="list">${todos.slice(0, 10).map(x => `<li>${check('taskDone', x.id, false)}<div class="grow"><span class="title">${esc(x.title)}</span>${x.due ? `<div class="muted">due ${esc(fmtDay(x.due))}</div>` : ''}</div><button class="ghost danger" data-act="delTask" data-id="${x.id}" aria-label="Remove">×</button></li>`).join('')}</ul>${todos.length > 10 ? `<p class="muted" style="margin-top:10px">${todos.length - 10} more in Plan</p>` : ''}` : empty('Nothing on your list.')}</div>
  </section>

  <section class="card"><div class="row between"><h2 style="margin:0">Habits ${chip(`${dayStreak()} day streak`, 'ok')}</h2><button class="ghost" data-go="track:trackers">Open Track</button></div>
    <div style="margin-top:12px">${hs.length ? `<ul class="list">${[...hs].sort((a, b) => order[a.when] - order[b.when]).map(x => `<li class="${habitDone(x, t) ? 'done' : ''}">${check('habit', x.id, habitDone(x, t))}<span class="grow title">${esc(x.name)}</span>${chip(x.when, 'plain')}${habitStreak(x) > 1 ? chip(habitStreak(x) + 'd') : ''}</li>`).join('')}</ul>` : empty('No habits scheduled today.')}</div>
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
