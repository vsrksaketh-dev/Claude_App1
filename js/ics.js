// Minimal iCalendar (ICS) reader: events, time zones, all-day events and the common recurrence rules.
// Pure module, no app state. parseICS(text, windowStartMs, windowEndMs) returns every event instance in the window.

const WIN_TZ = { 'India Standard Time': 'Asia/Kolkata', 'UTC': 'UTC', 'Greenwich Standard Time': 'UTC', 'Eastern Standard Time': 'America/New_York', 'Pacific Standard Time': 'America/Los_Angeles', 'GMT Standard Time': 'Europe/London' };
const DOWS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const unfold = text => text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
const unescapeText = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function parseLine(line) {
  let q = false, i = -1;
  for (let k = 0; k < line.length; k++) { if (line[k] === '"') q = !q; else if (line[k] === ':' && !q) { i = k; break; } }
  if (i < 0) return null;
  const [name, ...ps] = line.slice(0, i).split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const params = {};
  ps.forEach(p => { const [k, v] = p.split('='); if (k) params[k.toUpperCase()] = (v || '').replace(/^"|"$/g, ''); });
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

// ---- time helpers ----
const dtfCache = {};
function tzOffsetMs(ms, tz) {
  const f = (dtfCache[tz] ||= new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  const o = {}; f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
  return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - Math.floor(ms / 1000) * 1000;
}
function zonedToMs(y, mo, d, h, mi, s, tz) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let g = wall;
  for (let i = 0; i < 2; i++) g = wall - tzOffsetMs(g, tz);
  return g;
}
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 864e5);
const civil = n => { const dt = new Date(n * 864e5); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() }; };
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function parseValue(value, params) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (m[4] === undefined) return { allDay: true, y, mo, d, h: 0, mi: 0, s: 0 };
  let tz = m[7] ? 'UTC' : (params.TZID ? (WIN_TZ[params.TZID] || params.TZID) : null);
  if (tz) { try { tzOffsetMs(0, tz); } catch { tz = null; } }
  return { allDay: false, y, mo, d, h: +m[4], mi: +m[5], s: +m[6], tz };
}
const toMs = p => p.allDay ? new Date(p.y, p.mo - 1, p.d).getTime() : p.tz ? zonedToMs(p.y, p.mo, p.d, p.h, p.mi, p.s, p.tz) : new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s).getTime();
function parseDuration(v) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * 864e5) + ((+m[3] || 0) * 864e5) + ((+m[4] || 0) * 36e5) + ((+m[5] || 0) * 6e4) + ((+m[6] || 0) * 1e3);
  return m[1] === '-' ? -ms : ms;
}

// ---- recurrence ----
function parseRule(v) {
  const r = {};
  v.split(';').forEach(kv => { const [k, val] = kv.split('='); if (k) r[k.toUpperCase()] = val; });
  return {
    freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1), count: r.COUNT ? +r.COUNT : 0, until: r.UNTIL || '',
    byday: r.BYDAY ? r.BYDAY.split(',').map(t => { const m = t.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: m[1] ? +m[1] : 0, dow: DOWS.indexOf(m[2]) } : null; }).filter(Boolean) : [],
    bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [],
    bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number) : [],
  };
}
function nthMatch(byday, c) {
  const nth = Math.ceil(c.d / 7), fromEnd = Math.floor((daysIn(c.y, c.m) - c.d) / 7) + 1;
  return byday.some(b => b.dow === c.dow && (b.n === 0 || b.n === nth || b.n === -fromEnd));
}
function ruleMatches(r, dn, s) {
  const c = civil(dn);
  switch (r.freq) {
    case 'DAILY': return (dn - s.dn) % r.interval === 0;
    case 'WEEKLY': {
      const ws = n => n - ((civil(n).dow + 6) % 7);
      if (((ws(dn) - ws(s.dn)) / 7) % r.interval !== 0) return false;
      return (r.byday.length ? r.byday.map(b => b.dow) : [s.c.dow]).includes(c.dow);
    }
    case 'MONTHLY': {
      if (((c.y - s.c.y) * 12 + (c.m - s.c.m)) % r.interval !== 0) return false;
      if (r.bymonthday.length) return r.bymonthday.some(x => x === c.d || (x < 0 && daysIn(c.y, c.m) + x + 1 === c.d));
      if (r.byday.length) return nthMatch(r.byday, c);
      return c.d === s.c.d;
    }
    case 'YEARLY': {
      if ((c.y - s.c.y) % r.interval !== 0) return false;
      if (!(r.bymonth.length ? r.bymonth : [s.c.m]).includes(c.m)) return false;
      if (r.bymonthday.length) return r.bymonthday.includes(c.d);
      if (r.byday.length) return nthMatch(r.byday, c);
      return c.d === s.c.d;
    }
    default: return false;
  }
}

