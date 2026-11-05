// Home: what needs you today. The to-do list first, then anything waiting on you, today's schedule and a one-line habit strip.
import { S, ui, app, register, remove, render as rerender } from '../core.js';
import { today, addDays, daysFromToday, esc, fmtDay, uid, pick, countdownText, clock12 } from '../util.js';
import { empty, chip, check, me, linkBtns } from '../ui.js';
import { getSources, hasCalendars, lastSync, syncAll } from '../calendar.js';
import { dayItems, pendingActions } from '../schedule.js';
import { habitsOn, habitDone, tapHabit, habitLabel, habitTarget, setHabit, openTasks, dayStreak, byRank, doneToday, doneLast, uncompleteTask, dayProgress, practiceStreak } from '../logic.js';
import { weekRecap, isRecapDay } from '../recap.js';

const when = ms => new Date(ms).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };

function nudges() {
  const out = [];
  const lastSafe = S.meta.lastBackup || S.meta.since || today();
  if (daysFromToday(lastSafe) <= (S.meta.lastBackup ? -30 : -14)) out.push('Back up your data in Settings');
  app.nudgeSources.forEach(f => out.push(...f()));
  return out;
}

const MOTTOS = ['Small steps, big week.', 'One thing at a time.', 'Future you says thanks.', 'Start with the easy win.', 'Progress, not perfect.', 'Quick wins first, then the big one.', 'You have more time than you think.', 'Tick it, then breathe.', 'Do the next small thing.', 'Make today a little lighter.', 'Show up, the rest follows.', 'Be kind to tomorrow-you.', 'Finish one, feel the momentum.'];
const dueChip = t => { if (!t.due) return ''; const n = daysFromToday(t.due); return n < 0 ? chip('overdue', 'bad') : n === 0 ? chip('today', 'bad') : n === 1 ? chip('tomorrow', 'warn') : ''; };
const todoRow = x => x.derived
  ? `<li data-flip="t:${esc(x.id)}"><div class="grow"><span class="title">${esc(x.title)}</span><div class="meta">${dueChip(x)}<span class="muted">${esc(x.left || '')}${x.due ? ' due ' + esc(fmtDay(x.due)) : ''}</span></div></div></li>`
  : `<li data-flip="t:${esc(x.id)}">${check('taskDone', x.id, false)}<div class="grow"><span class="title">${esc(x.title)}</span>${x.due ? `<div class="meta">${dueChip(x)}<span class="muted">${esc(fmtDay(x.due))}</span></div>` : ''}</div><button class="ghost danger x" data-act="delTask" data-id="${esc(x.id)}" aria-label="Remove">×</button></li>`;
const doneRow = x => `<li class="done" data-flip="t:${esc(x.id)}">${check('taskUndo', x.id, true)}<div class="grow"><span class="title">${esc(x.title)}</span></div><button class="ghost danger x" data-act="delTask" data-id="${esc(x.id)}" aria-label="Remove">×</button></li>`;

// The line under the greeting reacts to how the day is going; it only falls back to a motto when there is nothing to say.
function heroLine(prog) {
  const t = today();
  if (prog.due === 0 && prog.done > 0) return 'Everything due today is done. Nice work.';
  if (openTasks().some(x => x.due && x.due < t)) return 'Start with the overdue one. The rest gets easier.';
  if (prog.done > 0) return `${prog.done} done, ${prog.due} to go.`;
  return pick(MOTTOS);
}
// One badge in the hero: the countdown to a start date if one is set, otherwise a streak.
function badge() {
  const j = S.profile.joining;
  if (j && /^\d{4}-\d{2}-\d{2}$/.test(j)) {
    const n = daysFromToday(j);
    if (n === 0) return `<span class="stat"><b>Day one</b>is today</span>`;
    if (n > 0) return `<span class="stat"><b>${n}</b>day${n === 1 ? '' : 's'} to ${esc(S.profile.company || 'day one')}</span>`;
  }
  if (practiceStreak() > 1) return `<span class="stat"><b>${practiceStreak()}</b>day practice streak</span>`;
  if (dayStreak() > 1) return `<span class="stat"><b>${dayStreak()}</b>day streak</span>`;
  return '';
}
const ring = p => { const C = 2 * Math.PI * 18; return `<div class="ring" role="img" aria-label="${p.done} of ${p.total} finished today"><svg viewBox="0 0 44 44"><circle class="rt" cx="22" cy="22" r="18"/><circle class="rv" cx="22" cy="22" r="18" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${((1 - (p.total ? p.pct : 1)) * C).toFixed(1)}"/></svg><b>${p.total ? `${p.done}/${p.total}` : 'Clear'}</b></div>`; };
function nextUp(t) {
  const now = Date.now();
  let n = dayItems(t).find(e => !e.allDay && e.end > now), later = false;
  if (!n) { n = dayItems(addDays(t, 1)).find(e => !e.allDay); later = !!n; }
  if (!n) return '';
  const live = n.start <= now;
  return `<section class="next"><div class="grow"><p class="eyebrow">${live ? 'Happening now' : later ? 'Tomorrow' : 'Next up'}</p><p class="title">${esc(n.title)}</p><p class="muted">${esc(clock12(n.start))}${n.where ? ' · ' + esc(n.where) : ''}</p></div><span class="count" data-countdown="${n.start}">${live ? 'now' : countdownText(n.start)}</span>${linkBtns(n.links)}</section>`;
}
function recapCard() {
  if (!isRecapDay()) return '';
  const r = weekRecap();
  if (!r.tasks && !r.sessions && !r.practice) return '';
  const cell = (n, l) => `<div><b>${n}</b><span>${l}</span></div>`;
  return `<section class="card recap"><h2>Your week</h2><div class="recap-grid">${cell(r.tasks, 'tasks done')}${cell(r.sessions, 'sessions')}${cell(r.practice, 'practice days')}${r.habitDays ? cell(r.habitDays, 'habit check-ins') : ''}${cell(r.ahead, 'due this week')}</div>${r.bestDay ? `<p class="muted">Best day: ${esc(r.bestDay)}, ${r.bestN} done.</p>` : ''}</section>`;
}

