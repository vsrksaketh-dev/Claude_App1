# Daily Driver

An all-in-one daily app for an MBA student: AI-style morning brief, knowledge engine, placement CRM, productivity tools and personal finance. It is a dependency-free installable web app (PWA). All your data stays in your browser's local storage.

## Run it

```sh
python3 -m http.server 8000   # or any static server
# open http://localhost:8000, then "Add to Home Screen" on your phone
```

Host the folder on GitHub Pages, Netlify or Cloudflare Pages to use it from your phone every day. Use Money > Ledger > Data to export and import backups.

## What is in it

A daily driver for staying on target and getting better over time. Five areas in the bottom bar:

| Area | What it does |
| --- | --- |
| Today | Greeting and day score, one-field quick capture, needs-attention nudges, your top 3, calendar, habits with streaks, email actions and news from the brief, the daily five, a close-the-day prompt |
| Plan | Triage for captured items, Eisenhower matrix that re-sorts as deadlines approach, goals with milestones, linked habits and focus hours |
| Learn | Daily five (guesstimate, framework, jargon, mental model, news) with a streak, spaced-repetition flashcards, a library with notes, a "today I learned" log, weekly reading |
| Growth | Habits with a 12-week heatmap, daily journal with mood and energy, weekly review with auto stats, 30-day insights |
| More | Focus timer tagged by goal or skill, Money (budget and subscriptions), Career and placement (optional, switch off after you are placed), Settings and backup |

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
