import { S, ui, register, byId, remove } from '../core.js';
import { today, addDays, lastDays, dow, esc, uid, fmtDay, weekStart, avg, parse } from '../util.js';
import { field, empty, chip, bar, tabs, subOf, barChart, heatmap, head } from '../ui.js';
import { focusView } from '../sections/focus.js';
import { moneyView } from '../sections/money.js';
import { workoutView, foodView } from '../sections/body.js';
import { REFLECTION_PROMPTS } from '../data.js';
import { habitsOn, learnCount, habitRate, habitDone, habitStreak, habitRateOver, habitScheduled, weekSummary, focusOn } from '../logic.js';
import { pick } from '../util.js';

const TABS = [['trackers', 'Trackers'], ['mind', 'Focus and journal'], ['review', 'Review']];
const trackerTabs = () => [['habits', 'Habits'], ...(S.modules.money ? [['money', 'Money']] : []), ['workout', 'Workouts'], ['food', 'Food']];
const MIND = [['focus', 'Focus'], ['journal', 'Journal']];
// A second row of pills inside a tab.
const pills = (group, items) => { const cur = subOf(group, items); return `<div class="seg pills" role="tablist">${items.map(([id, l]) => `<button role="tab" aria-selected="${cur === id}" class="${cur === id ? 'on' : ''}" data-act="sub" data-group="${group}" data-id="${id}">${l}</button>`).join('')}</div>`; };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOODS = ['1', '2', '3', '4', '5'];
const pct = r => r === null ? '–' : Math.round(r * 100) + '%';
const level = r => r === null || r === 0 ? 0 : Math.ceil(r * 4);

