// Domain logic over the state. Kept free of HTML so it is easy to test and reuse.
import { S, app } from './core.js';
import { today, addDays, dow, lastDays, daysFromToday, weekStart, parse, dateKey } from './util.js';

// ---- habits ----
// A habit is one of three kinds, all stored the same way (extra fields are optional, so old habits keep working):
//  - fixed days: days = [0..6], done or not each scheduled day            ("Skin care every morning")
//  - weekly goal: goal = N, any days, N days a week counts as a win       ("Gym 5 times a week")
//  - counter: target = N, tap to count up to N in a day                   ("Water, 8 glasses")
// habitLog[date][id] stays a plain true/false (so streaks and widgets are unchanged); habitInfo[date][id] = { n, tag } holds the count and what was done.
export const habitGoal = h => h.goal || 0;
export const habitTarget = h => Math.max(1, h.target || 1);
export const habitScheduled = (h, k) => !h.archived && h.created <= k && (habitGoal(h) > 0 || h.days.includes(dow(k)));
export const habitDone = (h, k) => !!(S.habitLog[k] || {})[h.id];
export const habitInfo = (h, k) => (S.habitInfo[k] || {})[h.id] || {};
export const habitCount = (h, k) => habitDone(h, k) ? Math.max(habitInfo(h, k).n || 0, habitTarget(h)) : (habitInfo(h, k).n || 0);
const weekDays = k => { const m = weekStart(k); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); };
export const habitWeek = (h, k = today()) => weekDays(k).map(d => ({ k: d, done: habitDone(h, d), future: d > today(), today: d === today(), off: d < h.created || (!habitGoal(h) && !h.days.includes(dow(d))) }));
export const weekDone = (h, k = today()) => weekDays(k).filter(d => habitDone(h, d)).length;
// Fixed-day habits are due on their days; weekly-goal habits are due until the week's goal is met (and stay visible once done today).
export const habitDue = (h, k) => habitScheduled(h, k) && (!habitGoal(h) || weekDone(h, k) < habitGoal(h) || habitDone(h, k));
export const habitsOn = k => S.habits.filter(h => habitDue(h, k));
// "2/5" for a weekly goal, "3/8" for a counter, "" for a plain daily habit
export const habitLabel = (h, k = today()) => habitGoal(h) ? `${weekDone(h, k)}/${habitGoal(h)}` : habitTarget(h) > 1 ? `${habitCount(h, k)}/${habitTarget(h)}` : '';
export function setHabit(h, k, n, tag) {
  const day = (S.habitInfo[k] ||= {}), info = (day[h.id] ||= {});
  info.n = Math.max(0, Math.min(habitTarget(h), n));
  const done = info.n >= habitTarget(h);
  if (tag !== undefined) info.tag = tag;
  if (!done) delete info.tag;
  if (!info.n && !info.tag) delete day[h.id];
  (S.habitLog[k] ||= {})[h.id] = done;
  return done;
}
// A tap: counters step up and wrap to zero after the target; everything else flips done and not done.
export function tapHabit(h, k) {
  if (habitTarget(h) > 1 && !habitDone(h, k)) return setHabit(h, k, habitCount(h, k) + 1);
  return setHabit(h, k, habitDone(h, k) ? 0 : habitTarget(h));
}
// Flip a day done or not done outright (used from the week dots and the widgets).
export const toggleHabit = (h, k) => setHabit(h, k, habitDone(h, k) ? 0 : habitTarget(h));
export const habitRate = k => { const hs = S.habits.filter(h => !habitGoal(h) && habitScheduled(h, k)); return hs.length ? hs.filter(h => habitDone(h, k)).length / hs.length : null; };
// Streak: days in a row for a fixed habit, weeks in a row that met the goal for a weekly one. Today never breaks it.
export function habitStreak(h) {
  let n = 0;
  if (habitGoal(h)) {
    for (let i = 0; i < 80; i++) {
      const k = addDays(today(), -7 * i);
      if (weekStart(k) < weekStart(h.created)) break;
      if (weekDone(h, k) >= habitGoal(h)) n++; else if (i > 0) break;
    }
    return n;
  }
  for (let i = 0; i < 400; i++) {
    const k = addDays(today(), -i);
    if (k < h.created) break;
    if (!habitScheduled(h, k)) continue;
    if (habitDone(h, k)) n++; else if (i > 0) break;
  }
  return n;
}
export const streakText = h => { const n = habitStreak(h); return n < 2 ? '' : habitGoal(h) ? `${n} week streak` : `${n} day streak`; };
export const habitRateOver = (h, days) => {
  const ks = lastDays(days).filter(k => habitScheduled(h, k));
  return ks.length >= 3 ? ks.filter(k => habitDone(h, k)).length / ks.length : null;   // too little history to judge
};
// What was done this week, by type: "Push x2, Legs x1" (only for habits that keep a type).
export function weekTags(h, k = today()) {
  const c = {};
  weekDays(k).forEach(d => { const t = habitInfo(h, d).tag; if (t && habitDone(h, d)) c[t] = (c[t] || 0) + 1; });
  return Object.entries(c).map(([t, n]) => `${t} x${n}`).join(', ');
}
// Goals met per week for the last n weeks, newest last: [{ k, n, goal }]
export const weekHistory = (h, n = 6) => Array.from({ length: n }, (_, i) => { const k = addDays(today(), -7 * (n - 1 - i)); return { k: weekStart(k), n: weekDone(h, k), goal: habitGoal(h) || h.days.length }; });
// A day counts toward the streak when at least 80% of its fixed-day habits are done. Days with none are skipped.
export function dayStreak() {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const r = habitRate(addDays(today(), -i));
    if (r === null) continue;
    if (r >= 0.8) n++; else if (i > 0) break;
  }
  return n;
}

