// The weekly recap shown on Home on Sundays and Mondays: what got done, how many sessions happened, what is coming.
import { S } from './core.js';
import { today, addDays, lastDays, fmtDay, parse } from './util.js';
import { agendaOn } from './agenda.js';
import { practiceDays } from './logic.js';

export function weekRecap() {
  const days = lastDays(7);
  const tasks = days.reduce((a, k) => a + (S.stats.tasksDone[k] || 0), 0);
  const best = days.map(k => [k, S.stats.tasksDone[k] || 0]).reduce((a, b) => b[1] > a[1] ? b : a, [days[0], 0]);
  const now = Date.now();
  const sessions = days.reduce((a, k) => a + agendaOn(k).filter(e => e.kind === 'event' && !e.allDay && e.end < now).length, 0);
  const practice = days.filter(k => practiceDays().has(k)).length;
  const habitDays = days.reduce((a, k) => a + Object.values(S.habitLog[k] || {}).filter(Boolean).length, 0);
  const notes = S.pages.filter(n => !n.trashed && n.at >= parse(days[0]).getTime()).length;
  const ahead = [1, 2, 3, 4, 5, 6, 7].reduce((a, i) => a + agendaOn(addDays(today(), i)).filter(e => e.kind === 'due' || e.kind === 'action').length, 0);
  const aheadTasks = S.tasks.filter(t => !t.done && t.due && t.due > today() && t.due <= addDays(today(), 7)).length;
  return { tasks, bestDay: best[1] ? fmtDay(best[0]) : '', bestN: best[1], sessions, practice, notes, habitDays, ahead: ahead + aheadTasks };
}
export const isRecapDay = () => { const d = new Date().getDay(); return d === 0 || d === 1; };
