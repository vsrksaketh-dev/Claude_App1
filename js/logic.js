// Domain logic over the state. Kept free of HTML so it is easy to test and reuse.
import { S, app } from './core.js';
import { today, addDays, dow, lastDays, daysFromToday, weekStart, avg, uid } from './util.js';
import { DAILY_FIVE } from './data.js';

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
export const openTasks = () => [...S.tasks.filter(t => !t.done && !t.triage), ...app.taskSources.flatMap(f => f())];
export function completeTask(id) {
  const t = S.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  t.done = true;
  t.doneAt = today();
  S.stats.tasksDone[today()] = (S.stats.tasksDone[today()] || 0) + 1;
}

// ---- learning ----
export const learnCount = k => DAILY_FIVE.filter(([key]) => (S.learnDone[k] || {})[key]).length;
export function learnStreak() {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (learnCount(addDays(today(), -i)) >= 3) n++; else if (i > 0) break;
  }
  return n;
}
export const dueCards = () => S.cards.filter(c => c.due <= today()).sort((a, b) => (a.seen || 0) - (b.seen || 0));
export function newCard(front, back, deck = 'General') {
  if (S.cards.some(c => c.front === front)) return false;
  S.cards.push({ id: uid(), front, back, deck, due: today(), interval: 0, ease: 2.5, reps: 0, seen: 0 });
  return true;
}
// q: 0 again, 1 hard, 2 good, 3 easy. Simplified SM-2.
export function rateCard(c, q) {
  c.seen = Date.now();
  if (q === 0) { c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, c.ease - 0.2); c.due = today(); }
  else {
    c.reps += 1;
    if (q === 1) { c.ease = Math.max(1.3, c.ease - 0.15); c.interval = Math.max(1, Math.round((c.interval || 1) * 1.2)); }
    else if (q === 2) c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(c.interval * c.ease);
    else { c.ease += 0.15; c.interval = c.reps === 1 ? 3 : Math.round(Math.max(c.interval, 1) * c.ease * 1.3); }
    c.due = addDays(today(), c.interval);
  }
  S.stats.cardsReviewed[today()] = (S.stats.cardsReviewed[today()] || 0) + 1;
}

// ---- focus ----
export const focusOn = k => S.focus[k] || 0;
export const focusOver = days => lastDays(days).reduce((a, k) => a + focusOn(k), 0);

// ---- weekly summary used by Review and Insights ----
export function weekSummary(start = weekStart()) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter(k => k <= today());
  const rates = days.map(habitRate).filter(r => r !== null);
  const moods = days.map(k => S.journal[k]?.mood).filter(Boolean);
  const energy = days.map(k => S.journal[k]?.energy).filter(Boolean);
  return {
    days: days.length,
    habitPct: rates.length ? Math.round(avg(rates) * 100) : null,
    focusMin: days.reduce((a, k) => a + focusOn(k), 0),
    tasks: days.reduce((a, k) => a + (S.stats.tasksDone[k] || 0), 0),
    learnDays: days.filter(k => learnCount(k) >= 3).length,
    cards: days.reduce((a, k) => a + (S.stats.cardsReviewed[k] || 0), 0),
    journalDays: days.filter(k => S.journal[k]).length,
    mood: moods.length ? avg(moods) : null,
    energy: energy.length ? avg(energy) : null,
  };
}

// ---- goals ----
export const goalProgress = g => g.milestones.length ? Math.round(g.milestones.filter(m => m.done).length / g.milestones.length * 100) : 0;
