// Home: today, as one timeline. A large plain date, a quick-add box that understands plain words, then the day on a time rail:
// classes in their course colours, timed tasks, deadlines, the now line and free gaps you can fill with a task. Below it: anytime
// tasks, what is waiting from your inbox, and the habits as a row of dots. Banners appear only when they matter (exams close,
// the weekly review on Sunday and Monday).
import { S, ui, app, register, remove, render as rerender } from '../core.js';
import { today, addDays, daysFromToday, esc, fmtDay, uid } from '../util.js';
import { empty, check, me, linkBtns, toast } from '../ui.js';
import { icon } from '../icons.js';
import { hasCalendars, getSources, syncAll, lastSync } from '../calendar.js';
import { agendaOn } from '../agenda.js';
import { pendingActions } from '../schedule.js';
import { habitsOn, habitDone, tapHabit, habitLabel, habitTarget, habitGoal, setHabit, openTasks, byRank, doneToday, uncompleteTask } from '../logic.js';
import { parseQuick } from '../nlp.js';
import { taskRow, doneRow, clock } from '../taskui.js';
import { colorFor, isClass } from '../colors.js';
import { attendBtns } from './academics.js';
import { upcomingExams, examDays, dailyTarget } from '../study.js';
import { reviewDue, weekTop } from './review.js';

const hm = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const hhmm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 >= 5 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
const at = (k, h) => new Date(k + 'T' + String(h).padStart(2, '0') + ':00').getTime();
const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };

function nudges() {
  const out = [];
  const lastSafe = S.meta.lastBackup || S.meta.since || today();
  if (daysFromToday(lastSafe) <= (S.meta.lastBackup ? -30 : -14)) out.push('Back up your data in Settings');
  app.nudgeSources.forEach(f => out.push(...f()));
  return out;
}

// ---- the timeline ----
function tlRow(e) {
  const now = Date.now(), past = !e.allDay && e.end <= now, task = e.kind === 'task';
  const tick = task ? check(e.done ? 'taskUndo' : 'taskDone', e.id, e.done) : e.key ? check('actToggle', e.key, e.done) : '';
  const time = e.allDay ? 'All day' : hm(e.start);
  const end = !e.allDay && e.kind === 'event' && e.end > e.start ? `<small>${hm(e.end)}</small>` : '';
  const meta = [e.kind === 'due' ? (e.exam ? 'Exam' : 'Deadline') : e.kind === 'action' ? 'To do' : task ? 'Task' : '', e.where, !isClass(e) ? e.src : '', e.desc && e.desc.length < 90 ? e.desc : ''].filter(Boolean).join(' · ');
  const menu = task ? `task:${esc(e.id)}` : `ev:${e.start}`;
  const titleAttrs = task ? `data-act="taskEditOpen" data-id="${esc(e.id)}"` : `data-go="calendar:day:${today()}"`;
  return `<div class="tl-row ${tick ? 'has-tick' : ''} ${past ? 'past' : ''} ${e.done ? 'done' : ''}" style="--c:${colorFor(e)}" data-menu="${menu}" data-flip="tl:${esc(e.id || e.key || e.title)}:${e.start}">
    <time>${time}${end}</time><span class="bar"></span>${tick}<div class="body"><b ${titleAttrs}>${esc(e.title)}</b>${meta ? `<small>${esc(meta)}</small>` : ''}${isClass(e) && past ? attendBtns(e) : ''}</div>
    <div class="side">${linkBtns(e.links)}</div></div>`;
}
function timeline(k) {
  const items = agendaOn(k).filter(e => e.kind !== 'mail' && !(e.kind === 'task' && e.allDay));
  const allDay = items.filter(e => e.allDay), timed = items.filter(e => !e.allDay).sort((a, b) => a.start - b.start);
  const now = Date.now(), dayStart = at(k, 8), dayEnd = at(k, 22);
  const out = allDay.map(tlRow);
  let cursor = Math.max(now, dayStart), nowShown = false;
  const nowLine = () => `<div class="tl-now" aria-label="Now"><span>${hm(now)}</span><i></i></div>`;
  const gap = (a, b) => { const m = Math.round((b - a) / 6e4); return `<div class="tl-gap"><span></span><div class="gp"><span><b>Free ${dur(m)}</b> · ${hm(a)} to ${hm(b)}</span><button class="ghost" data-act="gapPlan" data-t="${hhmm(a)}">${icon('plus', 15)} Plan</button></div></div>`; };
  timed.forEach(e => {
    if (!nowShown && e.start > now && now >= dayStart - 36e5 && now < dayEnd) { out.push(nowLine()); nowShown = true; }
    if (e.start - cursor >= 45 * 6e4 && cursor < dayEnd) out.push(gap(cursor, Math.min(e.start, dayEnd)));
    out.push(tlRow(e));
    if (e.end > cursor) cursor = e.end;
  });
  if (!nowShown && now < dayEnd && now > dayStart - 36e5) out.push(nowLine());
  if (dayEnd - cursor >= 60 * 6e4) out.push(gap(cursor, dayEnd));
  return out.join('');
}