// ---- parsing ----
function readEvents(text) {
  const out = [];
  let cur = null, alarm = 0, calName = '';
  for (const raw of unfold(text)) {
    const l = parseLine(raw); if (!l) continue;
    if (l.name === 'BEGIN' && l.value === 'VEVENT') { cur = { ex: [] }; continue; }
    if (l.name === 'BEGIN' && l.value === 'VALARM') { alarm++; continue; }
    if (l.name === 'END' && l.value === 'VALARM') { alarm--; continue; }
    if (l.name === 'END' && l.value === 'VEVENT') { if (cur && cur.start) out.push(cur); cur = null; continue; }
    if (l.name === 'X-WR-CALNAME' && !cur) calName = unescapeText(l.value);
    if (!cur || alarm) continue;
    switch (l.name) {
      case 'UID': cur.uid = l.value; break;
      case 'SUMMARY': cur.title = unescapeText(l.value); break;
      case 'LOCATION': cur.where = unescapeText(l.value); break;
      case 'DESCRIPTION': cur.desc = unescapeText(l.value).slice(0, 300); break;
      case 'STATUS': cur.cancelled = l.value.toUpperCase() === 'CANCELLED'; break;
      case 'DTSTART': cur.start = parseValue(l.value, l.params); break;
      case 'DTEND': cur.end = parseValue(l.value, l.params); break;
      case 'DURATION': cur.dur = parseDuration(l.value); break;
      case 'RRULE': cur.rule = parseRule(l.value); break;
      case 'EXDATE': l.value.split(',').forEach(v => { const p = parseValue(v, l.params); if (p) cur.ex.push(toMs(p)); }); break;
      case 'RECURRENCE-ID': cur.recId = parseValue(l.value, l.params); break;
    }
  }
  return { events: out, name: calName };
}

export function parseICS(text, winStart, winEnd) {
  const { events, name } = readEvents(text);
  const instances = [];
  const overrideKeys = new Set();
  events.filter(e => e.recId).forEach(e => overrideKeys.add(`${e.uid}|${toMs(e.recId)}`));

  const push = (e, startMs, endMs) => {
    if (endMs <= winStart && !(endMs === startMs && startMs >= winStart)) return;
    if (startMs >= winEnd) return;
    instances.push({ uid: e.uid || '', title: e.title || '(No title)', where: e.where || '', desc: e.desc || '', allDay: e.start.allDay, start: startMs, end: endMs });
  };
  const span = e => {   // [startMs, durationMs] for the first occurrence
    const s = toMs(e.start);
    if (e.end) return [s, Math.max(0, toMs(e.end) - s)];
    if (e.dur) return [s, e.dur];
    return [s, e.start.allDay ? 864e5 : 0];
  };

  for (const e of events) {
    if (e.cancelled) continue;
    const [s0, dur] = span(e);
    if (!e.rule || e.recId) { push(e, s0, s0 + dur); continue; }
    const sc = e.start, dn0 = dayNum(sc.y, sc.mo, sc.d);
    const S = { dn: dn0, c: civil(dn0) };
    const limitDn = dayNum(new Date(winEnd).getFullYear(), new Date(winEnd).getMonth() + 1, new Date(winEnd).getDate()) + 2;
    const lowDn = dayNum(new Date(winStart).getFullYear(), new Date(winStart).getMonth() + 1, new Date(winStart).getDate()) - 3;
    const untilP = e.rule.until ? parseValue(e.rule.until.length === 8 ? e.rule.until : e.rule.until, {}) : null;
    const untilMs = untilP ? (untilP.allDay ? toMs(untilP) + 864e5 - 1 : toMs(untilP)) : 0;
    let n = 0;
    for (let dn = dn0; dn <= limitDn; dn++) {
      if (!ruleMatches(e.rule, dn, S)) continue;
      n++;
      if (e.rule.count && n > e.rule.count) break;
      if (dn < lowDn) continue;
      const c = civil(dn);
      const startMs = sc.allDay ? new Date(c.y, c.m - 1, c.d).getTime()
        : sc.tz ? zonedToMs(c.y, c.m, c.d, sc.h, sc.mi, sc.s, sc.tz) : new Date(c.y, c.m - 1, c.d, sc.h, sc.mi, sc.s).getTime();
      if (untilMs && startMs > untilMs) break;
      if (e.ex.includes(startMs) || overrideKeys.has(`${e.uid}|${startMs}`)) continue;
      push(e, startMs, startMs + dur);
    }
  }
  instances.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  return { name, events: instances };
}

// Instances overlapping the local calendar day dateKey (YYYY-MM-DD).
export function eventsOnDay(events, dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const a = new Date(y, m - 1, d).getTime(), b = new Date(y, m - 1, d + 1).getTime();
  return events.filter(e => e.end > a && e.start < b || (e.end === e.start && e.start >= a && e.start < b));
}
