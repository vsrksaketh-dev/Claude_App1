// Colour from the data: each course keeps the colour its classes have in Google Calendar (set by the class-timetable routine),
// deadlines are red, to-dos amber, tasks the accent. Other events get a steady colour from their name.
const COURSES = [
  [/^\s*DHRM\b|digital hr/i, '#3F51B5'],                 // Blueberry
  [/^\s*(NM\b|neuro)/i, '#8E24AA'],                       // Grape
  [/^\s*(PerM|PERMGT)\b|performance (and|&) reward/i, '#D50000'],   // Tomato
  [/^\s*(EE&EB|EEEB)\b|employee experience/i, '#E4A11B'], // Banana, a shade deeper so it reads on paper
  [/^\s*DTS\b|digital transformation/i, '#0B8043'],      // Basil
];
const OTHERS = ['#039BE5', '#7986CB', '#33B679', '#E67C73', '#F4511E', '#616161', '#795548', '#009688'];
const KIND = { due: '#C23B31', action: '#D9822B', mail: '#8C919A', task: 'var(--accent)', exam: '#C23B31' };
export const courseOf = title => { const t = String(title || ''); const m = t.match(/^\s*([A-Za-z&]{2,8})\s*[·:-]/); return m ? m[1].toUpperCase() : ''; };
export function colorFor(item) {
  if (item.kind && item.kind !== 'event') return KIND[item.kind] || 'var(--accent)';
  const t = String(item.title || '');
  for (const [re, c] of COURSES) if (re.test(t)) return c;
  let h = 7; for (const ch of t.split(/[·:]/)[0].trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return OTHERS[h % OTHERS.length];
}
// A class from the timetable: "CODE · Subject" or "CODE · Session 20".
export const isClass = item => item.kind === 'event' && /^\s*[A-Za-z&]{2,8}\s*·/.test(item.title || '') && !item.allDay;
