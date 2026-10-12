// Body trackers: workout log and calorie intake. Both live inside Track.
import { S, register, remove } from '../core.js';
import { today, lastDays, fmtDay, esc, uid } from '../util.js';
import { field, empty, chip, bar, barChart } from '../ui.js';

const WORKOUTS = ['Gym', 'Run', 'Walk', 'Cycle', 'Yoga', 'Sport', 'Other'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const kcalOn = k => S.meals.filter(m => m.date === k).reduce((a, m) => a + m.kcal, 0);
const minOn = k => S.workouts.filter(w => w.date === k).reduce((a, w) => a + w.min, 0);

export function workoutView() {
  const days = lastDays(7), t = today();
  const week = S.workouts.filter(w => days.includes(w.date));
  const active = days.filter(k => minOn(k) > 0).length;
  const recent = [...S.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const dots = lastDays(28).map(k => `<i class="h${minOn(k) ? 4 : 0}" title="${k}"></i>`).join('');
  return `<div class="stack">
  <div class="card"><h2>This week</h2><div class="tiles three"><div class="tile"><b>${week.length}</b><span>Sessions</span></div><div class="tile"><b>${active}/7</b><span>Active days</span></div><div class="tile"><b>${week.reduce((a, w) => a + w.min, 0)}m</b><span>Total time</span></div></div>
    <div><div class="dots">${dots}</div><p class="muted" style="margin-top:8px">Last 4 weeks. Filled means you moved that day.</p></div></div>
  <div class="card"><h2>Log a workout</h2><form data-form="workout" class="stackform">
    <div class="inline"><label>Type<select name="type">${WORKOUTS.map(w => `<option>${w}</option>`).join('')}</select></label>${field('Minutes', 'min', 'type="number" min="1" max="600" required')}</div>
    ${field('Note', 'note', 'placeholder="Chest day, 4 x 8 bench, 5 km easy..."')}${field('Date', 'date', `type="date" value="${t}" max="${t}" required`)}
    <button class="primary">Log workout</button></form></div>
  <div class="card"><h2>Recent</h2>${recent.length ? `<ul class="list">${recent.map(w => `<li><div class="grow"><span class="title">${esc(w.type)}</span> ${chip(w.min + ' min')}<div class="muted">${fmtDay(w.date)}${w.note ? ' · ' + esc(w.note) : ''}</div></div><button class="ghost danger" data-act="delWorkout" data-id="${w.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : empty('Nothing logged yet. Even a 10 minute walk counts.')}</div></div>`;
}

export function foodView() {
  const t = today(), goal = S.calGoal, eaten = kcalOn(t), left = goal - eaten;
  const todays = S.meals.filter(m => m.date === t);
  const pts = lastDays(7).map(k => ({ label: fmtDay(k), value: kcalOn(k), title: `${fmtDay(k)}: ${kcalOn(k)} kcal` }));
  return `<div class="stack">
  <div class="card"><h2>Today</h2><p><span class="big">${eaten}</span> <span class="muted">of ${goal} kcal · ${left >= 0 ? left + ' left' : chip(-left + ' over', 'bad')}</span></p>${bar(goal ? eaten / goal * 100 : 0, left < 0)}
    <form data-form="calGoal" class="inline">${field('Daily goal (kcal)', 'goal', `type="number" min="800" max="6000" value="${goal}" required`)}<button>Set</button></form></div>
  <div class="card"><h2>Add food</h2><form data-form="meal" class="stackform">
    <div class="inline"><label>Meal<select name="meal">${MEALS.map(m => `<option>${m}</option>`).join('')}</select></label>${field('Calories', 'kcal', 'type="number" min="1" max="5000" required')}</div>
    ${field('What did you eat?', 'name', 'required maxlength="80"')}<button class="primary">Add</button></form></div>
  <div class="card"><h2>Eaten today</h2>${todays.length ? MEALS.filter(m => todays.some(x => x.meal === m)).map(m => `<h3>${m} ${chip(todays.filter(x => x.meal === m).reduce((a, x) => a + x.kcal, 0) + ' kcal', 'plain')}</h3><ul class="list">${todays.filter(x => x.meal === m).map(x => `<li><span class="grow title">${esc(x.name)}</span>${chip(x.kcal + ' kcal', 'plain')}<button class="ghost danger" data-act="delMeal" data-id="${x.id}" aria-label="Delete">×</button></li>`).join('')}</ul>`).join('') : empty('Nothing logged yet today.')}</div>
  <div class="card"><h2>Last 7 days</h2>${barChart(pts, { max: Math.max(goal, ...pts.map(p => p.value)), unit: ' kcal', summary: 'Calories eaten per day over a week' })}</div></div>`;
}

register({
  id: 'body', label: 'Body', section: true,
  actions: { delWorkout: d => remove('workouts', d.id), delMeal: d => remove('meals', d.id) },
  forms: {
    workout: f => S.workouts.push({ id: uid(), date: f.date, type: f.type, min: Number(f.min), note: (f.note || '').trim() }),
    meal: f => S.meals.push({ id: uid(), date: today(), meal: f.meal, name: f.name.trim(), kcal: Number(f.kcal) }),
    calGoal: f => { S.calGoal = Number(f.goal) || S.calGoal; },
  },
});
