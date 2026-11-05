// Exams and attendance. Exams: { id, subject, date, time, where, topics: [{ id, x, d }] } in S.exams, each with a revision checklist.
// Attendance: S.attend[title|start] = 'y' (attended) or 'n' (missed), marked on past classes from the calendar.
import { S } from './core.js';
import { today, addDays, daysFromToday, parse } from './util.js';
import { agendaOn } from './agenda.js';
import { courseOf, colorFor, isClass } from './colors.js';

export const attendKey = e => `${e.title}|${e.start}`;
export const attendOf = e => S.attend[attendKey(e)] || '';
export const minAttend = () => Number(S.study?.minAttend) || 75;

// Per course over the last 120 days: classes held so far, how many marked attended or missed, and the percentage of the marked ones.
export function courseStats() {
  const now = Date.now(), by = {};
  for (let i = -120; i <= 0; i++) {
    agendaOn(addDays(today(), i)).filter(e => isClass(e) && e.start < now).forEach(e => {
      const code = courseOf(e.title) || e.title; const c = (by[code] ||= { code, color: colorFor(e), held: 0, y: 0, n: 0, name: e.title.split('·')[0].trim() });
      c.held++; const a = attendOf(e); if (a === 'y') c.y++; if (a === 'n') c.n++;
    });
  }
  return Object.values(by).map(c => ({ ...c, pct: c.y + c.n ? Math.round(100 * c.y / (c.y + c.n)) : null, unmarked: c.held - c.y - c.n })).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
}

export const upcomingExams = () => S.exams.filter(x => x.date >= today()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
export const examDays = x => daysFromToday(x.date);
export const topicsLeft = x => (x.topics || []).filter(t => !t.d).length;
// How many revision topics to clear today so every paper is covered the day before it: the busiest pace across exams.
export function dailyTarget() {
  let need = 0;
  upcomingExams().forEach(x => { const left = topicsLeft(x), days = Math.max(1, examDays(x)); need = Math.max(need, Math.ceil(left / days)); });
  const sum = upcomingExams().reduce((a, x) => a + topicsLeft(x), 0);
  return { perDay: need, left: sum };
}
export const examsOn = k => S.exams.filter(x => x.date === k);
// Monday of a week, for the weekly review.
export const mondayOf = k => { const d = parse(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