const SHOW = 6;
// One habit as a chip: a tick for plain habits, a tap-to-count button for counters, with "2/5" for weekly goals.
const habitChip = x => {
  const t = today(), d = habitDone(x, t), lab = habitLabel(x, t);
  return habitTarget(x) > 1
    ? `<button class="habit-chip count ${d ? 'done' : ''}" data-flip="h:${esc(x.id)}" data-act="habit" data-id="${esc(x.id)}"><span>${esc(x.name)}</span><i>${lab}</i></button>`
    : `<label class="habit-chip ${d ? 'done' : ''}" data-flip="h:${esc(x.id)}">${check('habit', x.id, d)}<span>${esc(x.name)}</span>${lab ? `<i>${lab}</i>` : ''}</label>`;
};
// Right after finishing a habit that keeps a type (Gym: Push, Pull, Legs...), one tap records what it was.
const tagAsk = () => {
  const h = ui.tagAsk && S.habits.find(x => x.id === ui.tagAsk);
  if (!h || !(h.options || []).length || !habitDone(h, today())) return '';
  return `<div class="tag-ask"><span class="muted">${esc(h.name)}: what was it?</span>${h.options.map(o => `<button class="pill" data-act="habitTag" data-id="${esc(h.id)}" data-tag="${esc(o)}">${esc(o)}</button>`).join('')}<button class="ghost" data-act="habitTag" data-id="${esc(h.id)}" data-tag="">Skip</button></div>`;
};

