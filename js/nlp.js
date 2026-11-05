// Natural-language quick add: "Submit DHRM fri 5pm !" -> { title: 'Submit DHRM', due: <next Friday>, time: '17:00', important: true }.
// Understands: today, tonight, tomorrow (tmr, tmrw), weekday names (next mon), "in 3 days / 2 weeks", dates like 13 nov, nov 13, 13/11,
// times like 5pm, 5:30 pm, 17:00, at 9, noon; repeats: daily, every day, weekdays, weekly, every monday, monthly; "!" marks priority.
// Pure: pass `now` for tests.
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const dayIdx = w => DAYS.indexOf(w.slice(0, 3));
const monIdx = w => MONTHS.indexOf(w.slice(0, 3));
const WD = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MO = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

export function parseQuick(input, now = new Date()) {
  let t = ' ' + String(input || '') + ' ';
  const out = { title: '', due: '', time: '', important: false, repeat: '' };
  const take = (re, fn) => { const m = t.match(re); if (!m) return false; const r = fn(m); if (r === false) return false; t = t.replace(m[0], ' '); return true; };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  take(/\s!{1,3}(?=\s)/, () => { out.important = true; });
  take(/\s(?:every\s?day|daily)(?=\s)/i, () => { out.repeat = 'daily'; });
  take(/\s(?:every\s)?weekdays?(?=\s)/i, () => { out.repeat = 'weekdays'; });
  take(/\s(?:every\s?month|monthly)(?=\s)/i, () => { out.repeat = 'monthly'; });
  take(new RegExp(`\\severy\\s${WD}(?=\\s)`, 'i'), m => { out.repeat = 'weekly'; const want = dayIdx(m[1].toLowerCase()); out.due = key(plus(today, (want - today.getDay() + 7) % 7)); });
  take(/\s(?:every\s?week|weekly)(?=\s)/i, () => { out.repeat = 'weekly'; });

  // time
  take(/\s(?:at\s)?(\d{1,2})(?::|\.)(\d{2})\s?(am|pm)?(?=\s)/i, m => { let h = +m[1]; const mi = +m[2]; if (h > 23 || mi > 59) return false; if (m[3]) { h = h % 12 + (/pm/i.test(m[3]) ? 12 : 0); } out.time = `${pad(h)}:${pad(mi)}`; })
    || take(/\s(?:at\s)?(\d{1,2})\s?(am|pm)(?=\s)/i, m => { const h = +m[1]; if (h < 1 || h > 12) return false; out.time = `${pad(h % 12 + (/pm/i.test(m[2]) ? 12 : 0))}:00`; })
    || take(/\s(?:at\s)?noon(?=\s)/i, () => { out.time = '12:00'; })
    || take(/\sat\s(\d{1,2})(?=\s)/i, m => { let h = +m[1]; if (h > 23) return false; if (h >= 1 && h <= 7) h += 12; out.time = `${pad(h)}:00`; });

  // date ("fri" is the coming Friday, today if it is Friday; "next fri" is the one after)
  const setDue = d => { out.due = key(d); };
  if (!out.due) {
    take(/\s(?:on\s|by\s)?(?:today|tod)(?=\s)/i, () => setDue(today))
      || take(/\s(?:on\s|by\s)?tonight(?=\s)/i, () => { setDue(today); if (!out.time) out.time = '20:00'; })
      || take(/\s(?:on\s|by\s)?(?:tomorrow|tmrw?|tom)(?=\s)/i, () => setDue(plus(today, 1)))
      || take(/\sin\s(\d{1,3})\s(day|days|week|weeks)(?=\s)/i, m => setDue(plus(today, +m[1] * (/week/i.test(m[2]) ? 7 : 1))))
      || take(new RegExp(`\\s(?:on\\s|by\\s)?(next\\s)?${WD}(?=\\s)`, 'i'), m => { const n = (dayIdx(m[2].toLowerCase()) - today.getDay() + 7) % 7; setDue(plus(today, m[1] ? n + 7 : n)); })
      || take(new RegExp(`\\s(?:on\\s|by\\s)?(\\d{1,2})(?:st|nd|rd|th)?\\s${MO}(?=\\s)`, 'i'), m => { const d = new Date(today.getFullYear(), monIdx(m[2].toLowerCase()), +m[1]); if (d < today) d.setFullYear(d.getFullYear() + 1); setDue(d); })
      || take(new RegExp(`\\s(?:on\\s|by\\s)?${MO}\\s(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), m => { const d = new Date(today.getFullYear(), monIdx(m[1].toLowerCase()), +m[2]); if (d < today) d.setFullYear(d.getFullYear() + 1); setDue(d); })
      || take(/\s(?:on\s|by\s)?(\d{1,2})\/(\d{1,2})(?=\s)/, m => { const dd = +m[1], mm = +m[2]; if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false; const d = new Date(today.getFullYear(), mm - 1, dd); if (d < today) d.setFullYear(d.getFullYear() + 1); setDue(d); });
  }
  if (out.time && !out.due) out.due = key(today);
  if (out.repeat && !out.due) out.due = key(today);
  out.title = t.replace(/\s+/g, ' ').replace(/\s(?:at|on|by|due)\s*$/i, '').trim();
  return out;
}
// "Fri 6 Nov · 5:00 pm · Priority · repeats weekly" for the preview under the add box.
export function describe(p) {
  const parts = [];
  if (p.due) { const [y, m, d] = p.due.split('-').map(Number); parts.push(new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })); }
  if (p.time) { const [h, mi] = p.time.split(':').map(Number); parts.push(`${h % 12 || 12}:${pad(mi)} ${h < 12 ? 'am' : 'pm'}`); }
  if (p.important) parts.push('Priority');
  if (p.repeat) parts.push('repeats ' + p.repeat);
  return parts.join(' · ');
}
