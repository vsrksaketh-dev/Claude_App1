// Pure helpers: dates, formatting, ids. No app state in here.
export const pad = n => String(n).padStart(2, '0');
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dateKey(new Date());
export const parse = k => new Date(k + 'T00:00:00');
export const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return dateKey(d); };
export const daysFromToday = k => Math.round((parse(k) - parse(today())) / 864e5);
export const lastDays = n => Array.from({ length: n }, (_, i) => addDays(today(), -(n - 1 - i)));
export const dow = k => parse(k).getDay();                       // 0 = Sunday
export const weekStart = (k = today()) => addDays(k, -((parse(k).getDay() + 6) % 7)); // Monday
export const dayOfYear = () => Math.floor((parse(today()) - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
export const pick = (arr, offset = 0) => arr[(dayOfYear() + offset) % arr.length];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 9);
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
export const fmtDay = k => parse(k).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtClock = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
export const until = iso => {
  const ms = new Date(iso) - Date.now();
  if (ms < 0) return 'passed';
  const h = Math.floor(ms / 36e5);
  return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + 'm' : h < 48 ? h + 'h' : Math.floor(h / 24) + 'd';
};
// "in 25 min", "in 3 h", "in 2 d" (or "now" once it has started). Used by the countdown on Home.
export const countdownText = ms => { const d = ms - Date.now(); if (d <= 0) return 'now'; if (d < 36e5) return 'in ' + Math.max(1, Math.round(d / 6e4)) + ' min'; if (d < 864e5) return 'in ' + Math.floor(d / 36e5) + ' h' + (Math.round(d / 6e4) % 60 >= 15 ? ' ' + (Math.round(d / 6e4) % 60) + ' min' : ''); return 'in ' + Math.round(d / 864e5) + ' d'; };
export const clock12 = ms => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
export const rot = (arr, key) => arr[Math.abs([...String(key)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % arr.length];   // a steady choice per key, so copy varies by day but never flickers
// Does an event typed into the app happen on day k? Handles repeats: daily, weekdays, weekly (same weekday), monthly (same date).
export const EV_REPEATS = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'Every week'], ['monthly', 'Every month']];
export function occursOn(e, k) {
  if (!e.repeat) return e.date === k;
  if (k < e.date || (e.until && k > e.until) || (e.skip || []).includes(k)) return false;
  const d = parse(k).getDay();
  if (e.repeat === 'daily') return true;
  if (e.repeat === 'weekdays') return d > 0 && d < 6;
  if (e.repeat === 'weekly') return d === parse(e.date).getDay();
  if (e.repeat === 'monthly') return k.slice(8) === e.date.slice(8);
  return e.date === k;
}
