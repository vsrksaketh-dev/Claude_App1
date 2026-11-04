// Routine: the habits behind the Home strip. Not a tab: opened from the Habits card on Home (or Settings), so it stays part of the day instead of a separate tracker.
// Three kinds of habit: fixed days ("Skin care, every morning"), a weekly goal ("Gym, 5 times a week", with a type per session: Push, Pull, Run...) and a counter ("Water, 8 a day").
import { S, ui, register, remove } from '../core.js';
import { today, esc, uid, fmtDay } from '../util.js';
import { empty, chip, head } from '../ui.js';
import { habitGoal, habitTarget, habitWeek, weekDone, habitStreak, streakText, habitLabel, weekTags, weekHistory, habitDone, habitCount, toggleHabit, setHabit, habitsOn, habitInfo } from '../logic.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const WHEN = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['anytime', 'Anytime']];
const PRESETS = [
  { name: 'Gym', goal: 5, options: ['Push', 'Pull', 'Legs', 'Cardio', 'Other'], when: 'evening' },
  { name: 'Walk or run', goal: 4, options: ['Walk', 'Run', 'Cycle'], when: 'morning' },
  { name: 'Water', target: 8, when: 'anytime' },
  { name: 'Read 10 pages', when: 'evening' },
  { name: 'Meditate', when: 'morning' },
  { name: 'Practice a case', goal: 3, when: 'anytime' },
];
const rd = ui.rd = { edit: null, confirm: '' };
const live = () => S.habits.filter(h => !h.archived);
const kindText = h => habitGoal(h) ? `${habitGoal(h)} times a week` : habitTarget(h) > 1 ? `${habitTarget(h)} a day` : (h.days.length === 7 ? 'Every day' : h.days.length ? ORDER.filter(d => h.days.includes(d)).map(d => DAYS[d]).join(', ') : 'No days');
const meta = h => [kindText(h), (WHEN.find(w => w[0] === h.when) || [])[1] && h.when !== 'anytime' ? WHEN.find(w => w[0] === h.when)[1].toLowerCase() : '', h.time ? 'nudge at ' + h.time : ''].filter(Boolean).join(' · ');

const dots = h => `<div class="wk-dots" role="group" aria-label="${esc(h.name)} this week">${habitWeek(h).map(d => `<button class="wk ${d.done ? 'on' : ''} ${d.today ? 'now' : ''} ${d.off ? 'off' : ''}" ${d.future ? 'disabled' : ''} data-act="habitDay" data-id="${esc(h.id)}" data-date="${d.k}" aria-pressed="${d.done}" aria-label="${esc(fmtDay(d.k))}"><b>${DAYS[new Date(d.k + 'T00:00:00').getDay()].charAt(0)}</b></button>`).join('')}</div>`;
const history = h => { const hs = weekHistory(h); const max = Math.max(1, ...hs.map(x => Math.max(x.n, x.goal))); return `<div class="wk-hist" aria-label="Last six weeks">${hs.map(x => `<i title="${x.n} of ${x.goal}" class="${x.n >= x.goal ? 'met' : ''}" style="height:${Math.max(6, Math.round(100 * x.n / max))}%"></i>`).join('')}</div>`; };

