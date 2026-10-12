import { get, save, reset, exportJSON, importJSON, uid, today, daysFromToday, dayOfYear, esc, inr } from './store.js';
import { GUESSTIMATES, FRAMEWORKS, JARGON, TEARDOWNS, HR_TRENDS, STAR_TRAITS, KANBAN_COLUMNS, APPLY_STEPS, EXPENSE_CATS } from './data.js';

const S = get();
let brief = { events: [], inbox: [], news: [] };
const ui = { view: 'home', sub: { career: 'board', focus: 'tasks', money: 'subs' }, newsCat: 'International', starFilter: 'All' };
const $ = s => document.querySelector(s);
const CAL_FLAG = (e) => e.interview ? '<span class="chip warn">Interview</span>' : '';

// ---------- derived data ----------
const pick = arr => arr[dayOfYear() % arr.length];
const allEvents = () => [...(brief.events || []), ...S.events].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

const until = iso => {
  const ms = new Date(iso) - Date.now();
  if (ms < 0) return 'passed';
  const h = Math.floor(ms / 36e5);
  return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + 'm' : h < 48 ? h + 'h' : Math.floor(h / 24) + 'd';
};
const missingSteps = a => APPLY_STEPS.filter(([k]) => !(a.steps || {})[k]).map(([, l]) => l);
const cvName = a => `${S.profile.roll || 'Roll Number'}_${S.profile.name || 'Full Name'}_${a.company}`;
// Applications still in "To apply" with a deadline show up as important tasks automatically.
const derivedTasks = () => S.apps.filter(a => a.stage === 'To apply' && a.deadline).map(a => ({
  id: 'app-' + a.id, appId: a.id, derived: true, important: true, due: a.deadline.slice(0, 10), kind: 'Apply',
  title: `Apply: ${a.company}`, left: missingSteps(a).join(', ') || 'all steps ticked', at: a.deadline,
}));
const openTasks = () => [...S.tasks.filter(t => !t.done), ...derivedTasks()];

const taskQuadrant = t => {
  const urgent = t.due && daysFromToday(t.due) <= 2;
  return (urgent ? 'U' : '') + (t.important ? 'I' : '');
};

const nextBilling = day => {
  const t = new Date(today() + 'T00:00:00');
  let d = new Date(t.getFullYear(), t.getMonth(), Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day, new Date(t.getFullYear(), t.getMonth() + 2, 0).getDate()));
  return d;
};
const daysToBilling = day => Math.round((nextBilling(day) - new Date(today() + 'T00:00:00')) / 864e5);

const contactDue = c => c.last ? -daysFromToday(c.last) >= c.cadence : true;
const streak = () => {
  let n = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = S.routineLog[key] || {};
    const done = S.routineItems.length && S.routineItems.every(r => log[r.id]);
    if (done) n++; else if (i > 0) break;
  }
  return n;
};
const focusMinutesThisWeek = () => {
  let m = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    m += S.focus[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] || 0;
  }
  return m;
};

// ---------- small renderers ----------
const field = (label, name, attrs = '') => `<label>${label}<input name="${name}" ${attrs}></label>`;
const empty = msg => `<p class="muted">${msg}</p>`;
const tabs = (group, items) => `<div class="tabs">${items.map(([id, label]) => `<button class="${ui.sub[group] === id ? 'on' : ''}" data-act="sub" data-group="${group}" data-id="${id}">${label}</button>`).join('')}</div>`;

// ---------- HOME ----------
function nudges() {
  const out = [];
  S.subs.forEach(s => { const d = daysToBilling(s.day); if (d <= 3) out.push(`💳 ${esc(s.name)} renews ${d === 0 ? 'today' : `in ${d} day${d > 1 ? 's' : ''}`} (${inr(s.amount)})`); });
  S.contacts.filter(contactDue).forEach(c => out.push(`🤝 Follow up with ${esc(c.name)}${c.org ? ' (' + esc(c.org) + ')' : ''}`));
  S.apps.filter(a => a.stage === 'To apply' && a.deadline && new Date(a.deadline) > new Date() && new Date(a.deadline) - Date.now() < 48 * 36e5).forEach(a => out.push(`📝 ${esc(a.company)}: ${esc(missingSteps(a).join(', ') || 'submit')} left, closes in ${until(a.deadline)}`));
  S.tasks.filter(t => !t.done && t.due && daysFromToday(t.due) >= 0 && daysFromToday(t.due) <= 3).forEach(t => out.push(`🎓 ${esc(t.title)} ${daysFromToday(t.due) === 0 ? 'today' : 'in ' + daysFromToday(t.due) + ' day(s)'}`));
  const doFirst = openTasks().filter(t => taskQuadrant(t) === 'UI').length;
  if (doFirst) out.push(`🔥 ${doFirst} urgent + important task${doFirst > 1 ? 's' : ''}`);
  return out;
}

