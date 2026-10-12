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
