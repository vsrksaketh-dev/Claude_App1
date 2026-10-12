import { S, ui, app, register, byId, remove, render as rerender } from '../core.js';
import { today, addDays, daysFromToday, esc, fmtDay, uid } from '../util.js';
import { field, empty, chip, bar, check } from '../ui.js';
import { DAILY_FIVE } from '../data.js';
import { calEventsOn, getSources, hasCalendars, lastSync, syncAll } from '../calendar.js';
import { habitsOn, habitDone, habitStreak, openTasks, completeTask, learnCount, learnStreak, dayStreak, dueCards, focusOn } from '../logic.js';

const clock = ms => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
// One list for the day: synced calendars, then the brief's events, then events typed in by hand.
function dayItems(k) {
  const fromCal = calEventsOn(k).map(e => ({ sort: e.allDay ? 0 : e.start, time: e.allDay ? 'All day' : clock(e.start), until: e.allDay ? '' : clock(e.end), title: e.title, where: e.where, src: e.cal, past: !e.allDay && e.end < Date.now() }));
  const local = [...(app.brief.events || []), ...S.events].filter(e => e.date === k).map(e => ({ sort: e.time ? new Date(k + 'T' + e.time).getTime() : 0, time: e.time || 'All day', title: e.title, where: e.where, id: e.id, interview: e.interview }));
  return [...fromCal, ...local].sort((a, b) => a.sort - b.sort);
}
const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
const mits = () => (S.mits[today()] ||= []);

function nudges() {
  const out = [];
  S.tasks.filter(t => !t.done && !t.triage && t.due && daysFromToday(t.due) <= 2).forEach(t => {
    const n = daysFromToday(t.due);
    out.push(`${esc(t.title)} ${n < 0 ? 'is overdue' : n === 0 ? 'is due today' : 'in ' + n + ' day(s)'}`);
  });
  const triage = S.tasks.filter(t => t.triage).length;
  if (triage) out.push(`${triage} captured item${triage > 1 ? 's' : ''} to sort in Plan`);
  const due = dueCards().length;
  if (due) out.push(`${due} flashcard${due > 1 ? 's' : ''} due for review`);
  if (!S.meta.lastBackup || daysFromToday(S.meta.lastBackup) <= -30) out.push('Back up your data (More, then Settings)');
  app.nudgeSources.forEach(f => out.push(...f()));
  return out;
}

