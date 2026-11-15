# Daily Driver

A personal daily app: today timeline, tasks, notes, calendar, habits, and news with a consulting casebook. It is a dependency-free installable web app (PWA). All your data stays in your browser's local storage.

## Run it

```sh
python3 -m http.server 8000   # or any static server
# open http://localhost:8000, then "Add to Home Screen" on your phone
```

Host the folder on GitHub Pages, Netlify or Cloudflare Pages to use it from your phone every day. Use Settings > Your data to export and import backups.

## What is in it

Five tabs, each a focused screen (Home, Tasks, Notes, Calendar, Learn). Settings is the round button at the top right. The look is frosted glass over a soft colour wash, in the spirit of ColorOS 17; light and dark are chosen in Settings, and the glass can be switched off there for solid panes.

| Tab | What it does |
| --- | --- |
| Home | A glass hero with a progress ring, a countdown to your start date and a line that reacts to how the day is going, a Next up card with a live countdown, on Sundays and Mondays a recap of your week, with today's counts, one capture bar, your to-do list ranked by urgency (ticked items sink to the bottom and can be unticked), what needs you today (calendar items titled "Action:" or "Due:", important mail facts; hidden when there is nothing), today's schedule and a one-line habit strip. Settings opens from the button at the top |
| Learn | News (a lead story and the rest, filtered by World, India, Business or Tech) and Cases (with a practice streak): a practice problem of the day with a suggested approach, the problem-solving playbook, a case library, a toolkit of change and organisation frameworks and a map of HR technology, aimed at HR transformation consulting |
| Tasks | One list grouped by when it is due (Overdue, Today, Next 7 days, Later, No date), with a one-line add bar and a priority toggle. |
| Notes | A notes app: books and pages, lines that are text, headings, bullets, numbers or checkboxes, pinning, search, quick jot, checklist items into tasks. Links shared from other apps and talking points from the news land here. |
| Calendar | Everything dated, like Google Calendar: month grid with dots, a week and day time grid, and an agenda list. Each day lists its events, deadlines ("Due:"), things to do ("Action:"), email key facts ("Mail:") and tasks that fall due, with ticks and an add-event form |

Every news story has a Talking point button that saves an interview-style note (what happened, why it matters, your view). The Track, Goals, Career and Money screens were removed. Their data (journal, goals, applications, expenses and so on) is still kept in the data file and in backups, only the screens are gone. Habits are managed in Settings and ticked on Home.

### Google Calendar sync

Settings (button on Home), then Google Calendar. Paste a calendar's "Secret address in iCal format" (Google Calendar on the web, Settings, pick the calendar, Integrate calendar). Add one per calendar, for example personal and college. Events appear on Today (plus the next 3 days), refresh when you open the app, when you return to it and every 10 minutes while it is open, and get a reminder 15 minutes before. Edits you make in Google Calendar, including moved, cancelled and recurring events, show up after the next sync.

The address is private to anyone holding it, so the app keeps it only on the phone and leaves it out of backups. Reading it only works in the Android app (browsers block it). Google can take a little while to publish a change to that address.

### Home-screen widgets (Android app)

Eleven widgets, all fed from the app so they always agree with it: Overview, Schedule, Tasks, News, Calendar, Habits, Next up, Quick add, Problem of the day, Deadlines and Notes. Every widget has a scrolling list, so a long day or a long task list never gets cut off. Swipe up and down inside the widget to see what is next, tap a row to open that item in the app, tap a round tick to complete a task, deadline or habit without opening the app, and use the buttons in the header to change what the widget shows.

- **Calendar widget:** Month (a grid with a dot for each kind of item, today filled, tap a day to list it below), Week (a strip of seven days over a list of the whole week, grouped by day) and Agenda (the next six weeks). The arrows move by month or week, Today jumps back, and the title opens the Calendar tab.
- **Schedule widget:** arrows step through days; deadlines and to-dos show with coloured bars.
- Dots and bars: teal for events, red for deadlines, amber for things to do, grey for emails, black for tasks.

Widgets read a snapshot the app writes after every change, so open the app once after installing. Taps that change your data are queued and applied the next time the app opens.

### Reminders (Android app)

Settings (the button on Home), then Reminders. A morning plan prompt, an evening reflection prompt, deadline alerts (the day before, the day of, and 3 hours before an application closes) and a 6 PM flashcard nudge. They are scheduled on the phone itself, rebuilt whenever you leave the app, so no server is involved. Open the app now and then so the list stays current.

## Live data (calendar, news)

- **Calendar:** class timetable and sorted mail reach the app as calendar items, read over the secret iCal address (see Google Calendar sync). The scripts that create them run in the owner's own Google account and are not in this repo. `brief/RULES.md` records the item formats the app expects.
- **News:** a GitHub Action (`.github/workflows/news.yml`, `scripts/news.mjs`) reads public RSS feeds at 6 am and 2 pm IST and commits `data/news.json`. The app and the News widget read that file from GitHub.
- `data/brief.json` is sample data only.

## Limits worth knowing

- The deep-work timer dims the app and holds back its own nudges. A web app cannot mute other apps; turn on Do Not Disturb on your phone.
- Timer notifications only fire while the page is open.
- Knowledge content rotates by day from `js/data.js`. Campaign ROI figures are widely reported, not audited; verify before quoting in interviews.