const starLine = () => `<p class="muted">${S.stars.length} STAR stories ready${S.stars.length ? ': ' + [...new Set(S.stars.map(x => x.trait))].join(', ') : ''}.</p>`;
function prepCards() {
  const soon = iso => { const h = (new Date(iso) - Date.now()) / 36e5; return h > -2 && h <= 24; };
  const fromApps = S.apps.filter(a => a.talk && soon(a.talk));
  const talkCards = fromApps.map(a => `<div class="card alert"><h2>📝 Prep: ${esc(a.company)} <span class="chip warn">in ${until(a.talk)}</span></h2>
      <p class="muted">${esc(a.role || 'Pre-placement talk')} · ${new Date(a.talk).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>
      ${a.about ? `<p>${esc(a.about)}</p>` : ''}
      ${a.questions ? `<h3>Questions to ask</h3><p style="white-space:pre-wrap">${esc(a.questions)}</p>` : empty('No questions drafted yet. Talks expect relevant questions; add three on the Career tab.')}
      ${a.stage === 'To apply' ? `<p class="chip warn">Still to do: ${esc(missingSteps(a).join(', ') || 'submit')}</p>` : ''}
      ${starLine()}</div>`);
  const eventCards = allEvents().filter(e => e.interview && e.company && soon(e.date + 'T' + (e.time || '09:00')))
    .filter(e => !fromApps.some(a => a.company.toLowerCase() === e.company.toLowerCase()))
    .map(e => {
      const app = S.apps.find(x => x.company.toLowerCase() === e.company.toLowerCase());
      return `<div class="card alert"><h2>📝 Prep: ${esc(e.company)}</h2><p class="muted">${esc(e.title)} · ${esc(e.date)} ${esc(e.time || '')}</p>
      ${app ? `<p><b>${esc(app.role || 'Role')}</b>${app.notes ? ': ' + esc(app.notes) : ''}</p>` : empty('No application notes saved. Add them on the Career board.')}${starLine()}</div>`;
    });
  return [...talkCards, ...eventCards].join('');
}