function editor(h) {
  const goalMode = habitGoal(h) > 0, count = habitTarget(h) > 1;
  const kind = goalMode ? 'goal' : count ? 'count' : 'days';
  return `<form data-form="habitEdit" data-id="${esc(h.id)}" class="hedit">
    <label>Name<input name="name" value="${esc(h.name)}" maxlength="60" required></label>
    <div class="seg" role="group" aria-label="How often">${[['days', 'Set days'], ['goal', 'Times a week'], ['count', 'Counter']].map(([k, l]) => `<button type="button" class="${kind === k ? 'on' : ''}" data-act="habitKind" data-id="${esc(h.id)}" data-kind="${k}">${l}</button>`).join('')}</div>
    ${kind === 'goal' ? `<label>Times a week<input name="goal" type="number" min="1" max="7" value="${habitGoal(h) || 3}"></label>` : ''}
    ${kind === 'count' ? `<label>Times a day<input name="target" type="number" min="2" max="50" value="${habitTarget(h)}"></label>` : ''}
    ${kind === 'days' ? `<div class="days" role="group" aria-label="Days">${ORDER.map(d => `<label class="check"><input type="checkbox" name="d${d}" ${h.days.includes(d) ? 'checked' : ''}> ${DAYS[d]}</label>`).join('')}</div>` : ''}
    <div class="inline"><label>Part of day<select name="when">${WHEN.map(([k, l]) => `<option value="${k}" ${h.when === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Nudge at (optional)<input name="time" type="time" value="${esc(h.time || '')}"></label></div>
    <label>Types to pick from (optional, comma separated)<input name="options" value="${esc((h.options || []).join(', '))}" placeholder="Push, Pull, Legs, Run"></label>
    <div class="row"><button class="primary">Save</button><button type="button" data-act="habitEditClose">Close</button><button type="button" class="ghost danger" data-act="habitArchive" data-id="${esc(h.id)}">${rd.confirm === h.id ? 'Tap again to remove' : 'Remove'}</button></div></form>`;
}

function card(h) {
  const streak = streakText(h), tags = weekTags(h), lab = habitLabel(h);
  const goal = habitGoal(h);
  return `<section class="card habit-card" data-flip="hc:${esc(h.id)}">
    <div class="row between"><div class="grow"><h2 style="margin:0">${esc(h.name)}</h2><div class="muted">${esc(meta(h))}</div></div>${goal ? chip(`${weekDone(h)}/${goal} this week`, weekDone(h) >= goal ? 'ok' : '') : lab ? chip(lab + ' today', habitDone(h, today()) ? 'ok' : '') : ''}</div>
    ${dots(h)}
    ${streak || tags ? `<div class="row" style="margin-top:10px">${streak ? `<span class="chip ok">${esc(streak)}</span>` : ''}${tags ? `<span class="muted">${esc(tags)}</span>` : ''}</div>` : ''}
    <div class="row between" style="margin-top:8px"><button class="ghost" data-act="habitEditOpen" data-id="${esc(h.id)}">${rd.edit === h.id ? 'Close' : 'Edit'}</button>${history(h)}</div>
    ${rd.edit === h.id ? editor(h) : ''}</section>`;
}

function render() {
  const hs = live(), t = today();
  const due = habitsOn(t), done = due.filter(h => habitDone(h, t)).length;
  const goals = hs.filter(h => habitGoal(h));
  const met = goals.filter(h => weekDone(h) >= habitGoal(h)).length;
  const sessions = hs.reduce((a, h) => a + habitWeek(h).filter(d => d.done).length, 0);
  return `${head('Routine', hs.length ? `${done} of ${due.length} due today` : 'Small habits, steady weeks', '<button class="pill" data-nav="home">Home</button>')}
  ${hs.length ? `<section class="card recap"><h2>This week</h2><div class="recap-grid"><div><b>${sessions}</b><span>habit check-ins</span></div>${goals.length ? `<div><b>${met}/${goals.length}</b><span>weekly goals met</span></div>` : ''}<div><b>${hs.reduce((a, h) => Math.max(a, habitStreak(h)), 0)}</b><span>best streak</span></div></div></section>` : ''}
  ${hs.map(card).join('') || `<section class="card">${empty('No habits yet. Pick one below or make your own.')}</section>`}
  <section class="card"><h2>Add a habit</h2>
    <div class="starters">${PRESETS.filter(p => !hs.some(h => h.name === p.name)).map(p => `<button class="pill" data-act="habitPreset" data-id="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div>
    <form data-form="habit" class="capture" style="margin-top:12px"><input name="name" placeholder="Or name your own" aria-label="New habit" maxlength="60" required><button class="primary">Add</button></form>
    <p class="muted" style="margin-top:10px">Pick how often after adding: set days, a number of times a week (like the gym, five times), or a counter (like eight glasses of water). Tap a day dot to log a day you forgot.</p></section>`;
}

register({
  id: 'routine', label: 'Routine', render,
  actions: {
    habitDay: d => { const h = S.habits.find(x => x.id === d.id); if (h) toggleHabit(h, d.date); },
    habitEditOpen: d => { rd.edit = rd.edit === d.id ? null : d.id; rd.confirm = ''; },
    habitEditClose: () => { rd.edit = null; },
    habitKind: d => {
      const h = S.habits.find(x => x.id === d.id); if (!h) return;
      if (d.kind === 'goal') { h.goal = h.goal || 3; h.target = 1; h.days = [0, 1, 2, 3, 4, 5, 6]; }
      else if (d.kind === 'count') { h.goal = 0; h.target = Math.max(2, h.target || 8); h.days = [0, 1, 2, 3, 4, 5, 6]; }
      else { h.goal = 0; h.target = 1; }
    },
    habitArchive: d => { if (rd.confirm !== d.id) { rd.confirm = d.id; return; } remove('habits', d.id); rd.edit = null; rd.confirm = ''; },
    habitPreset: d => { const p = PRESETS.find(x => x.name === d.id); if (p) S.habits.push({ id: uid(), name: p.name, when: p.when || 'anytime', days: [0, 1, 2, 3, 4, 5, 6], created: today(), goal: p.goal || 0, target: p.target || 1, options: p.options || [], time: '' }); },
  },
  forms: {
    habit: f => { const n = (f.name || '').trim(); if (n) S.habits.push({ id: uid(), name: n, when: 'anytime', days: [0, 1, 2, 3, 4, 5, 6], created: today(), goal: 0, target: 1, options: [], time: '' }); },
    habitEdit: (f, form) => {
      const h = S.habits.find(x => x.id === form.dataset.id); if (!h) return;
      h.name = (f.name || h.name).trim() || h.name; h.when = f.when || 'anytime'; h.time = f.time || '';
      h.options = String(f.options || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);
      if (f.goal !== undefined) h.goal = Math.max(1, Math.min(7, Number(f.goal) || 3));
      if (f.target !== undefined) h.target = Math.max(2, Math.min(50, Number(f.target) || 8));
      if (f.goal === undefined && f.target === undefined) { const days = [0, 1, 2, 3, 4, 5, 6].filter(d => f['d' + d] !== undefined); h.days = days; }
      rd.edit = null;
    },
  },
});
