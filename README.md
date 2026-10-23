# Daily Driver

An all-in-one daily app for an MBA student: AI-style morning brief, knowledge engine, placement CRM, productivity tools and personal finance. It is a dependency-free installable web app (PWA). All your data stays in your browser's local storage.

## Run it

```sh
python3 -m http.server 8000   # or any static server
# open http://localhost:8000, then "Add to Home Screen" on your phone
```

Host the folder on GitHub Pages, Netlify or Cloudflare Pages to use it from your phone every day. Use Money > Ledger > Data to export and import backups.

## What is in it

Five tabs, each a focused screen (Home, Learn, Plan, Calendar, Track). Light and dark themes are chosen in Settings.

| Tab | What it does |
| --- | --- |
| Home | What needs you today: priorities (calendar items titled "Action:" or "Due:", deadlines, reminders), today's schedule, your top 3, habits, and a close-the-day prompt. Settings opens from the button at the top |
| Learn | Daily five with a streak (guesstimate, framework, jargon, mental model, news), a News tab, spaced-repetition flashcards, a library with notes and a "today I learned" log |
| Plan | Task triage and the Eisenhower matrix, goals with milestones, and (while the Career module is on) applications, network and interview stories |
| Calendar | Everything dated, like Google Calendar: month grid with dots, a week and day time grid, and an agenda list. Each day lists its events, deadlines ("Due:"), things to do ("Action:"), email key facts ("Mail:") and tasks that fall due, with ticks and an add-event form |
| Track | Today's numbers, habits with a 12-week heatmap, focus timer by goal or skill, journal, weekly review and 30-day insights |
| Money | Monthly budget, spending log and subscription renewal reminders (optional module) |

### Google Calendar sync

Settings (button on Home), then Google Calendar. Paste a calendar's "Secret address in iCal format" (Google Calendar on the web, Settings, pick the calendar, Integrate calendar). Add one per calendar, for example personal and college. Events appear on Today (plus the next 3 days), refresh when you open the app, when you return to it and every 10 minutes while it is open, and get a reminder 15 minutes before. Edits you make in Google Calendar, including moved, cancelled and recurring events, show up after the next sync.

The address is private to anyone holding it, so the app keeps it only on the phone and leaves it out of backups. Reading it only works in the Android app (browsers block it). Google can take a little while to publish a change to that address.

### Home-screen widgets (Android app)

Seven widgets, all fed from the app so they always agree with it: Overview, Schedule, Tasks, News, Habits, Everything and Calendar. Every widget has a scrolling list, so a long day or a long task list never gets cut off. Swipe up and down inside the widget to see what is next, tap a row to open that item in the app, tap a round tick to complete a task, deadline or habit without opening the app, and use the buttons in the header to change what the widget shows.

- **Calendar widget:** Month (a grid with a dot for each kind of item, today filled, tap a day to list it below), Week (a strip of seven days over a list of the whole week, grouped by day) and Agenda (the next six weeks). The arrows move by month or week, Today jumps back, and the title opens the Calendar tab.
- **Schedule widget:** arrows step through days; deadlines and to-dos show with coloured bars.
- Dots and bars: teal for events, red for deadlines, amber for things to do, grey for emails, black for tasks.

Widgets read a snapshot the app writes after every change, so open the app once after installing. Taps that change your data are queued and applied the next time the app opens.

### Reminders (Android app)

Settings (the button on Home), then Reminders. A morning plan prompt, an evening reflection prompt, deadline alerts (the day before, the day of, and 3 hours before an application closes) and a 6 PM flashcard nudge. They are scheduled on the phone itself, rebuilt whenever you leave the app, so no server is involved. Open the app now and then so the list stays current.

## Live data (Gmail, Calendar, news)

A browser-only app cannot read your Gmail or Calendar without OAuth and a backend. The Home tab reads `data/brief.json` (currently sample data) with this shape:

```json
{ "events": [{"title": "", "date": "YYYY-MM-DD", "time": "HH:MM", "interview": false, "company": ""}],
  "inbox":  [{"id": "", "from": "", "subject": "", "action": "", "tag": ""}],
  "news":   [{"cat": "International|Indian|Business|Tech", "title": "", "summary": "", "why": "", "src": ""}] }
```

Generate this file each morning (a scheduled script or Claude routine that reads Gmail, Calendar and news and writes the JSON) and the app picks it up. The service worker is network-first, so a fresh file always wins.

## Limits worth knowing

- The deep-work timer dims the app and holds back its own nudges. A web app cannot mute other apps; turn on Do Not Disturb on your phone.
- Timer notifications only fire while the page is open.
- Knowledge content rotates by day from `js/data.js`. Campaign ROI figures are widely reported, not audited; verify before quoting in interviews.

## Daily brief routine

The live brief is published to a private Claude page, not this public repo, because it contains real email content. `brief/RULES.md` holds the filtering rules and `brief/page.template.html` the page template. Edit the rules file to change what gets surfaced.