function homeView() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const t = today();
  const evs = allEvents().filter(e => e.date === t);
  const log = S.routineLog[t] || {};
  const doneN = S.routineItems.filter(r => log[r.id]).length;
  const cats = ['International', 'Indian', 'Business', 'Tech'];
  const news = (brief.news || []).filter(n => n.cat === ui.newsCat);
  const g = pick(GUESSTIMATES), f = pick(FRAMEWORKS), j = pick(JARGON);
  const nd = nudges();
  return `
  <h1>${hello} 👋</h1><p class="muted">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${brief.source === 'sample' ? ' · sample brief data' : ''}</p>
  ${nd.length ? `<div class="card alert"><h2>⚡ Needs attention</h2><ul class="list">${nd.map(n => `<li>${n}</li>`).join('')}</ul></div>` : ''}
  ${prepCards()}
  <div class="card"><h2>📅 Today's calendar</h2>
    ${evs.length ? `<ul class="list">${evs.map(e => `<li><span class="chip">${esc(e.time || 'All day')}</span><div class="grow"><span class="title">${esc(e.title)}</span> ${CAL_FLAG(e)}</div>${e.id ? `<button class="ghost danger" data-act="delEvent" data-id="${e.id}">✕</button>` : ''}</li>`).join('')}</ul>` : empty('No events scheduled for today.')}
    <details><summary>Add event</summary>
      <form data-form="event" class="inline">${field('Title', 'title', 'required')}${field('Date', 'date', `type="date" required value="${t}"`)}${field('Time', 'time', 'type="time"')}${field('Company (interviews)', 'company')}
      <label class="check"><input type="checkbox" name="interview"> Interview</label><button class="primary">Add</button></form></details></div>
  <div class="card"><h2>📬 Important email & actions</h2>
    ${(brief.inbox || []).length ? `<ul class="list">${brief.inbox.map(m => `<li class="${S.inboxDone[m.id] ? 'done' : ''}"><input type="checkbox" style="width:auto;margin-top:5px" data-act="inbox" data-id="${m.id}" ${S.inboxDone[m.id] ? 'checked' : ''}><div class="grow"><span class="title">${esc(m.from)}: ${esc(m.subject)}</span> ${m.tag ? `<span class="chip">${esc(m.tag)}</span>` : ''}<div class="muted">Action: ${esc(m.action)}</div>${m.due ? `<div class="row"><span class="chip warn">due ${new Date(m.due).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span><button class="ghost" data-act="inboxTask" data-id="${m.id}">+ Add to tasks</button></div>` : ''}</div></li>`).join('')}</ul>` : empty('Nothing urgent.')}
    <p class="muted">Feed comes from data/brief.json. See README to wire Gmail.</p></div>
  <div class="card"><h2>✅ Morning routine <span class="chip">${doneN}/${S.routineItems.length}</span> <span class="chip ok">🔥 ${streak()} day streak</span></h2>
    <div class="bar"><i style="width:${S.routineItems.length ? doneN / S.routineItems.length * 100 : 0}%"></i></div>
    <ul class="list">${S.routineItems.map(r => `<li class="${log[r.id] ? 'done' : ''}"><input type="checkbox" style="width:auto" data-act="routine" data-id="${r.id}" ${log[r.id] ? 'checked' : ''}><span class="grow title">${esc(r.label)}</span><button class="ghost danger" data-act="delRoutine" data-id="${r.id}" aria-label="Remove">✕</button></li>`).join('')}</ul>
    <form data-form="routine" class="inline">${field('New habit', 'label', 'required')}<button>Add</button></form></div>
  <div class="card"><h2>📰 News</h2>
    <div class="tabs">${cats.map(c => `<button class="${ui.newsCat === c ? 'on' : ''}" data-act="newsCat" data-id="${c}">${c}</button>`).join('')}</div>
    ${news.length ? `<ul class="list">${news.map(n => `<li><div class="grow"><span class="title">${n.kind === 'fact' ? '💡 ' : ''}${esc(n.title)}</span><p>${esc(n.summary)}</p><p class="muted"><b>Why it matters:</b> ${esc(n.why)} · ${esc(n.src)}</p></div></li>`).join('')}</ul>` : empty('No stories in this category.')}</div>
  <div class="card"><h2>🧠 Today's learning</h2>
    <p><b>Guesstimate:</b> ${esc(g.q)}</p><p><b>${esc(f.area)} framework:</b> ${esc(f.name)}: ${esc(f.summary)}</p><p><b>Jargon:</b> ${esc(j.term)}</p>
    <button data-nav="learn">Open Knowledge Engine</button></div>`;
}

