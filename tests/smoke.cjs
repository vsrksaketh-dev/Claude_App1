// End-to-end smoke test. Usage: node tests/smoke.cjs <path-to-playwright> [port]
// Serves nothing itself: start `python3 -m http.server <port>` in the repo root first.
const { chromium } = require(process.argv[2]);
const fs = require('fs'), path = require('path');
const port = process.argv[3] || 8123;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://localhost:${port}/`); await p.waitForSelector('h1');
  const view = () => p.textContent('#view');
  const nav = n => p.click(`#nav [data-nav=${n}]`);

  ok('news shows on Today', /Riyadh airport/.test(await view()));

  // Today: capture, triage, top 3, habits, daily five
  await p.fill('[data-form=quick] [name=text]', 'Prepare marketing case'); await p.click('[data-form=quick] button');
  ok('captured item shows nudge', /1 captured item/.test(await view()));
  await nav('plan');
  ok('triage card present', /Sort what you captured/.test(await view()));
  await p.fill('[data-form=triage] [name=due]', new Date().toISOString().slice(0, 10)); await p.check('[data-form=triage] [name=important]'); await p.click('[data-form=triage] button.primary');
  ok('sorted task lands in Do first', /Prepare marketing case/.test(await p.textContent('.matrix > div:first-child')));
  await nav('today');
  await p.selectOption('[data-form=mit] [name=task]', { index: 1 }); await p.click('[data-form=mit] button');
  await p.click('[data-act=mitDone]');
  ok('top 3 done updates tile', /1\/1\s*Top 3/.test((await view()).replace(/\s+/g, ' ')) || /1\/1/.test(await p.textContent('.tiles')));
  await nav('plan');
  ok('completing a top-3 task completes the task', await p.locator('.matrix li', { hasText: 'Prepare marketing case' }).count() === 0);
  await nav('today');
  await p.click('.card:has(h2:has-text("Habits")) [data-act=habit] >> nth=0');
  await p.click('[data-act=learnTick][data-key=guess]'); await p.click('[data-act=learnTick][data-key=framework]'); await p.click('[data-act=learnTick][data-key=jargon]');
  ok('learning streak starts', /1 day streak/.test(await p.textContent('.card:has(h2:has-text("Daily five"))')));

  // Plan: goal with milestone and habit link
  await nav('plan'); await p.click('[data-act=sub][data-id=goals]');
  await p.fill('[data-form=goal] [name=title]', 'Land a marketing role'); await p.click('[data-form=goal] button.primary');
  await p.fill('[data-form=milestone] [name=text]', 'Finish CV'); await p.click('[data-form=milestone] button');
  await p.click('[data-act=msDone]');
  ok('goal progress 100%', /100%/.test(await view()));

  // Learn: flashcard from framework, review
  await nav('learn'); await p.click('[data-act=addCard][data-kind=framework]');
  await p.click('[data-act=sub][data-id=review]'); ok('card due', /1 due/.test(await view()));
  await p.click('[data-act=flip]'); await p.click('[data-act=rate][data-q="2"]');
  ok('card scheduled out', /0 due/.test(await view()));
  await p.click('[data-act=sub][data-id=library]'); await p.fill('[data-form=lib] [name=title]', 'Thinking, Fast and Slow'); await p.selectOption('[data-form=lib] [name=status]', 'Reading'); await p.click('[data-form=lib] button.primary');
  await p.fill('[data-form=libNote] [name=text]', 'System 1 vs 2'); await p.click('[data-form=libNote] button');
  ok('library note saved', /System 1 vs 2/.test(await view()));
  await p.click('[data-act=sub][data-id=log]'); await p.fill('[data-form=til] [name=text]', 'Inversion helps planning'); await p.click('[data-form=til] button');
  ok('til logged', /Inversion helps planning/.test(await view()));

  // Growth: new habit, journal, review, insights
  await nav('growth');
  await p.fill('[data-form=habit] [name=name]', 'Workout'); await p.click('[data-form=habit] button.primary');
  ok('habit added', /Workout/.test(await view()));
  await p.click('[data-act=sub][data-id=journal]'); await p.click('[data-act=jScale][data-field=mood][data-v="4"]');
  await p.fill('[data-bind=journal][data-field=tomorrow]', 'Write cover letter\nGym'); await p.click('[data-act=setTomorrow]');
  await p.click('[data-act=sub][data-id=review]'); ok('weekly stats render', /Tasks done/.test(await view()));
  await p.fill('[data-bind=review][data-field=focus]', 'Ship the CV');
  await p.click('[data-act=sub][data-id=insights]'); ok('insights render', /Deep work/.test(await view()));

  // More: focus timer, money, career module toggle, settings
  await nav('more'); await p.click('[data-act=timerStart]'); await p.waitForTimeout(700); await p.click('[data-act=timerPause]');
  await p.click('[data-act=sub][data-id=money]'); await p.fill('[data-form=expense] [name=amount]', '250'); await p.click('[data-form=expense] button.primary');
  ok('expense logged', /₹250/.test(await view()));
  await p.click('[data-act=sub][data-id=career]'); await p.fill('[data-form=app] [name=company]', 'Acme'); await p.click('[data-form=app] button.primary');
  ok('career board', /Acme/.test(await view()));
  await p.click('[data-act=sub][data-id=settings]'); await p.click('[data-act=module][data-id=career]');
  ok('career module hides', await p.locator('[data-act=sub][data-id=career]').count() === 0);

  // Reminders: settings form saves, and the built list has the daily pair plus deadline and flashcard items
  await nav('plan'); await p.click('[data-act=sub][data-id=tasks]');
  const tomorrow = new Date(Date.now() + 36 * 36e5).toISOString().slice(0, 10);
  await p.fill('[data-form=task] [name=title]', 'Marketing exam'); await p.fill('[data-form=task] [name=due]', tomorrow); await p.click('[data-form=task] button.primary');
  await nav('more'); await p.click('[data-act=sub][data-id=settings]');
  await p.check('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  const list = await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().map(n => n.title));
  ok('daily morning and evening reminders', list.includes('Plan your day') && list.includes('Close the day'));
  ok('deadline reminder for the exam', list.some(t => t === 'Due tomorrow' || t === 'Due today'));
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('daily-driver-v2')); });
  await p.click('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  ok('reminders off builds nothing', (await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().length)) === 0);

  // Calendar sync: connect an ICS feed, see its events, change the feed, sync, and see the change
  const tmp = path.join(__dirname, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = title => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Test cal',
    'BEGIN:VEVENT', 'UID:t1', 'DTSTART:' + stamp(Date.now() + 3 * 36e5), 'DTEND:' + stamp(Date.now() + 4 * 36e5), 'SUMMARY:' + title, 'LOCATION:Room 7', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:t3', 'DTSTART:' + stamp(Date.now() + 5 * 36e5), 'DTEND:' + stamp(Date.now() + 6 * 36e5), 'SUMMARY:Friend class', 'DESCRIPTION:Not mine - friend', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:t2', 'DTSTART;VALUE=DATE:' + new Date().toLocaleDateString('en-CA').replace(/-/g, ''), 'SUMMARY:Fest day', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  fs.writeFileSync(path.join(tmp, 'cal.ics'), ics('Calendar sync works'));
  await nav('more'); await p.click('[data-act=sub][data-id=settings]');
  await p.fill('[data-form=calAdd] [name=name]', 'Test cal'); await p.fill('[data-form=calAdd] [name=url]', `http://localhost:${port}/tests/.tmp/cal.ics`); await p.click('[data-form=calAdd] button.primary');
  await p.waitForSelector('text=3 events synced');
  await nav('today');
  ok('calendar event shows on Today', /Calendar sync works/.test(await view()) && /Room 7/.test(await view()) && /Fest day/.test(await view()));
  ok('events marked not mine are hidden', !/Friend class/.test(await view()));
  fs.writeFileSync(path.join(tmp, 'cal.ics'), ics('Calendar sync updated'));
  await p.click('[data-act=calSync]'); await p.waitForSelector('text=Calendar sync updated');
  ok('edit in the calendar reflects after sync', !/Calendar sync works/.test(await view()));
  await nav('more'); await p.click('[data-act=sub][data-id=settings]');
  await p.check('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  const rem = await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().map(n => n.title));
  ok('calendar event gets a reminder', rem.includes('Calendar sync updated'));
  await p.click('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  ok('calendar link is not in the backup data', !(await p.evaluate(() => localStorage.getItem('daily-driver-v2'))).includes('tests/.tmp'));
  await p.click('[data-act=calRemove]'); await nav('today');
  ok('removing the calendar removes its events', !/Calendar sync updated/.test(await view()));

  // Persistence and migration from v1
  await p.reload(); await p.waitForSelector('h1'); await nav('growth');
  ok('data persists after reload', /Workout/.test(await view()));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem('daily-driver-v1', JSON.stringify({ routineItems: [{ id: 'r1', label: 'Old habit' }], routineLog: {}, deadlines: [{ id: 'd1', title: 'Old exam', date: '2030-01-01', kind: 'Exam' }], tasks: [], apps: [], contacts: [], stars: [], subs: [], expenses: [], budget: 0 })); });
  const q = await ctx.newPage(); await q.goto(`http://localhost:${port}/`); await q.waitForSelector('h1');
  await q.click('#nav [data-nav=today]'); ok('v1 habits migrated', /Old habit/.test(await q.textContent('#view')));
  await q.click('#nav [data-nav=plan]'); ok('v1 deadlines became tasks', /Old exam/.test(await q.textContent('#view')));
  ok('no console errors', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