function homeStats() {
  const hs = habitsOn(today()), hd = hs.filter(h => habitDone(h, today())).length;
  const m = mits(), md = m.filter(x => x.done).length;
  const tile = (n, l) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="tiles">${tile(`${hd}/${hs.length}`, 'Habits')}${tile(`${md}/${m.length}`, 'Top 3')}${tile(`${focusOn(today())}m`, 'Focus')}${tile(`${learnCount(today())}/5`, 'Learn')}</div>`;
}

function render() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const t = today();
  const evs = dayItems(t);
  const soon = [1, 2, 3].map(i => [addDays(t, i), dayItems(addDays(t, i))]).filter(x => x[1].length);
  const syncedAt = lastSync();
  const nd = nudges();
  const m = mits();
  const hs = habitsOn(t);
  const order = { morning: 0, anytime: 1, evening: 2 };
  const cats = ['International', 'Indian', 'Business', 'Tech'];
  const cat = ui.sub.newsCat || cats[0];
  const news = (app.news.items || []).filter(n => n.cat === cat);
  const stale = app.news.date && app.news.date !== t;
  const ld = S.learnDone[t] || {};
  const j = S.journal[t];
  const open = openTasks().filter(x => !x.derived && !m.some(y => y.taskId === x.id));
  return `
  <h1>${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</h1>
  <p class="muted">${fmtDay(t)}${app.brief.source === 'sample' ? ' · sample brief data' : ''}</p>
  ${homeStats()}
  <form data-form="quick" class="card row" style="flex-wrap:nowrap"><input name="text" class="grow" placeholder="Capture a task or idea" aria-label="Quick capture" required><button class="primary">Add</button></form>
  ${nd.length ? `<div class="card alert"><h2>Needs attention</h2><ul class="list">${nd.map(n => `<li>${n}</li>`).join('')}</ul></div>` : ''}
  ${app.todayCards.map(f => f()).join('')}
  <div class="card"><h2>Top 3 for today</h2>
    ${m.length ? `<ul class="list">${m.map(x => `<li class="${x.done ? 'done' : ''}">${check('mitDone', x.id, x.done)}<span class="grow title">${esc(x.text)}</span><button class="ghost danger" data-act="mitDel" data-id="${x.id}" aria-label="Remove">×</button></li>`).join('')}</ul>` : empty('Pick up to three things that would make today a win.')}
    ${m.length < 3 ? `<form data-form="mit" class="inline">${field('What must happen today?', 'text', 'maxlength="120"')}${open.length ? `<label>or pick a task<select name="task"><option value=""></option>${open.slice(0, 30).map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select></label>` : ''}<button class="primary">Add</button></form>` : ''}</div>
  <div class="card"><div class="row between"><h2 style="margin:0">Today's calendar</h2>${hasCalendars() ? `<button class="ghost" data-act="calSync" aria-label="Sync calendar now">Sync${syncedAt ? ' · ' + ago(syncedAt) : ''}</button>` : ''}</div>
    ${getSources().filter(s => s.error).map(s => `<p class="chip warn" style="display:block;margin-top:8px">${esc(s.name)}: ${esc(s.error)}</p>`).join('')}
    ${evs.length ? `<ul class="list">${evs.map(e => `<li class="${e.past ? 'done' : ''}"><span class="chip">${esc(e.time)}</span><div class="grow"><span class="title">${esc(e.title)}</span>${e.interview ? ' ' + chip('Interview', 'warn') : ''}${e.src ? ' ' + chip(esc(e.src), 'plain') : ''}<div class="muted">${[e.until ? 'until ' + e.until : '', e.where].filter(Boolean).map(esc).join(' · ')}</div></div>${e.id ? `<button class="ghost danger" data-act="delEvent" data-id="${e.id}" aria-label="Remove">×</button>` : ''}</li>`).join('')}</ul>` : empty(hasCalendars() ? 'No events scheduled for today.' : 'No events yet.')}
    ${hasCalendars() ? '' : '<button data-nav="more" data-sub="settings">Connect Google Calendar</button>'}
    ${soon.length ? `<details><summary>Next 3 days</summary>${soon.map(([k, list]) => `<h3>${fmtDay(k)}</h3><ul class="list">${list.map(e => `<li><span class="chip">${esc(e.time)}</span><div class="grow"><span class="title">${esc(e.title)}</span>${e.src ? ' ' + chip(esc(e.src), 'plain') : ''}${e.where ? `<div class="muted">${esc(e.where)}</div>` : ''}</div></li>`).join('')}</ul>`).join('')}</details>` : ''}
    <details><summary>Add event</summary><form data-form="event" class="inline">${field('Title', 'title', 'required')}${field('Date', 'date', `type="date" required value="${t}"`)}${field('Time', 'time', 'type="time"')}<button class="primary">Add</button></form></details></div>
  <div class="card"><h2>Habits ${chip(`${dayStreak()} day streak`, 'ok')}</h2>
    ${hs.length ? `<ul class="list">${[...hs].sort((a, b) => order[a.when] - order[b.when]).map(x => `<li class="${habitDone(x, t) ? 'done' : ''}">${check('habit', x.id, habitDone(x, t))}<span class="grow title">${esc(x.name)}</span>${chip(x.when, 'plain')}${habitStreak(x) > 1 ? chip(habitStreak(x) + 'd') : ''}</li>`).join('')}</ul>` : empty('No habits scheduled today.')}
    <button class="ghost" data-nav="growth" data-sub="habits">Manage habits</button></div>
  ${(app.brief.inbox || []).length ? `<div class="card"><h2>Important email and actions</h2><ul class="list">${app.brief.inbox.map(x => `<li class="${S.inboxDone[x.id] ? 'done' : ''}">${check('inbox', x.id, S.inboxDone[x.id])}<div class="grow"><span class="title">${esc(x.from)}: ${esc(x.subject)}</span> ${x.tag ? chip(esc(x.tag)) : ''}<div class="muted">Action: ${esc(x.action)}</div>${x.due ? `<div class="row">${chip('due ' + esc(new Date(x.due).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })), 'warn')}<button class="ghost" data-act="inboxTask" data-id="${x.id}">+ Add to tasks</button></div>` : ''}</div></li>`).join('')}</ul></div>` : ''}
  <div class="card"><h2>News ${app.news.date ? chip(stale ? 'last updated ' + fmtDay(app.news.date) : 'today', stale ? 'warn' : 'ok') : ''}</h2>
    <div class="tabs">${cats.map(c => `<button class="${cat === c ? 'on' : ''}" data-act="newsCat" data-id="${c}">${c}</button>`).join('')}</div>
    ${(app.news.items || []).length ? '' : empty('News is unavailable right now. It refreshes every morning.')}
    ${news.length ? `<ul class="list">${news.map(n => `<li><div class="grow"><span class="title">${n.kind === 'fact' ? 'Fact: ' : ''}${esc(n.title)}</span><p>${esc(n.summary)}</p><p class="muted"><b>Why it matters:</b> ${esc(n.why)} · ${esc(n.src)}</p></div></li>`).join('')}</ul>` : (app.news.items || []).length ? empty('No stories in this category.') : ''}
    <label class="check"><input type="checkbox" data-act="learnTick" data-key="news" ${ld.news ? 'checked' : ''}> I read today's news</label></div>
  <div class="card"><h2>Daily five ${chip(`${learnStreak()} day streak`, 'ok')}</h2>
    ${bar(learnCount(t) * 20)}
    <ul class="list">${DAILY_FIVE.map(([k, l]) => `<li class="${ld[k] ? 'done' : ''}">${check('learnTick', k, ld[k], `data-key="${k}"`)}<span class="grow title">${l}</span></li>`).join('')}</ul>
    <button data-nav="learn">Open Learn</button></div>
  <div class="card ${j || h < 18 ? '' : 'alert'}"><h2>Close the day</h2>${j ? `<p>Reflected today. Mood ${j.mood || '–'}/5, energy ${j.energy || '–'}/5.</p>` : '<p class="muted">Two minutes: what went well, what to fix, and tomorrow\'s top three.</p>'}<button data-nav="growth" data-sub="journal">${j ? 'Edit reflection' : 'Reflect now'}</button></div>`;
}

register({
  id: 'today', label: 'Today', render,
  actions: {
    newsCat: d => { ui.sub.newsCat = d.id; },
    habit: d => { const l = (S.habitLog[today()] ||= {}); l[d.id] = !l[d.id]; },
    inbox: d => { S.inboxDone[d.id] = !S.inboxDone[d.id]; },
    mitDone: d => {
      const x = byId(mits(), d.id); x.done = !x.done;
      if (x.done && x.taskId) completeTask(x.taskId);
    },
    mitDel: d => { S.mits[today()] = mits().filter(x => x.id !== d.id); },
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
    mit: f => {
      const m = mits(); if (m.length >= 3) return;
      const t = f.task ? S.tasks.find(x => x.id === f.task) : null;
      const text = t ? t.title : (f.text || '').trim();
      if (text) m.push({ id: uid(), text, done: false, taskId: t ? t.id : null });
    },
    event: f => S.events.push({ id: uid(), title: f.title, date: f.date, time: f.time }),
  },
});
