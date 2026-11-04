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

  ok('home leads with the to-do list and the schedule, not news', /To do/.test(await view()) && /Today's schedule/.test(await view()) && !(await p.locator('.story').count()));
  ok('bottom bar has five tabs (Home, Tasks, Notes, Calendar, Learn) and no Track or Plan', (await p.locator('#nav button').count()) === 5 && (await p.locator('#nav [data-nav=plan]').count()) === 0 && (await p.locator('#nav [data-nav=track]').count()) === 0);
  ok('the page glass wash and frosted panes are on', await p.evaluate(() => !document.documentElement.hasAttribute('data-glass') && getComputedStyle(document.querySelector('.card')).backdropFilter !== 'none'));

  // Learn: News first (all categories), then Cases
  await nav('learn');
  ok('news shows in Learn, all categories first', await p.locator('.story').count() >= 1 && await p.locator('.tabs button.on:has-text("All")').count() === 1);
  ok('Learn has News and Cases only', (await p.locator('.stack > .tabs, #view > .tabs').first().locator('button').count()) === 2);
  await p.click('[data-act=newsCat][data-id=Tech]'); ok('a category filters the stories', (await p.locator('.story .chip:not(.plain)').allTextContents()).every(t => /Tech/.test(t)));
  await p.click('[data-act=sub][data-group=learn][data-id=cases]');
  ok('Cases opens on a practice problem', /Problem of the day/.test(await view()) && /The playbook/.test(await view()));
  await p.fill('[data-bind=guess]', 'Clarify, then split into people, process and pay'); await p.click('[data-act=reveal]');
  ok('the suggested approach appears and the answer is kept', /A structure/.test(await view()) && (await p.inputValue('[data-bind=guess]')).startsWith('Clarify'));
  await p.click('[data-act=sub][data-group=casepage][data-id=cases]'); ok('case library lists the cases', await p.locator('details.ref').count() >= 6 && /Microsoft/.test(await view()));
  await p.click('[data-act=sub][data-group=casepage][data-id=toolkit]'); ok('toolkit lists change frameworks', /Kotter/.test(await view()) && /ADKAR/.test(await view()));
  await p.click('[data-act=sub][data-group=casepage][data-id=tech]'); ok('HR tech map', /Workday/.test(await view()));
  await p.click('[data-act=sub][data-group=learn][data-id=news]');
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.app.news.items.forEach(n => { n.url = 'https://example.com/a'; }); c.render(); });
  ok('news with a link opens in a browser', await p.locator('a.storylink[target=_blank]').count() >= 1);
  await nav('home');

  // Home: one capture bar, a ranked to-do list, ticked rows sink
  await p.fill('[data-form=quick] [name=text]', 'Prepare marketing case'); await p.click('[data-form=quick] button');
  ok('captured task is on the to-do list at once', /Prepare marketing case/.test(await p.textContent('.card:has(h2:has-text("To do"))')));
  ok('the capture bar keeps the keyboard open', await p.evaluate(() => document.activeElement && document.activeElement.name === 'text'));
  await p.fill('[data-form=quick] [name=text]', 'Call the placement cell'); await p.click('[data-form=quick] button');
  await p.fill('[data-form=quick] [name=text]', 'Pack the laptop bag'); await p.click('[data-form=quick] button');
  const todoItems = () => p.locator('.card:has(h2:has-text("To do")) .list > li').allTextContents();
  await p.click('.card:has(h2:has-text("To do")) li:has-text("Call the placement cell") [data-act=taskDone]');
  const afterTick = await todoItems();
  ok('a ticked to-do stays, struck through, at the bottom', /Call the placement cell/.test(afterTick[afterTick.length - 1]) && await p.locator('.card:has(h2:has-text("To do")) li.done:has-text("Call the placement cell")').count() === 1);
  ok('the undone ones stay above it', afterTick.slice(0, -1).some(t => /Pack the laptop bag/.test(t)));
  await p.click('.card:has(h2:has-text("To do")) li.done:has-text("Call the placement cell") [data-act=taskUndo]');
  ok('unticking lifts it back up', await p.locator('.card:has(h2:has-text("To do")) li.done').count() === 0);
  await p.click('.card:has(h2:has-text("To do")) li:has-text("Call the placement cell") [data-act=taskDone]');
  await p.click('.card:has(h2:has-text("To do")) li:has-text("Pack the laptop bag") [data-act=taskDone]');
  ok('the hero counts what is done today', /2\s*done today/.test(await p.textContent('.hero')));
  ok('close the day and top 3 are gone', !/Close the day/.test(await view()) && !/Top 3/.test(await view()));
  ok('Needs your attention is hidden when nothing needs you', !/Needs your attention/.test(await view()));
  await p.click('.habit-chip [data-act=habit] >> nth=0');
  ok('habits are one tick-able strip', /1\/3 today/.test(await view()) && await p.locator('.habit-chip.done').count() === 1);

  // Plan: one list grouped by date
  await nav('tasks');
  ok('Tasks has no goals, applications, network or stories', !/Goals|Applications|Network|Stories/.test(await p.textContent('#nav') + await view()) && await p.locator('.matrix, .kanban').count() === 0);
  ok('captured tasks are listed under No date', /Prepare marketing case/.test(await p.textContent('h3.group-h:has-text("No date") + ul')));
  await p.fill('[data-form=task] [name=title]', 'Sheet task'); await p.selectOption('[data-form=task] [name=when]', '0'); await p.click('[data-form=task] button.primary');
  ok('a task due today lands under Today', /Sheet task/.test(await p.textContent('h3.group-h:has-text("Today") + ul')));
  await p.click('li:has-text("Sheet task") [data-act=taskStar]'); ok('priority toggles', await p.locator('li:has-text("Sheet task") .pri.on').count() === 1);
  ok('what was ticked today shows under Done today', /Call the placement cell/.test(await p.textContent('.card:has(h2:has-text("Done today"))')));

  // Notes: books, pages and the block editor
  await nav('notes');
  ok('Notes is its own tab with an empty state and starter books', /Nothing here yet/.test(await view()) && await p.locator('[data-act=bookStarter]').count() === 4);
  await p.fill('[data-form=jot] [name=text]', 'Idea: ask about change adoption metrics'); await p.click('[data-form=jot] button.primary');
  ok('a quick jot becomes a page in the Inbox', /change adoption metrics/.test(await view()) && /Inbox/.test(await p.textContent('.bookbar')));
  ok('the jot box keeps focus for the next one', await p.evaluate(() => document.activeElement && document.activeElement.name === 'text'));
  await p.click('[data-act=bookNew]'); await p.fill('[data-form=book] [name=name]', 'Interview prep'); await p.click('[data-form=book] button.primary');
  ok('a book can be created and opened', /Interview prep/.test(await p.textContent('.bookbar button.on')));
  await p.click('[data-act=pageNew]');
  ok('a new page opens in the editor inside the current book with the title focused', await p.locator('.pg-title').count() === 1 && await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('pg-title')) && (await p.inputValue('.pg-info select')) !== '');
  await p.fill('.pg-title', 'Deloitte HCOT questions');
  await p.click('.blk textarea'); await p.keyboard.type('- Why HCOT'); 
  ok('typing "- " turns the line into a bullet', await p.locator('.blk.t-b').count() === 1 && (await p.inputValue('.blk.t-b textarea')) === 'Why HCOT');
  await p.keyboard.type(' now'); await p.keyboard.press('Enter'); await p.keyboard.type('Case approach');
  ok('Enter continues the list with a new bullet', await p.locator('.blk.t-b').count() === 2 && (await p.inputValue('.blk.t-b >> nth=1 >> textarea')) === 'Case approach');
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  ok('Enter on an empty bullet ends the list', await p.locator('.blk.t-b').count() === 2 && await p.locator('.blk.t-p').count() === 1);
  await p.keyboard.type('[] Read the Kroll note'); await p.keyboard.press('Enter'); await p.keyboard.type('Prepare two stories');
  ok('"[] " makes a checklist that continues on Enter', await p.locator('.blk.t-c').count() === 2);
  await p.click('.blk.t-c >> nth=0 >> .tick');
  ok('a checkbox can be ticked and the page shows progress', await p.locator('.blk.t-c.done').count() === 1 && /1\/2 done/.test(await p.textContent('.pg-info')));
  await p.click('.blk.t-c >> nth=1 >> textarea'); await p.click('[data-act=blkType][data-t=n]');
  ok('the format bar changes the current line to a numbered line', await p.locator('.blk.t-n .mk').first().textContent() === '1.');
  await p.click('[data-act=blkIndent][data-d="1"]'); ok('a line can be indented', await p.locator('.blk.t-n[style*="--lv:1"]').count() === 1);
  await p.click('[data-act=blkType][data-t=c]'); await p.click('[data-act=pageTasks]');
  ok('open checklist items can become tasks', await p.evaluate(async () => (await import('/js/core.js')).S.tasks.some(t => t.title === 'Prepare two stories')));
  await p.click('[data-act=pagePin] >> nth=0'); await p.click('[data-act=pageClose]');
  ok('closing the page returns to the list with the page pinned and titled', /Deloitte HCOT questions/.test(await p.textContent('h3.group-h:has-text("Pinned") + ul')));
  await p.fill('[data-bind=noteSearch]', 'kroll'); ok('search narrows the pages', await p.locator('[data-pg]:visible').count() === 1);
  await p.fill('[data-bind=noteSearch]', 'zzzz'); ok('and shows none for no match', await p.locator('[data-pg]:visible').count() === 0); await p.fill('[data-bind=noteSearch]', '');
  await p.click('[data-act=noteBook][data-id=all]'); ok('All shows every page', await p.locator('[data-pg]').count() === 2);
  await p.click('[data-act=pageOpen] >> nth=0'); await p.click('[data-act=pageDel]'); ok('deleting asks twice', await p.locator('.editor').count() === 1); await p.click('[data-act=pageDel]');
  ok('a page can be deleted', await p.locator('[data-pg]').count() === 1);
  await nav('learn'); await p.click('[data-act=talkPoint] >> nth=0');
  ok('Talking point saves a page and marks the story', await p.locator('.chip.ok:has-text("In Notes")').count() === 1);
  await nav('notes');
  ok('the talking point sits in its own book with what happened, why it matters and my view', /Talking points/.test(await p.textContent('.bookbar')));
  await p.click('.pg:has(.chip:has-text("Talking points")) [data-act=pageOpen]');
  ok('and has the three headed sections', await p.locator('.blk.t-h').count() === 3 && /What happened/.test(await p.inputValue('.blk.t-h >> nth=0 >> textarea')));
  await p.click('[data-act=pageClose]'); await p.click('[data-act=noteBook][data-id=all]');
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.pages = []; c.S.books = []; c.commit(); });

  // Home: the ring and the next-up card
  await nav('home');
  ok('the hero has a progress ring', await p.locator('.hero .ring').count() === 1);
  await p.evaluate(async () => { const c = await import('/js/core.js'); const u = await import('/js/util.js'); c.S.events.push({ id: 'later', title: 'Late seminar', date: u.today(), time: '23:59', where: 'Aud 1' }); c.commit(); });
  ok('Next up shows the next event with a live countdown', /Late seminar/.test(await p.textContent('.next')) && await p.locator('.next [data-countdown]').count() === 1);
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.events = c.S.events.filter(e => e.id !== 'later'); c.commit(); });

  // Settings: theme, glass, habits
  await nav('home'); await p.click('[data-nav=settings]');
  await p.click('[data-act=theme][data-id=dark]'); ok('dark theme applies', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await p.click('[data-act=theme][data-id=light]'); ok('light theme applies', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await p.click('[data-act=theme][data-id=system]'); ok('system theme clears the override', (await p.evaluate(() => document.documentElement.dataset.theme)) === undefined);
  await p.click('[data-act=glass]'); ok('glass can be switched off', (await p.evaluate(() => document.documentElement.dataset.glass)) === 'off');
  await p.click('[data-act=glass]'); ok('and back on', (await p.evaluate(() => document.documentElement.dataset.glass)) === undefined);
  ok('no module switches any more', await p.locator('[data-act=module]').count() === 0);
  await p.fill('[data-form=habit] [name=name]', 'Workout'); await p.click('[data-form=habit] button.primary'); ok('habit added in Settings', /Workout/.test(await view()));
  await nav('home'); ok('and it shows on Home', /Workout/.test(await p.textContent('.habit-row')));
  await p.click('[data-nav=settings]'); await p.fill('[data-form=profile] [name=company]', 'Deloitte'); await p.fill('[data-form=profile] [name=joining]', new Date(Date.now() + 40 * 864e5).toLocaleDateString('en-CA')); await p.click('[data-form=profile] button');
  await nav('home'); ok('a start date adds a countdown to the hero', /40\s*days to Deloitte/.test(await p.textContent('.hero')));

  // Reminders: settings form saves, and the built list has the daily pair plus deadline items
  await nav('tasks');
  const tomorrow = new Date(Date.now() + 36 * 36e5).toISOString().slice(0, 10);
  await p.fill('[data-form=task] [name=title]', 'Marketing exam'); await p.selectOption('[data-form=task] [name=when]', '1'); await p.click('[data-form=task] button.primary');
  await nav('home'); await p.click('[data-nav=settings]');
  await p.check('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  const list = await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().map(n => n.title));
  ok('morning briefing, evening wrap-up, comeback and weekly nudges are built', list.some(t => /Good morning|Fresh day|Rise and plan|Here is your day|New day/.test(t)) && list.includes('Wrap up the day') && list.includes('Your list is waiting') && list.includes('Your week in review'));
  const briefing = await p.evaluate(async () => { const r = await import('/js/reminders.js'); const c = await import('/js/core.js'); const u = await import('/js/util.js'); c.S.events.push({ id: 'brief1', title: 'Neuro Mktg C', date: u.addDays(u.today(), 1), time: '12:00', where: 'CR 12' }); return r.buildReminders().filter(n => /CR 12/.test(n.body)).length; });
  ok('the morning briefing names the day\'s class, time and room', briefing >= 1);
  ok('deadline reminder for the exam', list.some(t => t === 'Due tomorrow' || t === 'Due today'));
  ok('no flashcard reminder any more', !list.includes('Flashcards due'));
  await p.click('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  ok('reminders off builds nothing', (await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().length)) === 0);

  // Calendar sync: connect an ICS feed, see its events, change the feed, sync, and see the change
  const tmp = path.join(__dirname, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
  const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = title => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Test cal',
    'BEGIN:VEVENT', 'UID:t1', 'DTSTART:' + stamp(Date.now() + 3 * 36e5), 'DTEND:' + stamp(Date.now() + 4 * 36e5), 'SUMMARY:' + title, 'LOCATION:Room 7', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:a1', 'DTSTART:' + stamp(Date.now() + 2 * 36e5), 'DTEND:' + stamp(Date.now() + 3 * 36e5), 'SUMMARY:Due: Form submission', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:a2', 'DTSTART:' + stamp(Date.now() - 40 * 6e4), 'DTEND:' + stamp(Date.now() + 36e5), 'SUMMARY:Due: Already late', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:m1', 'DTSTART;VALUE=DATE:' + new Date().toLocaleDateString('en-CA').replace(/-/g, ''), 'SUMMARY:Mail: Placement notice', 'DESCRIPTION:Shortlist is out. Check the Superset portal. Added from email.', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:t3', 'DTSTART:' + stamp(Date.now() + 5 * 36e5), 'DTEND:' + stamp(Date.now() + 6 * 36e5), 'SUMMARY:Friend class', 'DESCRIPTION:Not mine - friend', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:t2', 'DTSTART;VALUE=DATE:' + new Date().toLocaleDateString('en-CA').replace(/-/g, ''), 'SUMMARY:Fest day', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  fs.writeFileSync(path.join(tmp, 'cal.ics'), ics('Calendar sync works'));
  await nav('home'); await p.click('[data-nav=settings]');
  await p.fill('[data-form=calAdd] [name=name]', 'Test cal'); await p.fill('[data-form=calAdd] [name=url]', `http://localhost:${port}/tests/.tmp/cal.ics`); await p.click('[data-form=calAdd] button.primary');
  await p.waitForSelector('text=6 events synced');
  await nav('home');
  ok('calendar event shows on Today', /Calendar sync works/.test(await view()) && /Room 7/.test(await view()) && /Fest day/.test(await view()));
  ok('events marked not mine are hidden', !/Friend class/.test(await view()));
  fs.writeFileSync(path.join(tmp, 'cal.ics'), ics('Calendar sync updated'));
  await p.click('[data-act=calSync]'); await p.waitForSelector('text=Calendar sync updated');
  ok('edit in the calendar reflects after sync', !/Calendar sync works/.test(await view()));
  ok('important mail shows its key facts under Needs attention', /Placement notice/.test(await p.textContent('.card.alert')) && /Shortlist is out/.test(await p.textContent('.card.alert')));
  ok('mail items are not listed as schedule events', !/Placement notice/.test(await p.textContent('.card:has(h2:has-text("Today\'s schedule"))')));
  const attn = () => p.textContent('.card.alert');
  ok('upcoming deadline is in Needs attention, red today', /Form submission/.test(await attn()) && await p.locator('.card.alert li.due-today').count() >= 1);
  ok('deadline 40 minutes past is gone automatically', !/Already late/.test(await attn()));
  await p.click('.card [data-act=actToggle] >> nth=0');
  ok('ticked deadline stays, struck through', await p.locator('li.done:has-text("Form submission")').count() === 1);
  await p.click('li.done:has-text("Form submission") [data-act=actToggle]');
  ok('unticking restores it', await p.locator('li.done:has-text("Form submission")').count() === 0 && /Form submission/.test(await view()));
  await nav('home'); await p.click('[data-nav=settings]');
  await p.check('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  const rem = await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().map(n => n.title));
  ok('calendar event gets a reminder', rem.includes('Calendar sync updated'));
  await p.click('[data-form=reminders] [name=on]'); await p.click('[data-form=reminders] button.primary');
  ok('calendar link is not in the backup data', !(await p.evaluate(() => localStorage.getItem('daily-driver-v2'))).includes('tests/.tmp'));
  // Calendar tab: month, week, day and agenda over the same items as Home
  await nav('calendar');
  ok('calendar tab opens on the month grid with today picked', await p.locator('.cal-grid .cal-cell').count() >= 28 && await p.locator('.cal-cell.today.sel').count() === 1);
  ok('the picked day lists its events, deadlines and email facts', /Calendar sync updated/.test(await p.textContent('#cal-day')) && /Form submission/.test(await p.textContent('#cal-day')) && /Placement notice/.test(await p.textContent('#cal-day')));
  ok('days with items carry dots', await p.locator('.cal-cell.today .cal-dots i').count() >= 2);
  ok('events marked not mine stay hidden in the calendar too', !/Friend class/.test(await p.textContent('#cal-day')));
  await p.click('[data-act=calMode][data-id=week]');
  ok('week view lays events on a time grid', await p.locator('.cal-col').count() === 7 && await p.locator('.cal-block').count() >= 1);
  await p.click('[data-act=calMode][data-id=day]');
  ok('day view shows one column', await p.locator('.cal-tg.one .cal-block').count() >= 1);
  await p.click('[data-act=calMode][data-id=agenda]');
  ok('agenda lists the coming days', /Calendar sync updated/.test(await view()) && /Today/.test(await view()));
  await p.click('[data-act=calMode][data-id=month]');
  await p.click('#cal-day summary'); await p.fill('#cal-day [name=title]', 'Mock interview'); await p.fill('#cal-day [name=time]', '14:00'); await p.click('#cal-day button.primary');
  ok('an event added from the calendar shows on that day', /Mock interview/.test(await p.textContent('#cal-day')) && await p.locator('.cal-cell.today .cal-dots i').count() >= 2);
  await nav('home'); ok('and on Home', /Mock interview/.test(await view())); await nav('calendar');
  const tmr = new Date(Date.now() + 864e5).toLocaleDateString('en-CA');
  await p.click(`[data-act=calPick][data-d="${tmr}"]`);
  ok('a task due that day appears on it', /Marketing exam/.test(await p.textContent('#cal-day')));
  await p.click('#cal-day li:has-text("Marketing exam") [data-act=taskDone]');
  ok('ticking it in the calendar completes the task', await p.locator('#cal-day li.done:has-text("Marketing exam")').count() === 1);
  await p.click('[data-act=calNext]'); ok('next moves the month on', !(await p.textContent('.cal-nav')).includes(new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })));
  await p.click('[data-act=calToday]'); ok('Today jumps back', await p.locator('.cal-cell.today.sel').count() === 1);
  await nav('home'); await p.click('[data-nav=settings]');
  await p.click('[data-act=calRemove]'); await nav('home');
  ok('removing the calendar removes its events', !/Calendar sync updated/.test(await view()));

  // Persistence and migration from v1
  await p.reload(); await p.waitForSelector('h1'); await nav('home');
  ok('data persists after reload', /Workout/.test(await view()) && /Prepare marketing case/.test(await view()));
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem('daily-driver-v1', JSON.stringify({ routineItems: [{ id: 'r1', label: 'Old habit' }], routineLog: {}, deadlines: [{ id: 'd1', title: 'Old exam', date: '2030-01-01', kind: 'Exam' }], tasks: [], apps: [], contacts: [], stars: [], subs: [], expenses: [], budget: 0 })); });
  const q = await ctx.newPage(); await q.goto(`http://localhost:${port}/`); await q.waitForSelector('h1');
  await q.click('#nav [data-nav=home]'); ok('v1 habits migrated', /Old habit/.test(await q.textContent('#view')));
  await q.click('#nav [data-nav=tasks]'); ok('v1 deadlines became tasks', /Old exam/.test(await q.textContent('#view')));
  // Old flat notes (saved before the notes app) become pages, talking points in their own book
  const octx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await octx.addInitScript(() => { if (!localStorage.getItem('daily-driver-v2')) localStorage.setItem('daily-driver-v2', JSON.stringify({ v: 2, notes: [{ id: 'o1', text: 'Kroll idea\nsecond line', at: 1700000000000, pinned: true }, { id: 'o2', text: 'Talking point: Rates\nWhat happened: cut\nMy view: ', at: 1700000001000, tp: true, src: 'Rates' }] })); });
  const o = await octx.newPage(); await o.goto(`http://localhost:${port}/`); await o.waitForSelector('h1');
  const mig = await o.evaluate(async () => { const c = await import('/js/core.js'); return { pages: c.S.pages.map(x => [x.title, x.pinned, x.bookId && c.S.books.find(b => b.id === x.bookId)?.name, x.blocks.map(b => b.x).join('|')]), notes: c.S.notes.length }; });
  ok('old notes migrate into pages without losing text', mig.notes === 0 && mig.pages.length === 2 && mig.pages[0][0] === 'Kroll idea' && mig.pages[0][1] === true && mig.pages[0][3] === 'second line' && mig.pages[1][0] === 'Rates' && mig.pages[1][2] === 'Talking points' && /What happened: cut\|My view:/.test(mig.pages[1][3]));
  // Android shell simulation: the app must use window.Capacitor.Plugins (no registerPlugin) for HTTP, share and notifications
  const fakeIcs = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:n1', 'DTSTART:' + stamp(Date.now() + 3 * 36e5), 'DTEND:' + stamp(Date.now() + 4 * 36e5), 'SUMMARY:Native bridge event', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  const nctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await nctx.addInitScript(ics => {
    window.__shared = []; window.__scheduled = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      CapacitorHttp: { get: async () => ({ status: 200, data: ics }) },
      Filesystem: { writeFile: async o => ({ uri: 'file:///cache/' + o.path }) },
      Share: { share: async o => { window.__shared.push(o.url); } },
      App: { addListener: async () => ({ remove() {} }), exitApp: async () => {} },
      WidgetBridge: { update: async o => { window.__widget = JSON.parse(o.json); window.__ics = o.ics; }, take: async () => { const r = window.__take || { ops: '[]', target: '' }; window.__take = null; return r; } },
      LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async o => { window.__scheduled.push(...o.notifications); } },
    } };
  }, fakeIcs);
  const n = await nctx.newPage(); const nerrs = []; n.on('pageerror', e => nerrs.push(e.message));
  await n.goto(`http://localhost:${port}/`); await n.waitForSelector('h1');
  await n.click('#nav [data-nav=home]'); await n.click('[data-nav=settings]');
  await n.fill('[data-form=calAdd] [name=name]', 'Native'); await n.fill('[data-form=calAdd] [name=url]', 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics'); await n.click('[data-form=calAdd] button.primary');
  await n.waitForSelector('text=1 events synced');
  await n.click('#nav [data-nav=home]'); ok('native HTTP bridge syncs the calendar', /Native bridge event/.test(await n.textContent('#view')));
  await n.click('#nav [data-nav=home]'); await n.click('[data-nav=settings]');
  await n.check('[data-form=reminders] [name=on]'); await n.click('[data-form=reminders] button.primary'); await n.waitForTimeout(400);
  await n.waitForTimeout(900);
  const snap = await n.evaluate(() => window.__widget);
  ok('widget snapshot is pushed to the native side', !!snap && snap.v === 3 && Array.isArray(snap.cal) && snap.cal.some(e => /Native bridge event/.test(e.t) && e.k === 'event' && e.d && typeof e.s === 'number') && Array.isArray(snap.tasks) && !!snap.habits);
  ok('snapshot carries habits, tasks and news for the widgets', snap.v === 3 && Array.isArray(snap.habitList) && snap.habitList.length > 0 && Array.isArray(snap.news));
  await n.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks.push({ id: 'wtask', title: 'Ticked from a widget', done: false, important: true, kind: 'Task' }); c.S.habits.length && (window.__hid = c.S.habits[0].id); c.commit(); });
  await n.evaluate(() => { window.__take = { ops: JSON.stringify([{ t: 'task', id: 'wtask' }, { t: 'habit', id: window.__hid }]), target: 'learn:news' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(500);
  ok('a widget tap opens the tab it asked for', /Learn/.test(await n.textContent('h1')) && await n.locator('.tabs button.on:has-text("News")').count() === 1);
  ok('things ticked on a widget are applied', await n.evaluate(async () => { const c = await import('/js/core.js'); return c.S.tasks.find(x => x.id === 'wtask').done && !!Object.values(c.S.habitLog)[0]?.[window.__hid]; }));
  await n.evaluate(() => { window.__take = { ops: '[]', target: 'plan:tasks:add' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(300);
  ok('a widget can open Tasks with the add bar focused', await n.locator('h1:has-text("Tasks")').count() === 1 && await n.evaluate(() => document.activeElement && document.activeElement.name === 'title'));
  await n.evaluate(() => { window.__take = { ops: JSON.stringify([{ t: 'capture', id: 'Read the Kroll note\nhttps://example.com/kroll' }]), target: 'plan:tasks' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(400);
  ok('text shared into the app becomes a task and a note', await n.evaluate(async () => { const c = await import('/js/core.js'); return c.S.tasks.some(t => t.title === 'Read the Kroll note') && c.S.pages.some(x => x.shared && /Kroll/.test(x.title + JSON.stringify(x.blocks))); }));
  await n.evaluate(() => { window.__take = { ops: '[]', target: 'plan:notes:add' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(300);
  ok('the quick-add widget can open the notes jot box', await n.locator('[data-form=jot] input').count() === 1 && await n.evaluate(() => document.activeElement && document.activeElement.name === 'text'));
  ok('the snapshot carries the practice problems and flags calendar items', await n.evaluate(async () => { const w = await import('/js/widgets.js'); const s = w.buildSnapshot(); return s.problems.length >= 8 && s.cal.some(e => e.o === 1); }));
  await n.evaluate(() => { window.__take = { ops: '[]', target: 'calendar:week' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(300);
  ok('a widget can open the calendar on a chosen view', await n.locator('.seg.pills button.on:has-text("Week")').count() === 1 && await n.locator('.cal-col').count() === 7);
  await n.evaluate(() => { window.__take = { ops: '[]', target: 'calendar:day:2026-12-25' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(300);
  ok('a widget can open the calendar on a chosen day', /Friday 25 December/.test(await n.textContent('.cal-nav')));
  await n.evaluate(async () => { const c = await import('/js/core.js'); c.go('home'); });
  await n.click('[data-nav=settings]');
  ok('native notifications get scheduled', (await n.evaluate(() => window.__scheduled.map(x => x.title))).includes('Wrap up the day'));
  ok('widgets get the calendar addresses to refresh by themselves', await n.evaluate(() => { const j = window.__ics ? JSON.parse(window.__ics) : null; return !!j && j.sources.length === 1 && /ical/.test(j.sources[0].url) && typeof j.hidden === 'string'; }));
  await n.click('[data-act=nudgeTest]'); await n.waitForTimeout(300);
  ok('a test nudge can be sent', (await n.evaluate(() => window.__scheduled.map(x => x.title))).includes('Daily Driver'));
  await n.click('[data-act=export]'); await n.waitForTimeout(400);
  ok('native backup opens the share sheet', (await n.evaluate(() => window.__shared)).some(u => /daily-driver-.*\.json$/.test(u)));
  ok('no page errors in the native simulation', nerrs.length === 0); if (nerrs.length) console.log(nerrs);
  await nctx.close();
  const bctx = await b.newContext(); await bctx.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
  const bp = await bctx.newPage(); await bp.goto(`http://localhost:${port}/`); await bp.waitForSelector('h1');
  await bp.click('#nav [data-nav=home]'); await bp.click('[data-nav=settings]');
  await bp.fill('[data-form=calAdd] [name=url]', 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics'); await bp.click('[data-form=calAdd] button.primary');
  await bp.waitForSelector('text=not available in this build');
  ok('a missing Android feature shows a clear message', true);
  await bctx.close();

  ok('no console errors', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