function dayTiles() {
  const hs = habitsOn(today()), hd = hs.filter(h => habitDone(h, today())).length;
  const tile = (n, l) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="card"><h2>Today so far</h2><div class="tiles">${tile(`${hd}/${hs.length}`, 'Habits')}${tile(`${S.tasks.filter(x => x.doneAt === today()).length}`, 'Tasks done')}${tile(`${focusOn(today())}m`, 'Focus')}${tile(`${learnCount(today())}/5`, 'Learn')}</div></div>`;
}

function habitsTab() {
  const days = lastDays(84);
  const startPad = (parse(days[0]).getDay() + 6) % 7;
  const active = S.habits.filter(h => !h.archived), archived = S.habits.filter(h => h.archived);
  return `${dayTiles()}
  <div class="card"><h2>Last 12 weeks</h2>${heatmap(days.map(k => ({ date: k, level: level(habitRate(k)) })), startPad)}<p class="muted">Darker means more of that day's habits done. Columns are weeks, Monday at top.</p></div>
  <div class="card"><h2>Your habits</h2>${active.length ? `<ul class="list">${active.map(h => {
    const dots = lastDays(14).map(k => `<i class="h${!habitScheduled(h, k) ? '-1' : habitDone(h, k) ? 4 : 0}" title="${k}"></i>`).join('');
    return `<li style="flex-wrap:wrap"><div class="grow"><span class="title">${esc(h.name)}</span> ${chip(esc(h.when), 'plain')} ${habitStreak(h) ? chip(habitStreak(h) + 'd') : ''}
      <div class="muted">${h.days.length === 7 ? 'Every day' : h.days.map(d => DAYS[d]).join(', ')} · 30 days ${pct(habitRateOver(h, 30))}</div><div class="dots">${dots}</div></div>
      <button class="ghost" data-act="habitArchive" data-id="${h.id}">Archive</button></li>`; }).join('')}</ul>` : empty('No habits yet. Add the few things you want to be true every day.')}</div>
  <div class="card"><h2>New habit</h2><form data-form="habit">${field('Habit', 'name', 'required placeholder="e.g. 20 minutes of reading"')}
    <label>When<select name="when"><option value="morning">Morning</option><option value="anytime" selected>Anytime</option><option value="evening">Evening</option></select></label>
    <div class="row">${DAYS.map((d, i) => `<label class="check"><input type="checkbox" name="d${i}" checked> ${d}</label>`).join('')}</div><button class="primary">Add habit</button></form></div>
  ${archived.length ? `<details class="card"><summary>Archived (${archived.length})</summary><ul class="list">${archived.map(h => `<li><span class="grow">${esc(h.name)}</span><button class="ghost" data-act="habitArchive" data-id="${h.id}">Restore</button><button class="ghost danger" data-act="habitDel" data-id="${h.id}">Delete</button></li>`).join('')}</ul></details>` : ''}`;
}

function journalTab() {
  const k = ui.sub.jDate || today();
  const j = S.journal[k] || {};
  const area = (f, label, ph) => `<label>${label}<textarea data-bind="journal" data-date="${k}" data-field="${f}" placeholder="${ph}">${esc(j[f])}</textarea></label>`;
  const scale = (f, items) => `<div class="row">${items.map((x, i) => `<button class="${j[f] === i + 1 ? 'primary' : ''}" data-act="jScale" data-date="${k}" data-field="${f}" data-v="${i + 1}" aria-label="${f} ${i + 1}">${x}</button>`).join('')}</div>`;
  const past = Object.keys(S.journal).filter(d => d !== k).sort().reverse().slice(0, 14);
  return `<div class="card"><div class="row between"><button class="ghost" data-act="jDate" data-d="-1" aria-label="Previous day">←</button><h2 style="margin:0">${k === today() ? 'Today' : fmtDay(k)}</h2><button class="ghost" data-act="jDate" data-d="1" ${k >= today() ? 'disabled' : ''} aria-label="Next day">→</button></div>
    <p class="quote">${esc(pick(REFLECTION_PROMPTS, parse(k).getDate()))}</p>
    <h3>Mood</h3>${scale('mood', MOODS)}<h3>Energy</h3>${scale('energy', ['1', '2', '3', '4', '5'])}
    ${area('wins', 'What went well', 'Small wins count')}${area('lessons', 'What I would do differently', 'One honest line')}${area('grateful', 'Grateful for', '')}${area('tomorrow', 'To do tomorrow (one per line)', 'Each line becomes a task')}
    <button class="primary" data-act="setTomorrow" data-date="${k}">Add these to my tasks</button><p class="muted">Saved as you type.</p></div>
  ${past.length ? `<details class="card"><summary>Recent entries (${past.length})</summary><ul class="list">${past.map(d => `<li><div class="grow"><span class="title">${fmtDay(d)}</span> ${S.journal[d].mood ? 'mood ' + S.journal[d].mood : ''}<div class="muted">${esc((S.journal[d].wins || S.journal[d].lessons || '').slice(0, 140))}</div></div><button class="ghost" data-act="jOpen" data-date="${d}">Open</button></li>`).join('')}</ul></details>` : ''}`;
}

function reviewTab() {
  const ws = ui.sub.rWeek || weekStart();
  const sm = weekSummary(ws), r = S.reviews[ws] || {};
  const tile = (n, l) => `<div class="tile"><b>${n}</b><span>${l}</span></div>`;
  const area = (f, label, ph) => `<label>${label}<textarea data-bind="review" data-week="${ws}" data-field="${f}" placeholder="${ph}">${esc(r[f])}</textarea></label>`;
  const pastWeeks = Object.keys(S.reviews).filter(w => w !== ws).sort().reverse().slice(0, 8);
  return `<div class="card"><div class="row between"><button class="ghost" data-act="rWeek" data-d="-7" aria-label="Previous week">←</button><h2 style="margin:0">Week of ${fmtDay(ws)}</h2><button class="ghost" data-act="rWeek" data-d="7" ${ws >= weekStart() ? 'disabled' : ''} aria-label="Next week">→</button></div>
    <div class="tiles">${tile(sm.habitPct === null ? '–' : sm.habitPct + '%', 'Habits')}${tile((sm.focusMin / 60).toFixed(1) + 'h', 'Focus')}${tile(sm.tasks, 'Tasks done')}${tile(sm.learnDays + '/' + sm.days, 'Learn days')}</div>
    <p class="muted">${sm.cards} flashcards reviewed · ${sm.journalDays} reflections${sm.mood ? ` · mood ${sm.mood.toFixed(1)}/5` : ''}${sm.energy ? ` · energy ${sm.energy.toFixed(1)}/5` : ''}</p>
    ${area('well', 'What went well this week', '')}${area('improve', 'What to improve', '')}${area('focus', 'My focus for next week', 'One or two things')}<p class="muted">Saved as you type.</p></div>
  ${pastWeeks.length ? `<details class="card"><summary>Past reviews</summary><ul class="list">${pastWeeks.map(w => `<li><div class="grow"><span class="title">Week of ${fmtDay(w)}</span><div class="muted">${esc((S.reviews[w].focus || S.reviews[w].well || '').slice(0, 140))}</div></div><button class="ghost" data-act="rOpen" data-week="${w}">Open</button></li>`).join('')}</ul></details>` : ''}`;
}

function insightsTab() {
  const days = lastDays(30);
  const habitPts = days.map(k => ({ label: fmtDay(k), value: (habitRate(k) ?? 0) * 100, title: `${fmtDay(k)}: ${pct(habitRate(k))}` }));
  const focusPts = days.map(k => ({ label: fmtDay(k), value: focusOn(k), title: `${fmtDay(k)}: ${focusOn(k)} min` }));
  const taskPts = days.map(k => ({ label: fmtDay(k), value: S.stats.tasksDone[k] || 0, title: `${fmtDay(k)}: ${S.stats.tasksDone[k] || 0} tasks` }));
  const moodPts = days.map(k => ({ label: fmtDay(k), value: S.journal[k]?.mood || 0, title: `${fmtDay(k)}: mood ${S.journal[k]?.mood || 'not logged'}` }));
  const notes = [];
  const hs = S.habits.filter(h => !h.archived);
  const rated = hs.map(h => [h, habitRateOver(h, 30), lastDays(30).filter(k => habitScheduled(h, k)).length]).filter(x => x[1] !== null && x[2] >= 7);
  if (rated.length > 1) {
    const best = rated.reduce((a, b) => b[1] > a[1] ? b : a), worst = rated.reduce((a, b) => b[1] < a[1] ? b : a);
    notes.push(`Strongest habit: ${esc(best[0].name)} (${pct(best[1])}). Weakest: ${esc(worst[0].name)} (${pct(worst[1])}).`);
  }
  const byDow = Array.from({ length: 7 }, (_, d) => avg(lastDays(84).filter(k => dow(k) === d).map(habitRate).filter(r => r !== null)));
  if (S.habits.length && byDow.some(v => v > 0)) { const worstDay = byDow.map((v, d) => [v, d]).reduce((a, b) => b[0] < a[0] ? b : a); notes.push(`Your habits slip most on ${DAYS[worstDay[1]]}s (${pct(worstDay[0])}). Plan around it.`); }
  const hi = days.filter(k => (habitRate(k) ?? 0) >= 0.8 && S.journal[k]?.mood).map(k => S.journal[k].mood);
  const lo = days.filter(k => habitRate(k) !== null && habitRate(k) < 0.8 && S.journal[k]?.mood).map(k => S.journal[k].mood);
  if (hi.length >= 3 && lo.length >= 3) notes.push(`Mood averages ${avg(hi).toFixed(1)} on days you hit your habits, ${avg(lo).toFixed(1)} on days you do not.`);
  const total = days.reduce((a, k) => a + focusOn(k), 0);
  notes.push(`${(total / 60).toFixed(1)} hours of deep work in 30 days.`);
  return `<div class="card"><h2>Insights, last 30 days</h2><ul class="list">${notes.map(n => `<li>${n}</li>`).join('')}</ul></div>
  <div class="card"><h2>Habit completion</h2>${barChart(habitPts, { max: 100, unit: '%', summary: 'Daily habit completion over 30 days' })}</div>
  <div class="card"><h2>Deep work (minutes)</h2>${barChart(focusPts, { unit: ' min', summary: 'Daily focus minutes over 30 days' })}</div>
  <div class="card"><h2>Tasks completed</h2>${barChart(taskPts, { max: Math.max(3, ...taskPts.map(p => p.value)), summary: 'Tasks completed per day over 30 days' })}</div>
  <div class="card"><h2>Mood</h2>${barChart(moodPts, { max: 5, summary: 'Daily mood from your journal over 30 days' })}<p class="muted">Empty bars are days you did not log.</p></div>`;
}

function trackersTab() {
  const items = trackerTabs(), cur = subOf('trk', items);
  const page = { habits: habitsTab, money: moneyView, workout: workoutView, food: foodView }[items.some(i => i[0] === cur) ? cur : 'habits']();
  return `${pills('trk', items)}${page}`;
}
function mindTab() { return `${pills('mind', MIND)}${subOf('mind', MIND) === 'journal' ? journalTab() : focusView()}`; }
function reviewAll() { return `${reviewTab()}<h2 class="section-h">Your trends</h2>${insightsTab()}`; }

function render() {
  const sub = subOf('track', TABS);
  return `${head('Track', 'Habits, body, focus and how you are doing.')}${tabs('track', TABS)}<div class="stack">${{ trackers: trackersTab, mind: mindTab, review: reviewAll }[sub]()}</div>`;
}

const entry = k => (S.journal[k] ||= {});

register({
  id: 'track', label: 'Track', nav: 4, render,
  actions: {
    habitArchive: d => { const h = byId(S.habits, d.id); h.archived = !h.archived; },
    habitDel: d => { remove('habits', d.id); S.goals.forEach(g => { g.habitIds = (g.habitIds || []).filter(x => x !== d.id); }); },
    jScale: d => { const e = entry(d.date); e[d.field] = e[d.field] === Number(d.v) ? 0 : Number(d.v); },
    jDate: d => { const k = addDays(ui.sub.jDate || today(), Number(d.d)); ui.sub.jDate = k > today() ? today() : k; },
    jOpen: d => { ui.sub.jDate = d.date; },
    setTomorrow: d => {
      const next = addDays(d.date, 1), lines = (S.journal[d.date]?.tomorrow || '').split('\n').map(x => x.trim()).filter(Boolean);
      lines.forEach(text => { if (!S.tasks.some(t => !t.done && t.title === text)) S.tasks.push({ id: uid(), title: text, due: next, important: true, done: false, kind: 'Task' }); });
    },
    rWeek: d => { const w = addDays(ui.sub.rWeek || weekStart(), Number(d.d)); ui.sub.rWeek = w > weekStart() ? weekStart() : w; },
    rOpen: d => { ui.sub.rWeek = d.week; },
  },
  forms: {
    habit: f => S.habits.push({ id: uid(), name: f.name.trim(), when: f.when, days: [0, 1, 2, 3, 4, 5, 6].filter(i => f['d' + i]), created: today() }),
  },
  inputs: {
    journal: el => { entry(el.dataset.date)[el.dataset.field] = el.value; },
    review: el => { (S.reviews[el.dataset.week] ||= {})[el.dataset.field] = el.value; },
  },
});
