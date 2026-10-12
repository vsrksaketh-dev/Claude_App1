// Unit tests for the ICS reader. Run: node tests/ics.test.mjs
process.env.TZ = 'Asia/Kolkata';   // the user's zone; expectations below are written in it
import assert from 'node:assert/strict';
import { parseICS, eventsOnDay } from '../js/ics.js';

const cal = body => `BEGIN:VCALENDAR\r\nX-WR-CALNAME:Test\r\n${body}END:VCALENDAR\r\n`;
const ev = lines => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT\r\n`;
const W0 = Date.UTC(2026, 9, 1), W1 = Date.UTC(2026, 11, 1);       // Oct 1 to Dec 1 2026
const iso = ms => new Date(ms).toISOString();
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log('PASS', name); };

t('timed UTC event, unfolded line, escaped text', () => {
  const r = parseICS(cal(ev(['UID:a', 'DTSTART:20261012T090000Z', 'DTEND:20261012T101500Z', 'SUMMARY:Marketing\\, case\\nstudy', 'LOCATION:CR-1 and', ' more'])), W0, W1);
  assert.equal(r.name, 'Test'); assert.equal(r.events.length, 1);
  assert.equal(r.events[0].title, 'Marketing, case\nstudy'); assert.equal(r.events[0].where, 'CR-1 andmore');
  assert.equal(iso(r.events[0].start), '2026-10-12T09:00:00.000Z'); assert.equal(r.events[0].end - r.events[0].start, 75 * 6e4);
});
t('TZID Asia/Kolkata converts to the right instant', () => {
  const r = parseICS(cal(ev(['UID:b', 'DTSTART;TZID=Asia/Kolkata:20261012T165000', 'DTEND;TZID=Asia/Kolkata:20261012T180000', 'SUMMARY:Deloitte talk'])), W0, W1);
  assert.equal(iso(r.events[0].start), '2026-10-12T11:20:00.000Z');
});
t('all-day event spans local days with exclusive end', () => {
  const r = parseICS(cal(ev(['UID:c', 'DTSTART;VALUE=DATE:20261020', 'DTEND;VALUE=DATE:20261022', 'SUMMARY:Fest'])), W0, W1);
  assert.equal(eventsOnDay(r.events, '2026-10-20').length, 1); assert.equal(eventsOnDay(r.events, '2026-10-21').length, 1); assert.equal(eventsOnDay(r.events, '2026-10-22').length, 0);
});
t('weekly BYDAY with EXDATE and COUNT', () => {
  const r = parseICS(cal(ev(['UID:d', 'DTSTART;TZID=Asia/Kolkata:20261005T090000', 'DTEND;TZID=Asia/Kolkata:20261005T101500', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6', 'EXDATE;TZID=Asia/Kolkata:20261007T090000', 'SUMMARY:Class'])), W0, W1);
  const days = r.events.map(e => new Date(e.start).toLocaleDateString('en-CA'));
  assert.deepEqual(days, ['2026-10-05', '2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21']);   // Mon/Wed x6 = 5,7,12,14,19,21 minus the excluded 7th
});
t('daily with INTERVAL and UNTIL', () => {
  const r = parseICS(cal(ev(['UID:e', 'DTSTART:20261001T060000Z', 'DTEND:20261001T063000Z', 'RRULE:FREQ=DAILY;INTERVAL=3;UNTIL=20261010T000000Z', 'SUMMARY:Run'])), W0, W1);
  assert.deepEqual(r.events.map(e => iso(e.start).slice(0, 10)), ['2026-10-01', '2026-10-04', '2026-10-07']);
});
t('monthly second Tuesday and last Friday', () => {
  const a = parseICS(cal(ev(['UID:f', 'DTSTART:20260908T040000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU', 'SUMMARY:Board'])), W0, W1);
  assert.deepEqual(a.events.map(e => iso(e.start).slice(0, 10)), ['2026-10-13', '2026-11-10']);
  const b = parseICS(cal(ev(['UID:g', 'DTSTART:20260925T040000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR', 'SUMMARY:Review'])), W0, W1);
  assert.deepEqual(b.events.map(e => iso(e.start).slice(0, 10)), ['2026-10-30', '2026-11-27']);
});
t('yearly birthday all-day', () => {
  const r = parseICS(cal(ev(['UID:h', 'DTSTART;VALUE=DATE:20000315', 'RRULE:FREQ=YEARLY', 'SUMMARY:Bday'])), Date.UTC(2027, 2, 1), Date.UTC(2027, 3, 1));
  assert.equal(r.events.length, 1); assert.equal(new Date(r.events[0].start).getDate(), 15);
});
t('RECURRENCE-ID override moves one instance and cancelled one is dropped', () => {
  const r = parseICS(cal(
    ev(['UID:i', 'DTSTART;TZID=Asia/Kolkata:20261005T090000', 'DTEND;TZID=Asia/Kolkata:20261005T100000', 'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Sync']) +
    ev(['UID:i', 'RECURRENCE-ID;TZID=Asia/Kolkata:20261012T090000', 'DTSTART;TZID=Asia/Kolkata:20261012T140000', 'DTEND;TZID=Asia/Kolkata:20261012T150000', 'SUMMARY:Sync (moved)']) +
    ev(['UID:i', 'RECURRENCE-ID;TZID=Asia/Kolkata:20261019T090000', 'DTSTART;TZID=Asia/Kolkata:20261019T090000', 'STATUS:CANCELLED', 'SUMMARY:Sync'])), W0, W1);
  assert.deepEqual(r.events.map(e => e.title + '@' + iso(e.start).slice(5, 16)), ['Sync@10-05T03:30', 'Sync (moved)@10-12T08:30', 'Sync@10-26T03:30']);
});
t('recurring in a DST zone keeps the wall-clock time', () => {
  const r = parseICS(cal(ev(['UID:j', 'DTSTART;TZID=America/New_York:20261026T090000', 'DTEND;TZID=America/New_York:20261026T100000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:NY call'])), W0, W1);
  assert.deepEqual(r.events.map(e => iso(e.start).slice(0, 16)), ['2026-10-26T13:00', '2026-11-02T14:00', '2026-11-09T14:00']);   // clocks fall back on 1 Nov 2026
});
t('events outside the window and cancelled events are ignored', () => {
  const r = parseICS(cal(ev(['UID:k', 'DTSTART:20250101T090000Z', 'DTEND:20250101T100000Z', 'SUMMARY:Old']) + ev(['UID:l', 'DTSTART:20261012T090000Z', 'STATUS:CANCELLED', 'SUMMARY:Gone'])), W0, W1);
  assert.equal(r.events.length, 0);
});
t('VALARM inside an event does not leak fields', () => {
  const r = parseICS(cal(ev(['UID:m', 'DTSTART:20261012T090000Z', 'DTEND:20261012T100000Z', 'SUMMARY:Real', 'BEGIN:VALARM', 'SUMMARY:Alarm', 'TRIGGER:-PT15M', 'END:VALARM'])), W0, W1);
  assert.equal(r.events[0].title, 'Real');
});
t('DESCRIPTION is kept for filtering', () => {
  const r = parseICS(cal(ev(['UID:n', 'DTSTART:20261012T090000Z', 'DTEND:20261012T100000Z', 'SUMMARY:Friend class', 'DESCRIPTION:Hrithika\'s class (not mine) \\, Sec C'])), W0, W1);
  assert.match(r.events[0].desc, /not mine/);
});
console.log(`${pass} passed`);