// ---- tasks ----
export const taskQuadrant = t => ((t.due && daysFromToday(t.due) <= 2) ? 'U' : '') + (t.important ? 'I' : '');
export const openTasks = () => [...S.tasks.filter(t => !t.done), ...app.taskSources.flatMap(f => f())];
// How urgent a task is, lowest first: overdue, due today, due within two days, important with a date, important, dated, the rest.
export const taskRank = t => {
  const n = t.due ? daysFromToday(t.due) : null;
  if (n !== null && n < 0) return 0;
  if (n === 0) return 1;
  if (n !== null && n <= 2) return 2;
  if (t.important) return n !== null ? 3 : 4;
  return n !== null ? 5 : 6;
};
export const byRank = (a, b) => (taskRank(a) - taskRank(b)) || (a.due || '9').localeCompare(b.due || '9');
// Tasks ticked today stay on the list (at the bottom) so a slip of the finger can be undone.
export const doneToday = () => S.tasks.filter(t => t.done && t.doneAt === today());
// Undone first, done last; otherwise the order it came in.
export const doneLast = (list, isDone) => [...list.filter(x => !isDone(x)), ...list.filter(isDone)];
export function uncompleteTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t || !t.done) return;
  if (t.doneAt && S.stats.tasksDone[t.doneAt]) S.stats.tasksDone[t.doneAt] = Math.max(0, S.stats.tasksDone[t.doneAt] - 1);
  t.done = false;
  delete t.doneAt;
}
// A repeating task is never "done": ticking it counts, then moves its date to the next time it is due.
export const REPEATS = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'Every week'], ['monthly', 'Every month']];
const stepDate = (k, r) => {
  if (r === 'weekly') return addDays(k, 7);
  if (r === 'monthly') { const d = parse(k); d.setMonth(d.getMonth() + 1); return dateKey(d); }
  let n = addDays(k, 1);
  if (r === 'weekdays') while ([0, 6].includes(dow(n))) n = addDays(n, 1);
  return n;
};
export function nextDue(t) { let d = t.due || today(); for (let i = 0; i < 400; i++) { d = stepDate(d, t.repeat); if (d > today()) break; } return d; }
export function completeTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  if (t.repeat) { t.due = nextDue(t); S.stats.tasksDone[today()] = (S.stats.tasksDone[today()] || 0) + 1; return; }
  t.done = true;
  t.doneAt = today();
  S.stats.tasksDone[today()] = (S.stats.tasksDone[today()] || 0) + 1;
}

// ---- practice streak (Learn > Cases) ----
// A day counts when a written approach of at least 20 characters was saved for that day's problem (keys look like "2026-11-04:5").
export const practiceDays = () => new Set(Object.entries(S.guess).filter(([k, g]) => k.includes(':') && ((g && g.text) || '').trim().length >= 20).map(([k]) => k.slice(0, 10)));
export function practiceStreak() {
  const d = practiceDays();
  let n = 0;
  for (let i = 0; i < 400; i++) { if (d.has(addDays(today(), -i))) n++; else if (i > 0) break; }
  return n;
}

// ---- today's ring: what was finished against what is due today or late ----
export function dayProgress() {
  const t = today();
  const done = doneToday().length;
  const due = openTasks().filter(x => x.due && x.due <= t).length;
  return { done, due, total: done + due, pct: done + due ? done / (done + due) : 0 };
}
