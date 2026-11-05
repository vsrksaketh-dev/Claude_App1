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

  ok('home is the day: a big date, the Today timeline and Anytime tasks, not news', await p.locator('.today-head h1').count() === 1 && /Today/.test(await view()) && /Anytime/.test(await view()) && !(await p.locator('.story').count()));
  ok('bottom bar has five tabs (Home, Tasks, Notes, Calendar, Learn) and no Track or Plan', (await p.locator('#nav button').count()) === 5 && (await p.locator('#nav [data-nav=plan]').count()) === 0 && (await p.locator('#nav [data-nav=track]').count()) === 0);
  ok('v3 look: solid page, no colour wash, Inter, glass only on the bottom bar', await p.evaluate(() => getComputedStyle(document.body, '::before').display === 'none' && /Inter/.test(getComputedStyle(document.body).fontFamily) && getComputedStyle(document.querySelector('#nav')).backdropFilter !== 'none' && getComputedStyle(document.querySelector('.card')).backdropFilter === 'none'));
  ok('the bottom bar has icons over its labels', await p.locator('#nav button svg').count() === 5);

  // Learn: News first (all categories), then Cases
  await nav('learn');
  ok('news shows in Learn, all categories first', await p.locator('.story').count() >= 1 && await p.locator('.tabs button.on:has-text("All")').count() === 1);
  ok('Learn has News and Cases only', (await p.locator('.stack > .tabs, #view > .tabs').first().locator('button').count()) === 2);
  await p.click('[data-act=newsCat][data-id=Tech]'); ok('a category filters the stories', (await p.locator('.story > .row:first-child .chip:not(.plain)').allTextContents()).every(t => /Tech/.test(t)));
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
  ok('captured task is on the Anytime list at once', /Prepare marketing case/.test(await p.textContent('.card:has(h2:has-text("Anytime"))')));
  ok('the capture bar keeps the keyboard open', await p.evaluate(() => document.activeElement && document.activeElement.name === 'text'));
  await p.fill('[data-form=quick] [name=text]', 'Call the placement cell'); await p.click('[data-form=quick] button');
  await p.fill('[data-form=quick] [name=text]', 'Pack the laptop bag'); await p.click('[data-form=quick] button');
  const todoItems = () => p.locator('.card:has(h2:has-text("Anytime")) .list > li').allTextContents();
  await p.click('.card:has(h2:has-text("Anytime")) li:has-text("Call the placement cell") [data-act=taskDone]');
  const afterTick = await todoItems();
  ok('a ticked to-do stays, struck through, at the bottom', /Call the placement cell/.test(afterTick[afterTick.length - 1]) && await p.locator('.card:has(h2:has-text("Anytime")) li.done:has-text("Call the placement cell")').count() === 1);
  ok('the undone ones stay above it', afterTick.slice(0, -1).some(t => /Pack the laptop bag/.test(t)));
  await p.click('.card:has(h2:has-text("Anytime")) li.done:has-text("Call the placement cell") [data-act=taskUndo]');
  ok('unticking lifts it back up', await p.locator('.card:has(h2:has-text("Anytime")) li.done').count() === 0);
  await p.click('.card:has(h2:has-text("Anytime")) li:has-text("Call the placement cell") [data-act=taskDone]');
  await p.click('.card:has(h2:has-text("Anytime")) li:has-text("Pack the laptop bag") [data-act=taskDone]');
  ok('no hero ring and no motto', await p.locator('.hero, .ring').count() === 0);
  ok('the inbox section is hidden when nothing needs you', !/from your inbox/.test(await view()));
  await p.click('.habit-chip[data-act=habit] >> nth=0');
  ok('habits are a row of dots that tick', /1\/3/.test(await p.textContent('.card:has(h2:has-text("Habits"))')) && await p.locator('.habit-chip.done').count() === 1);

  // Routine: weekly goals, counters, workout types, logging a missed day
  await p.click('.card:has(h2:has-text("Habits")) [data-nav=routine]');
  ok('Routine opens from Home with a card per habit and no tab of its own', /Routine/.test(await p.textContent('h1')) && await p.locator('.habit-card').count() === 3 && (await p.locator('#nav button').count()) === 5);
  await p.click('[data-act=habitPreset][data-id=Gym]');
  ok('the Gym preset is a weekly goal of five with types', /0\/5 this week/.test(await view()) && /5 times a week/.test(await view()));
  await p.click('.habit-card:has(h2:has-text("Gym")) .wk.now');
  ok('tapping today on the week dots logs it', /1\/5 this week/.test(await view()));
  await p.click('.habit-card:has(h2:has-text("Gym")) .wk:not([disabled]):not(.on) >> nth=0');
  ok('a missed earlier day can be logged too', /2\/5 this week/.test(await view()));
  await p.click('[data-act=habitPreset][data-id=Water]'); await p.click('[data-nav=home]');
  ok('Home shows the goal as 2/5 and the counter as 0/8', /2\/5/.test(await p.textContent('.habit-row')) && /0\/8/.test(await p.textContent('.habit-row')));
  await p.click('.habit-chip:has-text("Water")'); await p.click('.habit-chip:has-text("Water")');
  ok('a counter counts up with each tap', /2\/8/.test(await p.textContent('.habit-row')) && await p.locator('.habit-chip.done:has-text("Water")').count() === 0);
  await p.evaluate(async () => { const c = await import('/js/core.js'); const l = await import('/js/logic.js'); const h = c.S.habits.find(x => x.name === 'Water'); l.setHabit(h, (await import('/js/util.js')).today(), 8); c.commit(); });
  ok('reaching the target completes it', await p.locator('.habit-chip.done:has-text("Water")').count() === 1);
  await nav('home');
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.ui.tagAsk = c.S.habits.find(x => x.name === 'Gym').id; c.commit(); });
  await p.click('[data-act=habitTag][data-tag=Push]');
  ok('a type can be recorded for a session and shows in this week', await p.evaluate(async () => { const c = await import('/js/core.js'); const l = await import('/js/logic.js'); return /Push x1/.test(l.weekTags(c.S.habits.find(x => x.name === 'Gym'))); }));
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.habits = c.S.habits.filter(x => !['Gym', 'Water'].includes(x.name)); c.commit(); });


  // Plan: one list grouped by date
  await nav('tasks');
  ok('Tasks has no goals, applications, network or stories', !/Goals|Applications|Network|Stories/.test(await p.textContent('#nav') + await view()) && await p.locator('.matrix, .kanban').count() === 0);
  ok('captured tasks are listed under No date', /Prepare marketing case/.test(await p.textContent('.card:has(h2:has-text("No date")) ul')));
  await p.fill('[data-form=task] [name=title]', 'Sheet task'); await p.selectOption('[data-form=task] [name=when]', '0'); await p.click('[data-form=task] button.primary');
  ok('a task due today lands under Today', /Sheet task/.test(await p.textContent('.card:has(h2:has-text("Today")) ul')));
  await p.click('li:has-text("Sheet task") .edit-btn'); ok('tapping a task opens its sheet', await p.locator('.sheet [data-form=taskSave]').count() === 1);
  await p.check('.sheet [name=important]'); await p.click('.sheet [data-form=taskSave] button.primary');
  ok('priority is set from the sheet and shows as a flag', await p.locator('li:has-text("Sheet task") .pflag').count() === 1 && await p.locator('.sheet').count() === 0);
  ok('what was ticked today shows under Done today', /Call the placement cell/.test(await p.textContent('.card:has(h2:has-text("Done today"))')));

  // Notes: books, pages and the block editor
  await nav('notes');
  ok('Notes is its own tab with an empty state and starter books', /Nothing here yet/.test(await view()) && await p.locator('[data-act=bookStarter]').count() === 5);
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
  ok('closing the page returns to the list with the page pinned and titled', /Deloitte HCOT questions/.test(await p.textContent('.card:has(h2:has-text("Pinned")) ul')));
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

  // Home: the Today timeline (events in time order, the now line, free gaps you can fill with a task)
  await nav('home');
  await p.evaluate(async () => { const c = await import('/js/core.js'); const u = await import('/js/util.js'); c.S.events.push({ id: 'later', title: 'Late seminar', date: u.today(), time: '23:30', where: 'Aud 1' }, { id: 'early', title: 'DHRM · Session 9', date: u.today(), time: '00:05', mins: 60, where: 'CR 14' }); c.commit(); });
  ok('the timeline shows events in time order with their place', await p.evaluate(() => { const t = [...document.querySelectorAll('.tl-row b')].map(x => x.textContent); return t.indexOf('DHRM · Session 9') >= 0 && t.indexOf('DHRM · Session 9') < t.indexOf('Late seminar'); }) && /Aud 1/.test(await p.textContent('.tl')));
  ok('a class keeps its course colour', await p.evaluate(() => [...document.querySelectorAll('.tl-row')].some(r => /DHRM/.test(r.textContent) && r.style.getPropertyValue('--c') === '#3F51B5')));
  ok('a past class can be marked attended', await p.locator('.tl-row:has-text("DHRM · Session 9") [data-act=attendMark][data-v=y]').count() === 1);
  await p.click('.tl-row:has-text("DHRM · Session 9") [data-act=attendMark][data-v=y]');
  ok('and is counted in Classes & exams', await p.evaluate(async () => (await import('/js/study.js')).courseStats().some(c => c.code === 'DHRM' && c.y === 1)));
  const gapBtn = p.locator('[data-act=gapPlan]').first();
  if (await gapBtn.count()) {
    await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks.push({ id: 'slot1', title: 'Draft the DHRM reflection', due: '', important: false, done: false, kind: 'Task' }); c.commit(); });
    await p.locator('[data-act=gapPlan]').first().click();
    ok('a free gap opens a sheet of tasks to place there', await p.locator('.sheet [data-act=taskPlace]:has-text("Draft the DHRM reflection")').count() === 1);
    await p.click('.sheet [data-act=taskPlace]:has-text("Draft the DHRM reflection")');
    ok('the picked task gets that time today and moves onto the timeline', await p.evaluate(async () => { const t = (await import('/js/core.js')).S.tasks.find(x => x.id === 'slot1'); return !!t.time && t.due === (await import('/js/util.js')).today(); }) && /Draft the DHRM reflection/.test(await p.textContent('.tl')));
    await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks = c.S.tasks.filter(x => x.id !== 'slot1'); c.commit(); });
  }
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.events = c.S.events.filter(e => !['later', 'early'].includes(e.id)); c.commit(); });

  // Settings: theme, glass, habits
  await nav('home'); await p.click('[data-nav=settings]');
  await p.click('[data-act=theme][data-id=dark]'); ok('dark theme applies', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await p.click('[data-act=theme][data-id=light]'); ok('light theme applies', (await p.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await p.click('[data-act=theme][data-id=system]'); ok('system theme clears the override', (await p.evaluate(() => document.documentElement.dataset.theme)) === undefined);
  await p.click('[data-act=glass]'); ok('glass can be switched off', (await p.evaluate(() => document.documentElement.dataset.glass)) === 'off');
  await p.click('[data-act=glass]'); ok('and back on', (await p.evaluate(() => document.documentElement.dataset.glass)) === undefined);
  ok('no module switches any more', await p.locator('[data-act=module]').count() === 0);
  await p.click('[data-nav=routine]'); await p.fill('[data-form=habit] [name=name]', 'Workout'); await p.click('[data-form=habit] button.primary'); ok('habit added in Routine', /Workout/.test(await view()));
  await nav('home'); ok('and it shows on Home', /Workout/.test(await p.textContent('.habit-row')));
  await p.click('[data-nav=settings]'); await p.fill('[data-form=profile] [name=company]', 'Deloitte'); await p.fill('[data-form=profile] [name=joining]', new Date(Date.now() + 40 * 864e5).toLocaleDateString('en-CA')); await p.click('[data-form=profile] button');
  await nav('home'); ok('a start date adds a countdown under the date', /40\s*days to Deloitte/.test(await p.textContent('.today-head')));

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
  const inbox = () => p.textContent('.card:has(h2:has-text("from your inbox"))');
  ok('important mail shows its key facts in the inbox section', /Placement notice/.test(await inbox()) && /Shortlist is out/.test(await inbox()));
  ok('mail items are not on the timeline', !/Placement notice/.test(await p.textContent('.tl')));
  ok('today\'s deadline is on the timeline in red with a tick', /Form submission/.test(await p.textContent('.tl')) && await p.evaluate(() => [...document.querySelectorAll('.tl-row')].some(r => /Form submission/.test(r.textContent) && r.style.getPropertyValue('--c') === '#C23B31' && r.querySelector('[data-act=actToggle]'))));
  await p.click('.tl-row:has-text("Form submission") [data-act=actToggle]');
  ok('a ticked deadline stays on the timeline, struck through', await p.locator('.tl-row.done:has-text("Form submission")').count() === 1);
  await p.click('.tl-row.done:has-text("Form submission") [data-act=actToggle]');
  ok('unticking restores it', await p.locator('.tl-row.done:has-text("Form submission")').count() === 0 && /Form submission/.test(await view()));
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
  // Links on events and tasks, task times and repeats
  const lk = await p.evaluate(async () => { const l = await import('/js/links.js'); return { a: l.extractLinks('Join: https://teams.microsoft.com/l/meetup-join/abc. Case: https://drive.google.com/file/d/1/view and https://example.com/x.pdf, mail https://mail.google.com/mail/u/0/#inbox/1a1').map(x => x.kind), b: l.stripLinks('Case study https://drive.google.com/file/d/1/view') }; });
  ok('links are found and ranked: meeting first, then documents, then mail', JSON.stringify(lk.a) === JSON.stringify(['meet', 'doc', 'doc']) && lk.b === 'Case study');
  await p.evaluate(async () => { const c = await import('/js/core.js'); const u = await import('/js/util.js'); c.S.events.push({ id: 'lkev', title: 'Online DTS class', date: u.today(), time: '23:00', where: 'Online', link: 'https://teams.microsoft.com/l/meetup-join/xyz', mins: 75 }); c.commit(); });
  await nav('home'); ok('an online class shows a Join button on Home', await p.locator('.tl-row a.lk-meet[href*="teams.microsoft.com"]').count() === 1);
  await nav('calendar'); ok('and on the Calendar day card', await p.locator('#cal-day a.lk-meet[href*="teams.microsoft.com"]').count() === 1);
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.events = c.S.events.filter(e => e.id !== 'lkev'); c.commit(); });
  await nav('tasks');
  await p.fill('[data-form=task] [name=title]', 'Call the recruiter'); await p.fill('[data-form=task] [name=time]', '16:30'); await p.click('[data-form=task] button.primary');
  ok('a task added with a time lands on today with the time shown', /Call the recruiter/.test(await view()) && /4:30pm/.test(await p.textContent('li:has-text("Call the recruiter")')));
  await p.click('li:has-text("Call the recruiter") .edit-btn');
  await p.selectOption('[data-form=taskSave] [name=repeat]', 'daily'); await p.fill('[data-form=taskSave] [name=link]', 'https://drive.google.com/file/d/9/view'); await p.click('[data-form=taskSave] button.primary');
  ok('a task can repeat and carry a document link', /daily/.test(await p.textContent('li:has-text("Call the recruiter") .tmeta')) && await p.locator('li:has-text("Call the recruiter") a.lk-doc').count() === 1);
  const rep = await p.evaluate(async () => { const c = await import('/js/core.js'); const l = await import('/js/logic.js'); const u = await import('/js/util.js'); const t = c.S.tasks.find(x => x.title === 'Call the recruiter'); const before = t.due; l.completeTask(t.id); return { before, after: t.due, done: t.done, tomorrow: u.addDays(u.today(), 1) }; });
  ok('ticking a daily task moves it to tomorrow instead of finishing it', rep.before === rep.tomorrow - 0 || (rep.after === rep.tomorrow && rep.done === false));
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.reminders.on = true; c.S.tasks.push({ id: 'remt', title: 'Timed reminder task', due: (await import('/js/util.js')).addDays((await import('/js/util.js')).today(), 1), time: '09:15', repeat: '', important: true, done: false, kind: 'Task' }); c.commit(); });
  const rl = await p.evaluate(async () => (await import('/js/reminders.js')).buildReminders().filter(n => n.title === 'Timed reminder task').map(n => n.body));
  ok('a task with a time schedules a reminder at that time, and one ten minutes before for priority tasks', rl.length === 2 && rl.some(b => /Reminder/.test(b)) && rl.some(b => /10 minutes/.test(b)));
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks = c.S.tasks.filter(t => !['remt'].includes(t.id) && t.title !== 'Call the recruiter'); c.S.reminders.on = false; c.commit(); });
  // Robustness pass: notes trash and wrapping, task steps/snooze/undo/filters, repeating events, search, saved news
  await nav('notes');
  await p.fill('[data-form=jot] [name=text]', 'Averyveryverylongwordwithoutspaces'.repeat(6)); await p.click('[data-form=jot] button.primary');
  ok('a long jot keeps all its text and never spills past the screen', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && await p.evaluate(async () => (await import('/js/core.js')).S.pages.some(x => JSON.stringify(x).includes('Averyveryverylongwordwithoutspaces'.repeat(6)))));
  ok('the bottom bar stays visible in Notes', await p.locator('#nav').isVisible());
  await p.click('.pg:has-text("Averyvery") [data-act=pageOpen]');
  ok('the bottom bar stays visible while editing a page', await p.locator('#nav').isVisible() && await p.locator('.fmtbar').isVisible());
  await p.click('[data-act=pageDel]'); await p.click('[data-act=pageDel]');
  ok('a deleted page goes to Trash', await p.locator('.bookbar .trash').count() === 1);
  await p.click('.bookbar .trash'); await p.click('[data-act=pageRestore] >> nth=0');
  ok('and can be restored', await p.locator('.pg:has-text("Averyvery")').count() === 1);
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.pages = []; c.S.books = []; c.commit(); });
  await nav('tasks');
  await p.fill('[data-form=task] [name=title]', 'Prepare HCOT case deck'); await p.click('[data-form=task] button.primary');
  await p.click('li:has-text("Prepare HCOT case deck") [data-act=taskEditOpen] >> nth=0');
  await p.fill('[data-form=subAdd] [name=x]', 'Outline'); await p.click('[data-form=subAdd] button.primary');
  await p.fill('[data-form=subAdd] [name=x]', 'Slides'); await p.click('[data-form=subAdd] button.primary');
  await p.click('.subs [data-act=subTick] >> nth=0');
  ok('a task can have steps that tick off', /1 of 2 steps/.test(await p.textContent('li:has-text("Prepare HCOT case deck")')));
  await p.click('.sheet [data-act=taskSnooze][data-s=tom]');
  ok('snooze moves a task to tomorrow', /tomorrow/i.test(await p.textContent('li:has-text("Prepare HCOT case deck")')));
  await p.click('[data-act=taskFilter][data-id=upcoming]'); ok('filters narrow the list', /Prepare HCOT case deck/.test(await view()));
  await p.click('[data-act=taskFilter][data-id=someday]'); ok('and hide what does not fit', !/Prepare HCOT case deck/.test(await view()));
  await p.click('[data-act=taskFilter][data-id=all]');
  await p.click('li:has-text("Prepare HCOT case deck") .edit-btn'); await p.click('.sheet [data-act=delTask]');
  ok('deleting a task offers Undo', await p.locator('#toast.on button').count() === 1 && !/Prepare HCOT case deck/.test(await view()));
  await p.click('#toast button'); ok('and Undo brings it back', /Prepare HCOT case deck/.test(await view()));
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks = c.S.tasks.filter(t => t.title !== 'Prepare HCOT case deck'); c.commit(); });
  await nav('calendar');
  await p.click('#cal-day summary'); await p.fill('#cal-day [data-form=event] [name=title]', 'Gym class'); await p.fill('#cal-day [data-form=event] [name=time]', '07:00');
  await p.selectOption('#cal-day [data-form=event] [name=repeat]', 'weekly'); await p.click('#cal-day [data-form=event] button.primary');
  const occ = await p.evaluate(async () => { const a = await import('/js/agenda.js'); const u = await import('/js/util.js'); return [0, 7, 14, 3].map(n => a.agendaOn(u.addDays(u.today(), n)).some(e => e.title === 'Gym class')); });
  ok('a weekly event shows every week and not on other days', JSON.stringify(occ) === '[true,true,true,false]');
  await p.click('#cal-day li:has-text("Gym class") [data-act=calEditEv]'); await p.fill('.sheet [data-form=eventSave] [name=title]', 'Gym: legs'); await p.click('.sheet [data-form=eventSave] button.primary');
  ok('an event typed into the app can be edited', /Gym: legs/.test(await view()));
  await p.click('#cal-day li:has-text("Gym: legs") [data-act=calEditEv]'); await p.click('[data-act=evDel]');
  ok('and deleted with Undo', !/Gym: legs/.test(await p.textContent('#cal-day')) && await p.locator('#toast.on').count() === 1);
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.events = c.S.events.filter(e => !/Gym/.test(e.title)); c.commit(); });
  await p.click('[data-nav=search]'); await p.fill('[data-bind=srq]', 'kotter');
  ok('search finds the casebook from any screen', /Kotter/.test(await p.textContent('#sres')));
  await p.fill('[data-bind=srq]', 'Workout'); ok('and habits', /Habits/.test(await p.textContent('#sres')));
  await nav('learn'); await p.click('[data-act=sub][data-group=learn][data-id=news]').catch(() => {});
  await p.click('[data-act=storySave] >> nth=0'); await p.click('[data-act=newsCat][data-id=Saved]');
  ok('a story can be saved and stays under Saved', await p.locator('.story').count() === 1);
  await p.click('[data-act=newsCat][data-id=All]');
  // photos and files on a note (browser storage here; phone storage in the app)
  await nav('notes'); await p.click('[data-act=pageNew]'); await p.fill('.pg-title', 'With a photo');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('[data-bind=fileAdd]', [{ name: 'board.png', mimeType: 'image/png', buffer: png }, { name: 'case.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }]);
  await p.waitForTimeout(600);
  ok('a photo shows as a thumbnail and a PDF as a file row', await p.locator('.pg-files img[src^="blob:"]').count() === 1 && /case\.pdf/.test(await p.textContent('.list.files')));
  await p.click('.thumb'); ok('tapping a photo opens it full screen', await p.locator('.viewer img').count() === 1);
  await p.click('.viewer [data-act=fileView]');
  await p.click('[data-act=pageClose]');
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.pages = []; c.S.books = []; c.commit(); });
  const gl = await p.evaluate(async () => { const m = await import('/js/calendar.js'); return [m.gcalLink('https://calendar.google.com/calendar/ical/me%40gmail.com/private-x/basic.ics', { uid: 'abc123@google.com', start: 0 }), m.gcalLink('https://example.com/cal.ics', { uid: 'abc@google.com' })]; });
  ok('a synced event links to itself in Google Calendar for editing', gl[0] === 'https://calendar.google.com/calendar/event?eid=' + Buffer.from('abc123 me@gmail.com').toString('base64').replace(/=+$/, '') && gl[1] === '');
  // natural-language add and the problem log
  await nav('tasks'); await p.fill('[data-form=task] [name=title]', 'Submit DHRM fri 5pm !');
  ok('typing shows what the words will set', /5:00 pm/.test(await p.textContent('[data-form=task] .parsed')) && /Priority/.test(await p.textContent('[data-form=task] .parsed')));
  await p.click('[data-form=task] button.primary');
  const nl = await p.evaluate(async () => (await import('/js/core.js')).S.tasks.find(t => t.title === 'Submit DHRM'));
  ok('natural-language add sets the date, time and priority', !!nl && nl.time === '17:00' && nl.important === true && !!nl.due);
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks = c.S.tasks.filter(t => t.title !== 'Submit DHRM'); c.commit(); });
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.app.actions.__boom = () => { throw new Error('test boom'); }; });
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.act = '__boom'; b.id = 'boom'; document.body.appendChild(b); });
  await p.click('#boom');
  ok('a failing action is caught and written to the problem log', await p.evaluate(async () => (await import('/js/log.js')).readLog().some(x => /test boom/.test(x.msg))));
  await p.click('[data-nav=settings]'); ok('and Settings shows it with a Share button', /test boom/.test(await view()) && await p.locator('[data-act=logShare]').count() === 1);
  await p.click('[data-act=logClear]'); await nav('home');
  // exams, attendance, the weekly review, long-press menus and swipes
  await nav('calendar'); await p.click('[data-nav=academics]');
  ok('Classes & exams opens from the Calendar', /Classes & exams/.test(await p.textContent('h1')));
  await p.fill('[data-form=examAdd] [name=subject]', 'PERMGT end-term'); await p.click('[data-form=examAdd] button.primary');
  ok('an exam shows with a countdown', /PERMGT end-term/.test(await view()) && /7/.test(await p.textContent('.exam .cd')));
  await p.click('.exam [data-act=examOpen] >> nth=0');
  await p.fill('.sheet [data-form=topicAdd] [name=x]', 'Unit 1: rewards'); await p.click('.sheet [data-form=topicAdd] button.primary');
  await p.fill('.sheet [data-form=topicAdd] [name=x]', 'Unit 2: incentives'); await p.click('.sheet [data-form=topicAdd] button.primary');
  await p.click('.sheet [data-act=topicTick] >> nth=0'); await p.mouse.click(195, 15);
  ok('revision topics give a progress bar and a daily target', /1 of 2 topics revised/.test(await view()) && /Revise 1 topic today/.test(await view()));
  await nav('home'); ok('Home shows the exam banner', /PERMGT end-term in 7 days/.test(await p.textContent('.banner')));
  ok('exams are on the calendar as deadlines', await p.evaluate(async () => { const a = await import('/js/agenda.js'); const u = await import('/js/util.js'); return a.agendaOn(u.addDays(u.today(), 7)).some(e => e.exam && /PERMGT/.test(e.title)); }));
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.exams = []; c.go('review'); });
  ok('the weekly review shows the week and the open tasks', /This week/.test(await view()) && /Still open/.test(await view()));
  const pickBtn = p.locator('[data-act=revTop]').first();
  if (await pickBtn.count()) { await pickBtn.click(); ok('a task can be picked for next week\'s three', await p.locator('.pick.on').count() === 1); }
  await p.click('[data-act=reviewDone] >> nth=0');
  ok('finishing the review returns Home and records it', /Anytime/.test(await view()) && await p.evaluate(async () => Object.values((await import('/js/core.js')).S.reviews).some(r => r.at)));
  // long-press menu on a task
  await p.fill('[data-form=quick] [name=text]', 'Hold me'); await p.click('[data-form=quick] button');
  await p.evaluate(() => document.querySelector('li.sw .sw-row') && [...document.querySelectorAll('li.sw')].find(x => /Hold me/.test(x.textContent)).scrollIntoView({ block: 'center' })); await p.waitForTimeout(700);
  const box = await p.locator('li.sw:has-text("Hold me") .sw-row').boundingBox();
  await p.mouse.move(box.x + 60, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(650);
  await p.mouse.up();
  ok('holding a task opens its menu', await p.locator('.sheet .menu [data-act=taskStar]').count() === 1);
  await p.click('.sheet .menu [data-act=taskStar]');
  ok('a menu action applies and closes the menu', await p.locator('.sheet').count() === 0 && await p.locator('li.sw:has-text("Hold me") .pflag').count() === 1);
  // swipe right to finish
  await p.evaluate(() => [...document.querySelectorAll('li.sw')].find(x => /Hold me/.test(x.textContent)).scrollIntoView({ block: 'center' })); await p.waitForTimeout(700);
  const b2 = await p.locator('li.sw:has-text("Hold me") .sw-row').boundingBox();
  await p.mouse.move(b2.x + 30, b2.y + b2.height / 2); await p.mouse.down(); await p.mouse.move(b2.x + 90, b2.y + b2.height / 2, { steps: 4 }); await p.mouse.move(b2.x + 170, b2.y + b2.height / 2, { steps: 4 }); await p.mouse.up();
  ok('swiping a task right finishes it', await p.evaluate(async () => (await import('/js/core.js')).S.tasks.find(t => t.title === 'Hold me').done));
  await p.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks = c.S.tasks.filter(t => t.title !== 'Hold me'); c.commit(); });
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
      Filesystem: { writeFile: async o => { (window.__fs ||= {})[o.directory + '/' + o.path] = o.data; return { uri: 'file:///cache/' + o.path }; }, readFile: async o => { const d = (window.__fs || {})[o.directory + '/' + o.path]; if (d === undefined) throw new Error('missing'); return { data: d }; }, mkdir: async () => {}, readdir: async () => ({ files: [] }), deleteFile: async () => {} },
      Share: { share: async o => { window.__shared.push(o.url); } },
      App: { addListener: async () => ({ remove() {} }), exitApp: async () => {} },
      WidgetBridge: { update: async o => { window.__widget = JSON.parse(o.json); window.__ics = o.ics; }, take: async () => { const r = window.__take || { ops: '[]', target: '' }; window.__take = null; return r; } },
      LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async o => { window.__scheduled.push(...o.notifications); }, registerActionTypes: async o => { window.__actionTypes = o.types; }, addListener: (ev, fn) => { if (ev === 'localNotificationActionPerformed') window.__notifAct = fn; return { remove() {} }; } },
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
  ok('a link shared into the app goes to Learn > Saved to read later', await n.evaluate(async () => { const c = await import('/js/core.js'); return c.S.saved.some(x => x.url === 'https://example.com/kroll' && x.title === 'Read the Kroll note') && !c.S.tasks.some(t => t.title === 'Read the Kroll note'); }));
  await n.evaluate(() => { window.__take = { ops: JSON.stringify([{ t: 'capture', id: 'Ask Ravi about the PPT\nHe has the template and the market sizing numbers from last term, and the speaker notes too' }]), target: 'plan:tasks' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(400);
  ok('shared text without a link becomes a task and a note', await n.evaluate(async () => { const c = await import('/js/core.js'); return c.S.tasks.some(t => t.title === 'Ask Ravi about the PPT') && c.S.pages.some(x => x.shared && /market sizing/.test(JSON.stringify(x.blocks))); }));
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
  // the state is mirrored to a phone file, and a newer phone copy wins at start-up
  await n.waitForTimeout(2000);
  ok('every save is mirrored to the phone file', await n.evaluate(() => { const j = window.__fs && window.__fs['DATA/state.json']; return !!j && JSON.parse(j).v === 2; }));
  const fctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await fctx.addInitScript(() => {
    const st = { v: 2, meta: { savedAt: Date.now() + 864e5 }, tasks: [{ id: 'pf', title: 'From the phone file', due: '', important: false, done: false, kind: 'Task' }] };
    window.__fs = { 'DATA/state.json': JSON.stringify(st) };
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      Filesystem: { writeFile: async o => { window.__fs[o.directory + '/' + o.path] = o.data; return { uri: 'x' }; }, readFile: async o => { const d = window.__fs[o.directory + '/' + o.path]; if (d === undefined) throw new Error('missing'); return { data: d }; }, mkdir: async () => {}, readdir: async () => ({ files: [] }), deleteFile: async () => {} },
      App: { addListener: async () => ({ remove() {} }), exitApp: async () => {} },
      WidgetBridge: { update: async () => {}, take: async () => ({ ops: '[]', target: '' }) },
      LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }), getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async () => {}, registerActionTypes: async () => {}, addListener: () => ({ remove() {} }) },
    } };
  });
  const fp = await fctx.newPage(); await fp.goto(`http://localhost:${port}/`); await fp.waitForSelector('h1');
  ok('a newer copy in the phone file is loaded when the web storage is empty or older', /From the phone file/.test(await fp.textContent('#view')));
  await fctx.close();
  // notification buttons: Done and Snooze on a task reminder
  ok('task reminders get Done and Snooze buttons', await n.evaluate(() => (window.__actionTypes || []).some(t => t.id === 'DD_TASK' && t.actions.map(a => a.id).join() === 'done,snooze')));
  await n.evaluate(async () => { const c = await import('/js/core.js'); c.S.tasks.push({ id: 'nt1', title: 'Notification task', due: '', important: false, done: false, kind: 'Task' }, { id: 'nt2', title: 'Snooze me', due: '', important: false, done: false, kind: 'Task' }); c.commit(); });
  await n.evaluate(() => { window.__notifAct({ actionId: 'done', notification: { extra: { task: 'nt1' } } }); window.__notifAct({ actionId: 'snooze', notification: { extra: { task: 'nt2' } } }); });
  ok('Done on a notification ticks the task, Snooze gives it a time an hour away', await n.evaluate(async () => { const c = await import('/js/core.js'); const a = c.S.tasks.find(t => t.id === 'nt1'), b = c.S.tasks.find(t => t.id === 'nt2'); return a.done && !!b.time && !!b.due; }));
  await n.evaluate(() => { window.__take = { ops: '[]', target: 'notes:new' }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(300);
  ok('the Notes widget can start a new page', await n.locator('.editor .pg-title').count() === 1);
  await n.evaluate(async () => { const c = await import('/js/core.js'); window.__pid = c.S.pages[c.S.pages.length - 1].id; c.S.pages[c.S.pages.length - 1].title = 'From the widget'; c.ui.nb.page = null; c.commit(); });
  await n.evaluate(() => { window.__take = { ops: '[]', target: 'notes:page:' + window.__pid }; window.dispatchEvent(new Event('widgetOpen')); });
  await n.waitForTimeout(300);
  ok('and open a page directly', (await n.inputValue('.pg-title')) === 'From the widget');
  const wsnap = await n.evaluate(async () => (await import('/js/widgets.js')).buildSnapshot());
  ok('the snapshot carries notes, saved stories and task steps for the widgets', Array.isArray(wsnap.notes) && wsnap.notes.some(x => x.t === 'From the widget') && Array.isArray(wsnap.saved) && wsnap.tasks.filter(t => !t.dn).every(t => 'st' in t && 'imp' in t));
  await n.evaluate(async () => { const c = await import('/js/core.js'); c.ui.nb.page = null; c.go('settings'); });
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