function render() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const t = today();
  const evs = dayItems(t);
  const tomorrow = dayItems(addDays(t, 1));
  const syncedAt = lastSync();
  const nd = nudges();
  const acts = pendingActions(7);
  const briefMail = app.brief.source === 'sample' ? [] : (app.brief.inbox || []);
  const hs = habitsOn(t);
  const todos = openTasks().sort(byRank);
  const finished = doneToday();
  const prog = dayProgress();
  const habitsDone = hs.filter(x => habitDone(x, t)).length;
  const hasAttention = acts.length || briefMail.length || nd.length;
  const outstanding = acts.some(e => !e.done) || briefMail.length || nd.length;
  return `
  <section class="hero">${ring(prog)}<div class="hero-top"><p class="hero-date">${esc(fmtDay(t))}</p>${me()}</div>
    <h1>${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</h1>
    <p class="hero-motto">${esc(heroLine(prog))}</p>
    <div class="hero-stats"><span class="stat"><b>${todos.length}</b>to do</span><span class="stat"><b>${finished.length}</b>done today</span>${evs.length ? `<span class="stat"><b>${evs.length}</b>on today</span>` : ''}${badge()}</div></section>
  ${nextUp(t)}
  <form data-form="quick" data-keep class="capture"><input name="text" placeholder="Add a task" aria-label="Add a task" maxlength="140" required><button class="primary">Add</button></form>

  <section class="card"><div class="row between"><h2 style="margin:0">To do</h2>${todos.length ? chip(todos.length + ' left') : chip('all done', 'ok')}</div>
    <div style="margin-top:12px">${todos.length || finished.length ? `<ul class="list">${todos.slice(0, SHOW).map(todoRow).join('')}${finished.map(doneRow).join('')}</ul>${todos.length > SHOW ? `<div class="todo-more"><button class="ghost" data-nav="tasks">+${todos.length - SHOW} more in Tasks</button></div>` : ''}` : empty('Nothing to do. Add something above, or enjoy it.')}</div>
  </section>

  ${recapCard()}

  ${hasAttention ? `<section class="card ${outstanding ? 'alert' : ''}"><h2>Needs your attention</h2><ul class="list">
      ${doneLast(acts, e => e.done).map(e => `<li data-flip="a:${esc(e.key)}" class="${e.done ? 'done' : e.dueToday ? 'due-today' : ''}">${check('actToggle', e.key, e.done)}<div class="grow"><span class="title">${esc(e.label)}</span><div class="muted">${e.mail ? esc(e.note || 'Important email') : esc(when(e.start)) + (e.cal ? ' · ' + esc(e.cal) : '')}</div></div>${linkBtns(e.links)}${e.done ? chip('Done', 'ok') : e.mail ? chip(esc(new Date(e.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), 'plain') : chip(e.dueToday ? 'Today' : esc(when(e.start)), e.dueToday ? 'bad' : 'warn')}</li>`).join('')}
      ${doneLast(briefMail, x => S.inboxDone[x.id]).map(x => `<li data-flip="m:${esc(x.id)}" class="${S.inboxDone[x.id] ? 'done' : ''}">${check('inbox', x.id, S.inboxDone[x.id])}<div class="grow"><span class="title">${esc(x.from)}: ${esc(x.subject)}</span><div class="muted">${esc(x.action)}</div></div>${x.due ? `<button class="ghost" data-act="inboxTask" data-id="${x.id}">Add to tasks</button>` : ''}</li>`).join('')}
      ${nd.map(n => `<li><span class="grow">${n}</span></li>`).join('')}</ul></section>` : ''}

  <section class="card"><div class="row between"><h2 style="margin:0">Today's schedule</h2>${hasCalendars() ? `<button class="ghost" data-act="calSync" aria-label="Sync calendar now">Sync${syncedAt ? ' · ' + ago(syncedAt) : ''}</button>` : ''}</div>
    ${getSources().filter(s => s.error).map(s => `<p class="chip warn" style="display:block;margin-top:10px">${esc(s.name)}: ${esc(s.error)}</p>`).join('')}
    <div style="margin-top:12px">${evs.length ? `<ul class="list">${evs.map(e => `<li class="${e.past ? 'done' : ''}"><span class="chip">${esc(e.time)}</span><div class="grow"><span class="title">${esc(e.title)}</span>${e.interview ? ' ' + chip('Interview', 'warn') : ''}${e.src ? ' ' + chip(esc(e.src), 'plain') : ''}<div class="muted">${[e.until ? 'until ' + e.until : '', e.where].filter(Boolean).map(esc).join(' · ')}</div></div>${linkBtns(e.links)}${e.id ? `<button class="ghost danger" data-act="delEvent" data-id="${e.id}" aria-label="Remove">×</button>` : ''}</li>`).join('')}</ul>` : empty(hasCalendars() ? 'Nothing scheduled today.' : 'No events yet.')}</div>
    <div class="row between" style="margin-top:10px">${hasCalendars() ? `<span class="muted">${tomorrow.length ? `Tomorrow: ${tomorrow.length} item${tomorrow.length > 1 ? 's' : ''}` : 'Tomorrow is clear'}</span>` : '<button data-nav="settings">Connect Google Calendar</button>'}<button class="ghost" data-nav="calendar">Open calendar</button></div>
  </section>

  ${S.habits.some(x => !x.archived) ? `<section class="card"><div class="row between"><h2 style="margin:0">Habits</h2><span class="row" style="gap:6px">${hs.length ? chip(`${habitsDone}/${hs.length} today`, habitsDone === hs.length ? 'ok' : 'plain') : chip('all caught up', 'ok')}<button class="ghost" data-nav="routine">Routine</button></span></div>
    ${hs.length ? `<div class="habit-row" style="margin-top:12px">${doneLast(hs, x => habitDone(x, t)).map(habitChip).join('')}</div>` : ''}${tagAsk()}</section>` : ''}`;
}

register({
  id: 'home', label: 'Home', nav: 1, render,
  actions: {
    habit: d => { const h = S.habits.find(x => x.id === d.id); if (!h) return; const done = tapHabit(h, today()); ui.tagAsk = done && (h.options || []).length ? h.id : null; },
    habitTag: d => { const h = S.habits.find(x => x.id === d.id); if (h && d.tag) setHabit(h, today(), habitTarget(h), d.tag); ui.tagAsk = null; },
    inbox: d => { S.inboxDone[d.id] = !S.inboxDone[d.id]; },
    actToggle: d => { S.inboxDone[d.id] = !S.inboxDone[d.id]; },
    taskUndo: d => uncompleteTask(d.id),
    delEvent: d => remove('events', d.id),
    calSync: () => { syncAll(true).then(() => rerender()); },
    inboxTask: d => {
      const m = (app.brief.inbox || []).find(i => i.id === d.id); if (!m) return;
      const title = `${m.from}: ${m.subject}`;
      if (!S.tasks.some(t => t.title === title)) S.tasks.push({ id: uid(), title, due: m.due.slice(0, 10), important: true, done: false, kind: m.tag === 'Placement' ? 'Placement' : 'Task' });
    },
  },
  forms: {
    quick: f => { const t = (f.text || '').trim(); if (t) S.tasks.push({ id: uid(), title: t, due: '', important: false, done: false, kind: 'Task' }); },
    event: f => S.events.push({ id: uid(), title: f.title, date: f.date, time: f.time, mins: Number(f.mins) || 60, where: f.where || '', link: (f.link || '').trim() }),
  },
});