function render() {
  const t = today(), d = new Date();
  const items = agendaOn(t);
  const classes = items.filter(isClass).length, deadlines = items.filter(e => e.kind === 'due' && !e.done).length;
  const open = openTasks().sort(byRank), finished = doneToday();
  const dueNow = open.filter(x => x.due && x.due <= t);
  const anytime = open.filter(x => !x.time && (!x.due || x.due <= t));
  const late = open.filter(x => x.due && x.due < t).length;
  const hs = habitsOn(t), top = weekTop().filter(x => !x.done);
  const acts = pendingActions(7).filter(e => e.mail || !e.dueToday);
  const nd = nudges();
  const ex = upcomingExams(), exSoon = ex.filter(x => examDays(x) <= 21), tgt = dailyTarget();
  const tomorrow = agendaOn(addDays(t, 1)).filter(e => e.kind !== 'mail' && !(e.kind === 'task' && e.allDay)).sort((a, b) => a.allDay - b.allDay || a.start - b.start);
  const firstTom = tomorrow.find(e => !e.allDay);
  const summary = [classes ? `${classes} class${classes === 1 ? '' : 'es'}` : '', dueNow.length ? `${dueNow.length} task${dueNow.length === 1 ? '' : 's'} due` : '', deadlines ? `${deadlines} deadline${deadlines === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'A clear day';
  const errs = getSources().filter(s => s.error);
  const j = S.profile.joining, jn = j && /^\d{4}-\d{2}-\d{2}$/.test(j) ? daysFromToday(j) : -1;
  const countdown = jn > 0 ? ` · ${jn} days to ${esc(S.profile.company || 'day one')}` : jn === 0 ? ` · ${esc(S.profile.company || 'Day one')} starts today` : '';
  return `
  <header class="top today-head"><div><p class="eyebrow">${d.toLocaleDateString('en-IN', { weekday: 'long' })}</p><h1>${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</h1><p class="sub">${esc(summary)}${late ? ` · <span class="late">${late} overdue</span>` : ''}${countdown}</p></div><div class="top-r">${me()}</div></header>
  ${reviewDue() ? `<button class="banner" data-nav="review">${icon('spark', 20)}<span class="grow"><b>Your weekly review</b><span class="muted"> · five minutes: tidy what is open, pick next week's three</span></span>${icon('chevron', 18)}</button>` : ''}
  ${exSoon.length ? `<button class="banner ${examDays(exSoon[0]) <= 3 ? 'bad' : ''}" data-nav="academics">${icon('school', 20)}<span class="grow"><b>${esc(exSoon[0].subject)} in ${examDays(exSoon[0]) === 0 ? 'today' : examDays(exSoon[0]) + ' day' + (examDays(exSoon[0]) === 1 ? '' : 's')}</b><span class="muted">${tgt.left ? ` · revise ${tgt.perDay} topic${tgt.perDay === 1 ? '' : 's'} today` : ` · ${exSoon.length} paper${exSoon.length === 1 ? '' : 's'} ahead`}</span></span>${icon('chevron', 18)}</button>` : ''}
  <form data-form="quick" data-keep class="capture">${icon('plus', 18)}<input name="text" placeholder="Add a task, try: Submit DHRM fri 5pm !" aria-label="Add a task" maxlength="160" required data-bind="nlp" autocomplete="off"><em class="parsed" hidden></em><button class="primary">Add</button></form>
  ${errs.map(s => `<p class="chip warn" style="display:block">${esc(s.name)}: ${esc(s.error)}</p>`).join('')}

  <section class="card"><div class="sec-h"><h2>Today</h2>${hasCalendars() ? `<button class="ghost" data-act="calSync">Synced ${lastSync() ? ago(lastSync()) : 'never'}</button>` : '<button class="ghost" data-nav="settings">Connect calendar</button>'}</div>
    <div class="tl">${timeline(t) || ''}</div>
    ${firstTom || tomorrow.length ? `<p class="muted tomorrow">Tomorrow: ${tomorrow.length} item${tomorrow.length === 1 ? '' : 's'}${firstTom ? `, first ${esc(firstTom.title)} at ${hm(firstTom.start)}` : ''}</p>` : '<p class="muted tomorrow">Tomorrow is clear.</p>'}</section>

  ${top.length ? `<section class="card"><h2>This week's three</h2><ul class="list">${top.map(x => taskRow(x)).join('')}</ul></section>` : ''}

  <section class="card"><div class="sec-h"><h2>Anytime ${anytime.length ? `<span class="cnt">${anytime.length}</span>` : ''}</h2><button class="ghost" data-nav="tasks">All tasks</button></div>
    ${anytime.length || finished.length ? `<ul class="list">${anytime.slice(0, 7).map(x => taskRow(x, { when: x.due && x.due < t })).join('')}${finished.map(doneRow).join('')}</ul>${anytime.length > 7 ? `<button class="ghost" data-nav="tasks">${anytime.length - 7} more in Tasks</button>` : ''}` : empty('Nothing waiting. Add a task above in plain words.')}</section>

  ${acts.length || nd.length ? `<section class="card"><h2>Coming up and from your inbox</h2><ul class="list">
    ${acts.map(e => `<li class="${e.done ? 'done' : ''}" data-flip="a:${esc(e.key)}">${check('actToggle', e.key, e.done)}<div class="grow"><span class="title">${esc(e.label)}</span><div class="muted">${e.mail ? esc(e.note || 'Important email') : esc(fmtDay(new Date(e.start).toLocaleDateString('en-CA'))) + (e.allDay ? '' : ' · ' + esc(hm(e.start)))}</div></div>${linkBtns(e.links)}</li>`).join('')}
    ${nd.map(n => `<li><span class="grow muted">${n}</span></li>`).join('')}</ul></section>` : ''}

  ${S.habits.some(x => !x.archived) ? `<section class="card"><div class="sec-h"><h2>Habits ${hs.length ? `<span class="cnt">${hs.filter(x => habitDone(x, t)).length}/${hs.length}</span>` : ''}</h2><button class="ghost" data-nav="routine">Routine</button></div>
    ${hs.length ? `<div class="dots habit-row">${hs.map(x => { const dn = habitDone(x, t), lab = habitLabel(x, t), part = !dn && (habitGoal(x) ? Number(lab.split('/')[0]) > 0 : habitTarget(x) > 1 && Number(lab.split('/')[0]) > 0); return `<button class="habit-chip ${dn ? 'done' : part ? 'part' : ''}" data-act="habit" data-id="${esc(x.id)}" aria-pressed="${dn}" data-flip="h:${esc(x.id)}"><i></i><span>${esc(x.name)}</span>${lab ? `<em>${lab}</em>` : ''}</button>`; }).join('')}</div>${tagAsk()}` : '<p class="muted">All caught up for today.</p>'}</section>` : ''}`;
}

// Right after finishing a habit that keeps a type (Gym: Push, Pull, Legs...), one tap records what it was.
function tagAsk() {
  const h = ui.tagAsk && S.habits.find(x => x.id === ui.tagAsk);
  if (!h || !(h.options || []).length || !habitDone(h, today())) return '';
  return `<div class="tag-ask"><span class="muted">${esc(h.name)}: what was it?</span>${h.options.map(o => `<button class="pill" data-act="habitTag" data-id="${esc(h.id)}" data-tag="${esc(o)}">${esc(o)}</button>`).join('')}<button class="ghost" data-act="habitTag" data-id="${esc(h.id)}" data-tag="">Skip</button></div>`;
}

// Fill a free slot: pick a task, it gets that time today.
app.sheets.plan = s => {
  const list = openTasks().filter(x => !x.derived && !x.time && (!x.due || daysFromToday(x.due) <= 7)).sort(byRank).slice(0, 12);
  return `<h2>Plan ${esc(clock(s.t))}</h2><p class="muted">Pick what to do in this free slot. It gets a reminder at that time.</p>
  ${list.length ? `<div class="menu">${list.map(x => `<button data-act="taskPlace" data-id="${esc(x.id)}" data-time="${esc(s.t)}">${icon('tasks', 19)}<span>${esc(x.title)}</span></button>`).join('')}</div>` : empty('No untimed tasks to place. Add one in Tasks.')}`;
};
// Hold an event on the timeline: open the day, edit it in Google Calendar, or mark attendance.
app.menus.ev = start => {
  const e = agendaOn(today()).find(x => String(x.start) === String(start) && x.kind !== 'task'); if (!e) return [];
  const m = [{ label: 'Open in Calendar', icon: icon('calendar', 19), act: 'goCal', data: { d: today() } }];
  if (e.gcal) m.push({ label: 'Edit in Google Calendar', icon: icon('edit', 19), act: 'openUrl', data: { url: e.gcal } });
  (e.links || []).forEach(l => m.push({ label: l.kind === 'meet' ? 'Join' : 'Open link', icon: icon(l.kind === 'meet' ? 'video' : 'link', 19), act: 'openUrl', data: { url: l.url } }));
  m.title = esc(e.title);
  return m;
};

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
    gapPlan: d => { ui.sheet = { kind: 'plan', t: d.t }; },
    goCal: d => { ui.view = 'calendar'; ui.sub.calSel = ui.sub.calAnchor = d.d; },
    openUrl: d => { if (/^https?:/.test(d.url || '')) window.open(d.url, '_blank', 'noopener'); },
    inboxTask: d => {
      const m = (app.brief.inbox || []).find(i => i.id === d.id); if (!m) return;
      const title = `${m.from}: ${m.subject}`;
      if (!S.tasks.some(x => x.title === title)) S.tasks.push({ id: uid(), title, due: m.due.slice(0, 10), important: true, done: false, kind: m.tag === 'Placement' ? 'Placement' : 'Task' });
    },
  },
  forms: {
    quick: f => { const p = parseQuick(f.text || ''); if (p.title) { S.tasks.push({ id: uid(), title: p.title, due: p.due, time: p.time, repeat: p.repeat, important: p.important, done: false, kind: 'Task' }); if (p.due || p.time) toast(`Added for ${p.due ? fmtDay(p.due) : 'today'}${p.time ? ' at ' + clock(p.time) : ''}`); } },
    event: f => { S.events.push({ id: uid(), title: (f.title || '').trim(), date: f.date, time: f.time, mins: Number(f.mins) || 60, repeat: f.repeat || '', where: (f.where || '').trim(), link: (f.link || '').trim() }); ui.sub.calAdd = false; },
  },
});
