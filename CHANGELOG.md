# Changelog

Newest first. One line per change, in plain words. The full detail is in `git log`.

## 15 Nov 2026
- **News without Claude.** A GitHub Action (`.github/workflows/news.yml`, script `scripts/news.mjs`) reads public RSS feeds at 6 am and 2 pm IST and writes `data/news.json`. Cards that have no "Why it matters" line now hide that line instead of showing an empty one.
- Smoke test no longer fails on Sundays and Mondays, when the weekly review banner shows above the exam banner.
- Mail and calendar automation moved out of Claude: Google Apps Script handles the class timetable and inbox sorting, and two short Claude sweeps (2 pm and 9 pm IST) handle the mail that needs judgment. These scripts are not in this repo because they hold personal sender rules.

## 12 Nov 2026
- Notes: calmer list and editor, page menu lined up with the page edge.
- Widgets: lists scroll on Android 12 and later (Notes included), instead of tap-and-page arrows.

## 5 Nov 2026
- Widgets rebuilt from the ground up: fixed frames, rows drawn in place, direct taps, fail-safe drawing, calendar widget in all four modes.
- v3 look: Paper and Night themes, Inter type, line icons, flat sections, sheets, swipe and long-press.
- Home became the Today timeline with free-slot planning. Classes and exams with revision targets and attendance. Weekly review.
- Natural-language quick add, problem log, state mirrored to a phone file, 14-day reminders, shared links go to read-later.
- Photos and files on notes, Done and Snooze on reminders, Edit in Google Calendar, Notes widget, saved news stories.
- Robustness pass: notes trash and undo, editable and repeating events, app-wide search, daily automatic backups, minute refresh.
- Links as buttons (join class, open document, mail), task times, repeats and reminders.

## 4 Nov 2026
- Notes app with books, pages and blocks. Tasks and Notes became their own tabs.
- Routine: weekly goals, counters, workout types, streaks, nudges.
- Widget layouts: deadline countdown tiles, Next up card, Quick add tiles.
- Settings opens from the three dots at the top right.
- Native calendar refresh for widgets, share-into-app, smarter nudges, News and a consulting casebook in Learn.

## 23 Oct 2026
- Beige and blue theme, scrollable widgets, a calendar widget and Calendar tab, a habits widget, tasks that sink when ticked.

## 12 to 18 Oct 2026
- First Android home-screen widgets (overview, schedule, tasks, news, everything), interactive and size-aware, with tab deep links.
- Home, Track, Learn and Plan reshuffles, tickable attention items that expire, "Mail:" items for undated important emails.
