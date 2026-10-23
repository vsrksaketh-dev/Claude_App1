// Builds a real widget snapshot from the running app, for the JVM widget test. Usage: node snap.cjs <playwright> <out.json> [port]
const { chromium } = require(process.argv[2]);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:'+(process.argv[4]||8123)+'/'); await p.waitForSelector('h1');
  await p.evaluate(async () => {
    const c = await import('/js/core.js'); const u = await import('/js/util.js'); const t = u.today();
    c.S.tasks.push({ id: 'a1', title: 'Marketing case submission', due: u.addDays(t, 1), important: true, done: false, kind: 'Submission' });
    c.S.tasks.push({ id: 'a2', title: 'Call placement cell', due: t, important: true, done: false, kind: 'Task' });
    c.S.tasks.push({ id: 'a3', title: 'Read the HR chapter', important: false, done: false, kind: 'Task' });
    c.S.events.push({ id: 'e1', title: 'Team sync', date: t, time: '23:30' }); c.S.events.push({ id: 'e3', title: 'Fest day', date: u.addDays(t, 2), time: '' });
    const day = (n, h, m, len, title) => { const d = u.parse(u.addDays(t, n)); d.setHours(h, m, 0, 0); return { start: d.getTime(), end: d.getTime() + len * 6e4, title, allDay: false, where: 'CR 4' }; };
    localStorage.setItem('daily-driver-cal-sources', JSON.stringify([{ id: 's1', name: 'GIM', url: 'https://x.test/a.ics' }]));
    localStorage.setItem('daily-driver-cal-cache', JSON.stringify({ s1: { at: Date.now(), error: '', events: [
      day(0, 23, 45, 20, 'Late class'), day(1, 15, 45, 75, 'DTS · Session 13'), day(1, 11, 29, 30, 'Due: Infosys application'), day(2, 9, 0, 60, 'Action: Pre-placement talk'),
      day(40, 10, 0, 60, 'Far away event'),
      { start: u.parse(t).getTime(), end: u.parse(u.addDays(t, 1)).getTime(), title: 'Mail: Placement Chair · EY feedback', allDay: true, where: '', desc: 'Engage seriously. Added from email.' } ] } }));
    c.commit();
  });
  await p.reload(); await p.waitForSelector('h1');
  const snap = await p.evaluate(async () => { const w = await import('/js/widgets.js'); return JSON.stringify(w.buildSnapshot()); });
  require('fs').writeFileSync(process.argv[3], snap);
  console.log('snapshot bytes', snap.length, 'cal items', JSON.parse(snap).cal.length);
  await b.close();
})();