// ---------- LEARN ----------
function learnView() {
  const t = today(), g = pick(GUESSTIMATES), f = pick(FRAMEWORKS), j = pick(JARGON);
  const weekIdx = Math.floor(dayOfYear() / 7);
  const td = TEARDOWNS[weekIdx % TEARDOWNS.length], tr = HR_TRENDS[weekIdx % HR_TRENDS.length];
  const gs = S.guess[t] || { text: '', revealed: false };
  return `<h1>Knowledge Engine</h1>
  <div class="card"><h2>🎲 Guesstimate of the day</h2><p class="title">${esc(g.q)}</p>
    <p class="muted">Hint: ${esc(g.hint)}</p>
    <textarea data-bind="guess" placeholder="Write your approach before you peek...">${esc(gs.text)}</textarea>
    ${gs.revealed ? `<h3>Structured breakdown</h3><ol class="list steps">${g.steps.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ol><p class="quote">${esc(g.answer)}</p>`
      : `<button class="primary" data-act="reveal">Reveal breakdown</button>`}</div>
  <div class="card"><h2>📐 Framework of the day <span class="chip">${esc(f.area)}</span></h2><p class="title">${esc(f.name)}</p><p>${esc(f.summary)}</p>
    <ul class="list">${f.parts.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ul>
    <p><b>Use it for:</b> ${esc(f.use)}</p><p class="muted"><b>Example:</b> ${esc(f.example)}</p></div>
  <div class="card"><h2>📖 Jargon buster</h2><p class="title">${esc(j.term)}</p><p>${esc(j.meaning)}</p></div>
  <details class="card"><summary>Weekly reading: campaign teardown and HR trend</summary><div><h2>🎬 Campaign teardown <span class="chip">${esc(td.verdict)}</span></h2><p class="title">${esc(td.name)}</p><p class="muted">${esc(td.brand)} · ${esc(td.year)} · weekly pick</p>
    <ul class="list">${[['Audience', td.audience], ['Positioning', td.positioning], ['Tactics', td.tactics], ['Result / ROI', td.result]].map(([a, b]) => `<li><div><b>${a}</b><div>${esc(b)}</div></div></li>`).join('')}</ul>
    <p class="quote">${esc(td.lesson)}</p></div>
  <div><h2>🏢 HR & OB trend</h2><p class="title">${esc(tr.title)}</p><p>${esc(tr.body)}</p><p class="muted">${esc(tr.lens)}</p></div></details>`;
}

// ---------- CAREER ----------
function careerView() {
  const sub = ui.sub.career;
  let body = '';
  if (sub === 'board') {
    const appCard = (x, ci) => `<div class="card"><div class="row between"><span class="title">${esc(x.company)}</span>${x.stage === 'To apply' && x.deadline ? `<span class="chip ${new Date(x.deadline) - Date.now() < 864e5 ? 'bad' : 'warn'}">closes in ${until(x.deadline)}</span>` : ''}</div>
      <div class="muted">${esc(x.role)}</div>
      ${x.stage === 'To apply' ? `<ul class="list">${APPLY_STEPS.map(([k, l]) => `<li style="padding:5px 0"><label class="check"><input type="checkbox" data-act="step" data-id="${x.id}" data-step="${k}" ${(x.steps || {})[k] ? 'checked' : ''}> ${l}</label></li>`).join('')}</ul>
        <input data-bind="app" data-id="${x.id}" data-field="applicantId" placeholder="Applicant ID from company portal" value="${esc(x.applicantId)}">
        <div class="row" style="margin-top:6px"><code class="grow muted" style="overflow-wrap:anywhere">${esc(cvName(x))}</code><button data-act="copy" data-text="${esc(cvName(x))}">Copy name</button></div>` : ''}
      <details><summary>Prep and notes</summary>
        <label>Pre-placement talk / interview<input type="datetime-local" data-bind="app" data-id="${x.id}" data-field="talk" value="${esc(x.talk)}"></label>
        <label>What they do, roles on offer<textarea data-bind="app" data-id="${x.id}" data-field="about">${esc(x.about)}</textarea></label>
        <label>Questions to ask (one per line)<textarea data-bind="app" data-id="${x.id}" data-field="questions">${esc(x.questions)}</textarea></label>
        <label>Notes<textarea data-bind="app" data-id="${x.id}" data-field="notes">${esc(x.notes)}</textarea></label></details>
      <div class="row">${ci > 0 ? `<button data-act="moveApp" data-id="${x.id}" data-dir="-1">←</button>` : ''}${ci < KANBAN_COLUMNS.length - 1 ? `<button data-act="moveApp" data-id="${x.id}" data-dir="1">→</button>` : ''}<button class="ghost danger" data-act="delApp" data-id="${x.id}">Delete</button></div></div>`;
    body = `<details class="card" ${S.profile.roll && S.profile.name ? '' : 'open'}><summary>CV file name</summary><p class="muted">Used to build the name each company asks for: Roll Number_Full Name_Company.</p>
      <form data-form="profile" class="inline">${field('Roll number', 'roll', `value="${esc(S.profile.roll)}"`)}${field('Full name', 'name', `value="${esc(S.profile.name)}"`)}<button>Save</button></form></details>
      <div class="kanban">${KANBAN_COLUMNS.map((col, ci) => `<div class="col"><h3>${col} <span class="chip">${S.apps.filter(x => x.stage === col).length}</span></h3>${S.apps.filter(x => x.stage === col).sort((p, q) => (p.deadline || '9').localeCompare(q.deadline || '9')).map(x => appCard(x, ci)).join('')}</div>`).join('')}</div>
      <div class="card"><h2>Add application</h2><form data-form="app" class="inline">${field('Company', 'company', 'required')}${field('Role', 'role')}${field('Apply by', 'deadline', 'type="datetime-local"')}<button class="primary">Add</button></form>
      <p class="muted">Tick the four steps and the card moves to Applied. Anything still in To apply with a deadline shows in Tasks and on Home.</p></div>`;
  } else if (sub === 'people') {
    const sorted = [...S.contacts].sort((a, b) => (contactDue(b) - contactDue(a)) || (a.last || '').localeCompare(b.last || ''));
    body = `<div class="card"><h2>🤝 Networking rolodex</h2>${sorted.length ? `<ul class="list">${sorted.map(c => {
      const ago = c.last ? -daysFromToday(c.last) : null;
      return `<li><div class="grow"><span class="title">${esc(c.name)}</span> <span class="chip">${esc(c.kind)}</span> ${contactDue(c) ? '<span class="chip warn">Follow up</span>' : ''}<div class="muted">${esc(c.org)} · ${ago === null ? 'never contacted' : ago + ' days ago'} · every ${c.cadence}d</div>${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</div>
      <button data-act="contacted" data-id="${c.id}">Done today</button><button class="ghost danger" data-act="delContact" data-id="${c.id}">✕</button></li>`; }).join('')}</ul>` : empty('Add GIM alumni, faculty and recruiters.')}
      <form data-form="contact" class="inline">${field('Name', 'name', 'required')}${field('Organisation', 'org')}<label>Type<select name="kind"><option>Alumni</option><option>Faculty</option><option>Recruiter</option><option>Other</option></select></label>
      <label>Nudge every<select name="cadence"><option value="30">30 days</option><option value="45">45 days</option><option value="60">60 days</option></select></label>${field('Note', 'note')}<button class="primary">Add</button></form></div>`;
  } else {
    const list = S.stars.filter(s => ui.starFilter === 'All' || s.trait === ui.starFilter);
    body = `<div class="card"><h2>⭐ STAR story bank</h2>
      <div class="tabs">${['All', ...STAR_TRAITS].map(t => `<button class="${ui.starFilter === t ? 'on' : ''}" data-act="starFilter" data-id="${t}">${t}</button>`).join('')}</div>
      ${list.length ? list.map(s => `<details class="card"><summary>${esc(s.title)} <span class="chip">${esc(s.trait)}</span></summary>${[['Situation', s.s], ['Task', s.t], ['Action', s.a], ['Result', s.r]].map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join('')}<button class="ghost danger" data-act="delStar" data-id="${s.id}">Delete</button></details>`).join('') : empty('No stories yet.')}
      <details><summary>Add story</summary><form data-form="star">${field('Title', 'title', 'required')}<label>Trait<select name="trait">${STAR_TRAITS.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label>Situation<textarea name="s" required></textarea></label><label>Task<textarea name="t" required></textarea></label><label>Action<textarea name="a" required></textarea></label><label>Result (use numbers)<textarea name="r" required></textarea></label><button class="primary">Save story</button></form></details></div>`;
  }
  return `<h1>Placement CRM</h1>${tabs('career', [['board', 'Applications'], ['people', 'Network'], ['star', 'STAR stories']])}${body}`;
}

// ---------- FOCUS ----------
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const timerRemaining = () => S.timer.running ? Math.max(0, Math.ceil((S.timer.endsAt - Date.now()) / 1000)) : S.timer.remaining;

function focusView() {
  const sub = ui.sub.focus;
  let body = '';
  if (sub === 'tasks') {
    const open = openTasks();
    const q = { UI: ['🔥 Do first', 'Urgent + important'], I: ['📆 Schedule', 'Important, not urgent'], U: ['🤝 Delegate / quick', 'Urgent, not important'], '': ['🗑 Eliminate', 'Neither'] };
    const chip = t => { if (!t.due) return ''; const n = daysFromToday(t.due); return `<span class="chip ${n <= 1 ? 'warn' : ''}">${n < 0 ? 'overdue' : n === 0 ? 'today' : n + 'd'}</span>`; };
    body = `<div class="matrix">${Object.entries(q).map(([k, [name, desc]]) => `<div><h3>${name}</h3><p class="muted">${desc}</p><ul class="list">${open.filter(t => taskQuadrant(t) === k).sort((p, q2) => (p.due || '9').localeCompare(q2.due || '9')).map(t => `<li>${t.derived ? `<button data-act="goApp" data-id="${t.appId}">Open</button>` : `<input type="checkbox" style="width:auto" data-act="taskDone" data-id="${t.id}">`}<div class="grow">${esc(t.title)} ${chip(t)} ${t.kind && t.kind !== 'Task' ? `<span class="chip plain">${esc(t.kind)}</span>` : ''}${t.left ? `<div class="muted">left: ${esc(t.left)}</div>` : t.due ? `<div class="muted">due ${esc(t.due)}</div>` : ''}</div>${t.derived ? '' : `<button class="ghost danger" data-act="delTask" data-id="${t.id}">✕</button>`}</li>`).join('')}</ul></div>`).join('')}</div>
      <div class="card"><form data-form="task" class="inline">${field('Task or deadline', 'title', 'required')}${field('Due', 'due', 'type="date"')}<label>Type<select name="kind"><option>Task</option><option>Submission</option><option>Exam</option><option>Presentation</option><option>Placement</option></select></label><label class="check"><input type="checkbox" name="important" checked> Important</label><button class="primary">Add</button></form>
      <p class="muted">Urgent means due within 2 days or overdue. Quadrants update by themselves as deadlines approach. Open applications with a deadline appear here automatically.</p></div>
      ${S.tasks.some(t => t.done) ? `<p class="muted">${S.tasks.filter(t => t.done).length} completed <button class="ghost" data-act="clearDone">Clear</button></p>` : ''}`;
  } else {
    const r = timerRemaining(), tm = S.timer, total = tm.len * 60;
    body = `<div class="card"><h2>⏱ ${tm.mode === 'focus' ? 'Deep work' : 'Break'}</h2><div class="timer" id="timer">${fmt(r)}</div>
      <div class="bar"><i id="timerbar" style="width:${tm.mode === 'focus' ? (1 - r / total) * 100 : 0}%"></i></div>
      <div class="row" style="margin-top:12px;justify-content:center">${tm.running ? '<button class="primary" data-act="timerPause">Pause</button>' : '<button class="primary" data-act="timerStart">Start</button>'}<button data-act="timerReset">Reset</button></div>
      <div class="row" style="justify-content:center;margin-top:8px">${[25, 50, 90].map(m => `<button class="ghost" data-act="timerLen" data-id="${m}">${m} min</button>`).join('')}</div>
      <p class="muted">While a focus session runs, the app dims navigation and holds back its own nudges. Phones need Do Not Disturb turned on separately; a web app cannot silence other apps.</p></div>
      <div class="card"><h2>📈 Focus hours</h2><p>Today: <b>${S.focus[today()] || 0} min</b> · Last 7 days: <b>${(focusMinutesThisWeek() / 60).toFixed(1)} h</b></p></div>`;
  }
  return `<h1>Productivity</h1>${tabs('focus', [['tasks', 'Tasks and deadlines'], ['timer', 'Deep work']])}${body}`;
}

// ---------- MONEY ----------
function moneyView() {
  const sub = ui.sub.money;
  let body = '';
  if (sub === 'subs') {
    const total = S.subs.reduce((a, s) => a + s.amount, 0);
    const sorted = [...S.subs].sort((a, b) => daysToBilling(a.day) - daysToBilling(b.day));
    body = `<div class="card"><h2>🔁 Subscriptions <span class="chip">${inr(total)}/month</span></h2>${sorted.length ? `<ul class="list">${sorted.map(s => { const d = daysToBilling(s.day); return `<li><div class="grow"><span class="title">${esc(s.name)}</span><div class="muted">${inr(s.amount)} · renews on the ${s.day}th</div></div><span class="chip ${d <= 3 ? 'warn' : ''}">${d === 0 ? 'today' : d + 'd'}</span><button class="ghost danger" data-act="delSub" data-id="${s.id}">✕</button></li>`; }).join('')}</ul>` : empty('Add Canva, AI tools, Netflix...')}
      <form data-form="sub" class="inline">${field('Name', 'name', 'required')}${field('Amount (₹)', 'amount', 'type="number" min="0" step="any" required')}${field('Billing day (1-31)', 'day', 'type="number" min="1" max="31" required')}<button class="primary">Add</button></form></div>`;
  } else {
    const ym = today().slice(0, 7);
    const month = S.expenses.filter(e => e.date.startsWith(ym));
    const spent = month.reduce((a, e) => a + e.amount, 0);
    const pct = S.budget ? spent / S.budget * 100 : 0;
    const byCat = EXPENSE_CATS.map(c => [c, month.filter(e => e.cat === c).reduce((a, e) => a + e.amount, 0)]).filter(x => x[1]);
    body = `<div class="card"><h2>📒 This month</h2><p><span class="big">${inr(spent)}</span> ${S.budget ? `of ${inr(S.budget)} · ${S.budget - spent >= 0 ? inr(S.budget - spent) + ' left' : '<span class="chip bad">' + inr(spent - S.budget) + ' over</span>'}` : ''}</p>
      ${S.budget ? `<div class="bar ${pct > 100 ? 'over' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div>` : ''}
      ${byCat.length ? `<p class="muted">${byCat.map(([c, v]) => `${c} ${inr(v)}`).join(' · ')}</p>` : ''}
      <form data-form="budget" class="inline">${field('Monthly budget (₹)', 'budget', `type="number" min="0" value="${S.budget || ''}"`)}<button>Set</button></form></div>
      <div class="card"><h2>Quick add</h2><form data-form="expense" class="inline">${field('Amount (₹)', 'amount', 'type="number" min="0" step="any" required')}<label>Category<select name="cat">${EXPENSE_CATS.map(c => `<option>${c}</option>`).join('')}</select></label>${field('Note', 'note')}${field('Date', 'date', `type="date" value="${today()}" required`)}<button class="primary">Log</button></form></div>
      <div class="card"><h2>Recent</h2>${S.expenses.length ? `<ul class="list">${[...S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map(e => `<li><div class="grow"><span class="title">${inr(e.amount)}</span> <span class="chip">${esc(e.cat)}</span><div class="muted">${esc(e.date)} ${esc(e.note)}</div></div><button class="ghost danger" data-act="delExpense" data-id="${e.id}">✕</button></li>`).join('')}</ul>` : empty('Nothing logged yet.')}</div>
      <details class="card"><summary>Data</summary><div class="row"><button data-act="export">Export backup</button><button data-act="import">Import backup</button><button class="danger" data-act="wipe">Erase all</button></div></details>`;
  }
  return `<h1>Finance & admin</h1>${tabs('money', [['subs', 'Subscriptions'], ['ledger', 'Budget ledger']])}${body}`;
}

// ---------- render + events ----------
const VIEWS = { home: homeView, learn: learnView, career: careerView, focus: focusView, money: moneyView };
function render() {
  $('#view').innerHTML = VIEWS[ui.view]();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === ui.view));
  document.body.classList.toggle('deep', S.timer.running && S.timer.mode === 'focus');
}
const go = v => { ui.view = v; render(); window.scrollTo(0, 0); };
const byId = (arr, id) => arr.find(x => x.id === id);
const del = (key, id) => { S[key] = S[key].filter(x => x.id !== id); };

const actions = {
  sub: d => { ui.sub[d.group] = d.id; },
  newsCat: d => { ui.newsCat = d.id; },
  starFilter: d => { ui.starFilter = d.id; },
  inbox: d => { S.inboxDone[d.id] = !S.inboxDone[d.id]; },
  routine: d => { const l = (S.routineLog[today()] ||= {}); l[d.id] = !l[d.id]; },
  delRoutine: d => del('routineItems', d.id),
  delEvent: d => del('events', d.id),
  reveal: () => { (S.guess[today()] ||= { text: '' }).revealed = true; },
  moveApp: d => { const a = byId(S.apps, d.id); a.stage = KANBAN_COLUMNS[KANBAN_COLUMNS.indexOf(a.stage) + Number(d.dir)]; },
  delApp: d => del('apps', d.id),
  contacted: d => { byId(S.contacts, d.id).last = today(); },
  delContact: d => del('contacts', d.id),
  delStar: d => del('stars', d.id),
  step: d => {
    const x = byId(S.apps, d.id); x.steps = x.steps || {}; x.steps[d.step] = !x.steps[d.step];
    if (x.stage === 'To apply' && APPLY_STEPS.every(([k]) => x.steps[k])) x.stage = 'Applied';
  },
  copy: d => { try { navigator.clipboard.writeText(d.text).catch(() => {}); } catch { /* clipboard unavailable */ } },
  goApp: () => { ui.view = 'career'; ui.sub.career = 'board'; },
  inboxTask: d => {
    const m = (brief.inbox || []).find(i => i.id === d.id); if (!m) return;
    const title = `${m.from}: ${m.subject}`;
    if (!S.tasks.some(t => t.title === title)) S.tasks.push({ id: uid(), title, due: m.due.slice(0, 10), important: true, done: false, kind: m.tag === 'Placement' ? 'Placement' : 'Task' });
  },
  taskDone: d => { byId(S.tasks, d.id).done = true; },
  delTask: d => del('tasks', d.id),
  clearDone: () => { S.tasks = S.tasks.filter(t => !t.done); },
  delDeadline: d => del('deadlines', d.id),
  delSub: d => del('subs', d.id),
  delExpense: d => del('expenses', d.id),
  timerStart: () => { const t = S.timer; t.endsAt = Date.now() + t.remaining * 1000; t.running = true; askNotify(); },
  timerPause: () => { const t = S.timer; t.remaining = timerRemaining(); t.running = false; t.endsAt = null; },
  timerReset: () => { const t = S.timer; t.mode = 'focus'; t.running = false; t.endsAt = null; t.remaining = t.len * 60; },
  timerLen: d => { const t = S.timer; t.len = Number(d.id); t.mode = 'focus'; t.running = false; t.endsAt = null; t.remaining = t.len * 60; },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    a.download = `daily-driver-${today()}.json`; a.click();
  },
  import: () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json';
    i.onchange = async () => { try { importJSON(await i.files[0].text()); location.reload(); } catch { alert('That file is not a valid backup.'); } };
    i.click();
  },
  wipe: () => { if (confirm('Erase all data on this device?')) { reset(); location.reload(); } },
};

const forms = {
  event: f => S.events.push({ id: uid(), title: f.title, date: f.date, time: f.time, interview: !!f.interview, company: f.company }),
  routine: f => S.routineItems.push({ id: uid(), label: f.label }),
  app: f => S.apps.push({ id: uid(), company: f.company, role: f.role, deadline: f.deadline, stage: KANBAN_COLUMNS[0], steps: {} }),
  profile: f => { S.profile = { roll: f.roll, name: f.name }; },
  contact: f => S.contacts.push({ id: uid(), name: f.name, org: f.org, kind: f.kind, cadence: Number(f.cadence), note: f.note, last: '' }),
  star: f => S.stars.push({ id: uid(), title: f.title, trait: f.trait, s: f.s, t: f.t, a: f.a, r: f.r }),
  task: f => S.tasks.push({ id: uid(), title: f.title, due: f.due, important: !!f.important, done: false, kind: f.kind }),
  deadline: f => S.deadlines.push({ id: uid(), title: f.title, date: f.date, kind: f.kind }),
  sub: f => S.subs.push({ id: uid(), name: f.name, amount: Number(f.amount), day: Number(f.day) }),
  expense: f => S.expenses.push({ id: uid(), amount: Number(f.amount), cat: f.cat, note: f.note, date: f.date }),
  budget: f => { S.budget = Number(f.budget) || 0; },
};

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return go(nav.dataset.nav);
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (el.type === 'checkbox') e.stopPropagation();
  actions[el.dataset.act](el.dataset); save(); render();
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form));
  forms[form.dataset.form](fd); save(); render();
});
document.addEventListener('input', e => {
  if (e.target.dataset.bind === 'app') { const x = byId(S.apps, e.target.dataset.id); if (x) { x[e.target.dataset.field] = e.target.value; save(); } return; }
  if (e.target.dataset.bind === 'guess') { (S.guess[today()] ||= { revealed: false }).text = e.target.value; save(); }
});

// ---------- timer ----------
function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ } }
function completeTimer() {
  const t = S.timer;
  if (t.mode === 'focus') { S.focus[today()] = (S.focus[today()] || 0) + t.len; t.mode = 'break'; t.remaining = 5 * 60; }
  else { t.mode = 'focus'; t.remaining = t.len * 60; }
  t.running = false; t.endsAt = null; save();
  try { navigator.vibrate?.(300); if ('Notification' in window && Notification.permission === 'granted') new Notification(t.mode === 'break' ? 'Focus session done. Take 5.' : 'Break over. Back to work.'); } catch { /* ignore */ }
  render();
}
setInterval(() => {
  if (!S.timer.running) return;
  const r = timerRemaining();
  if (r <= 0) return completeTimer();
  const el = $('#timer');
  if (el) { el.textContent = fmt(r); const b = $('#timerbar'); if (b && S.timer.mode === 'focus') b.style.width = (1 - r / (S.timer.len * 60)) * 100 + '%'; }
}, 500);

// ---------- boot ----------
(async function boot() {
  try { brief = await (await fetch('data/brief.json', { cache: 'no-cache' })).json(); } catch { /* offline: render without brief */ }
  if (S.deadlines.length) { S.deadlines.forEach(d => S.tasks.push({ id: d.id, title: d.title, due: d.date, important: true, done: false, kind: d.kind })); S.deadlines = []; save(); }
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
