// Domain logic over the state. Kept free of HTML so it is easy to test and reuse.
import { S, app } from './core.js';
import { today, addDays, dow, lastDays, daysFromToday } from './util.js';

// ---- habits ----
export const habitScheduled = (h, k) => !h.archived && h.created <= k && h.days.includes(dow(k));
export const habitsOn = k => S.habits.filter(h => habitScheduled(h, k));
export const habitDone = (h, k) => !!(S.habitLog[k] || {})[h.id];
export const habitRate = k => { const hs = habitsOn(k); return hs.length ? hs.filter(h => habitDone(h, k)).length / hs.length : null; };
export function habitStreak(h) {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const k = addDays(today(), -i);
    if (k < h.created) break;
    if (!habitScheduled(h, k)) continue;
    if (habitDone(h, k)) n++; else if (i > 0) break;
  }
  return n;
}
export const habitRateOver = (h, days) => {
  const ks = lastDays(days).filter(k => habitScheduled(h, k));
  return ks.length >= 3 ? ks.filter(k => habitDone(h, k)).length / ks.length : null;   // too little history to judge
};
// A day counts toward the streak when at least 80% of its scheduled habits are done. Days with none scheduled are skipped.
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
export function completeTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  t.done = true;
  t.doneAt = today();
  S.stats.tasksDone[today()] = (S.stats.tasksDone[today()] || 0) + 1;
}
