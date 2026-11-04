# Daily Driver: developer notes

A personal, long-lived self-monitoring and self-development app. Plain ES modules, no build step, no dependencies. It is an installable web app (PWA); all data lives in the browser's localStorage on the user's device.

## Run and test
```sh
python3 -m http.server 8000            # serve the repo root
node tests/smoke.cjs <path-to-playwright> 8000   # end-to-end smoke test (needs Chromium)
node tests/ics.test.mjs                          # calendar reader unit tests
sh tests/widgets/run.sh <path-to-playwright> 8000 # widget Java on the JVM against stand-in Android classes (needs java)
```
Run the smoke test after any change to `js/`, and the widget test after any change to `android-native/`, `js/ics.js` or the snapshot in `js/widgets.js`. It covers every screen, persistence and the v1 to v2 data migration.

## Layout
- `js/core.js`: shared state `S`, UI state `ui`, the `app` registry, `register()`, `render()`, `commit()`.
- `js/store.js`: schema, `migrate()`, save/export/import. **State shape is documented in `blank()`.**
- `js/logic.js`: domain logic (habit streaks, task ranking and completion). No HTML.
- `js/util.js`: pure helpers (dates, escaping). `js/ui.js`: shared HTML snippets (tabs, bars, heatmap).
- `js/data.js`: frameworks and thinking models. `js/casebook.js`: the consulting casebook shown under Learn > Cases (playbook, cases, practice problems, toolkit, HR tech map).
- `js/views/*`: screens in the bottom bar: Home, Learn (News and Cases), Plan, Calendar (four tabs; that is the limit). `js/agenda.js`: everything dated on a day (calendar events, hand-typed events, deadlines, to-dos, email facts, tasks due) with a kind; the Calendar tab and the widget snapshot both read it. `js/sections/settings.js`: Settings (opened from the button on Home, no tab), which also manages habits. The old Track, Goals, Career, Money, Body and Focus screens were removed on purpose; their data stays in `blank()` and in backups, never dropped.
- `js/ics.js`: iCalendar reader (time zones, all-day, recurrence). `js/calendar.js`: calendar sync, secret addresses kept in their own storage keys (never in `S` or backups). The Android widgets re-read the calendars on their own: `IcsReader.java` is a Java twin of `ics.js` and `CalendarSync.java` mirrors `calendar.js` and `agenda.js` (kinds, hidden words, the Needs-you list). Keep the pairs in step; `tests/widgets` compares the two readers on `tests/fixtures/sample.ics`. `js/native.js`: Android bridge (uses `window.Capacitor.Plugins`; there is no bundler, so never call `registerPlugin` or import `@capacitor/*` in `js/`). The smoke test simulates the bridge. `js/reminders*.js`: local notifications.
- `js/main.js`: event delegation and boot. `sw.js`: service worker (network first). Bump its cache name when adding files to `ASSETS`.
- `js/schedule.js`: the day's items from all sources. `js/widgets.js`: builds a JSON snapshot after each change and hands it to `WidgetBridge.update` (`js/native.js`). `android-native/`: Java widget providers, layouts and manifest receivers that CI copies into the generated Android project. Widgets read the snapshot, never the web app. There are ten: Overview, Schedule, Tasks, News, Calendar, Habits, Next up, Quick add, Problem of the day, Deadlines (a removed widget's kind number, 4, stays unused). Every widget is a header, buttons and a scrolling `ListView` fed by `WidgetListService` and `WidgetRows`; row taps go through one mutable pending-intent template to `WidgetRouteActivity`, which has no screen and either opens a tab or applies a tick. The calendar widget draws its month grid or week strip as static cells above the list. Any snapshot field change needs the Java side updated too. Widgets are interactive: ticks and page flips are handled natively and queued as ops that `syncFromWidgets()` applies when the app next opens; a tap carries a target like `learn:news` or `plan:tasks:add` that `openTarget()` turns into a tab (old `track:*` targets open Home). Layout adapts to the widget's height. `NewsSync.java` lets the News (and Everything) widget fetch `data/news.json` from GitHub by itself on each system refresh, so news stays fresh with the app closed; task due labels are computed natively from the due date for the same reason.
- `brief/`: rules and template for the daily brief routine (see Privacy).

## How things work
- Rendering is whole-screen template strings. Every interaction goes through `data-act` (click), `data-form` (submit) or `data-bind` (live typing, no re-render). Handlers are registered by each module and run through `commit()` which saves and re-renders.
- Always wrap user text in `esc()` before putting it in HTML.
- Extension points so modules do not import each other: `app.nudgeSources` (lines for "Needs attention"), `app.taskSources` (derived tasks for the Plan matrix), `app.todayCards` (extra cards on Today).

## Adding things
- **New screen:** create the file, call `register({ id, label, nav: <position>, enabled?, render, actions, forms, inputs })`, import it in `main.js`, add it to `sw.js` ASSETS. The bottom bar is built from views that have `nav` (keep it to five). A view without `nav` (Settings) is opened with a `data-nav` link. To make a module switchable, add a flag to `modules` in `store.js` and a row in Settings.
- **New tab inside a screen:** add it to that screen's tab list and page map (see `plan.js`, which pulls in the Career pages).
- **Changing stored data:** add the new field with a default in `blank()`. If an old shape must change, bump `SCHEMA` and add a step in `migrate()`. Never drop user data silently, and add a migration test to `tests/smoke.cjs`.

- Android entry points: text shared into the app (`ACTION_SEND`) becomes a task and a note through the same op queue as widget ticks (`capture`), and four long-press icon shortcuts are in `android-native/res/xml/shortcuts.xml`; the workflow patches both into the generated manifest.

## Privacy rules (the GitHub repo is public)
- The secret iCal addresses are also copied into the Android app's private storage (SharedPreferences) so widgets can refresh by themselves. They never go anywhere except Google's own calendar servers.
- Never commit real personal data: email content, deadlines, names, class schedules, addresses, tokens, calendar addresses.
- `data/brief.json` is sample data only. The live daily brief is published to a private Claude page by a scheduled routine that follows `brief/RULES.md` and fills `brief/page.template.html`.

## Product principles
- Daily use should take minutes. Capture is one field; there is no sorting step. The user opens the app for fun, so every screen must look finished and feel light; when in doubt, remove rather than add.
- Show progress honestly (streaks skip unscheduled days).
- Learn is news plus a consulting casebook for an HR transformation (HCOT) career. Keep new learning content there and keep it factual; cases summarise widely reported public accounts and say so.

## Visual design rules
- Frosted glass, in the spirit of the user's ColorOS 17 phone (OnePlus 15R): translucent panes (`backdrop-filter` blur) with a lit rim, over a soft fixed wash of peach, dusty blue and lilac behind everything (the only place gradients belong, together with the Home hero glow). A floating, pill-shaped island bar at the bottom. Big round corners, pill buttons and tabs, round checkboxes. Peach and dusty blue are the brand colours (the user's icon pack). Two typefaces, both bundled in `fonts/`: Poppins for text and Fredoka for titles and big numbers. Amber, red and green are for state only.
- Contrast comes first: panes are never so transparent that text is hard to read; `--ink` and `--muted` are tuned for that. Nested rows inside a pane use the flat `--inset` tint, not another blur (cost and muddiness). Settings > Frosted glass turns the blur off (`data-glass="off"`), and `prefers-reduced-transparency` does the same.
- No emoji, no icon sets. Navigation and section titles are plain words. Never use serif type or all-caps tracked labels.
- Light and dark are both designed and chosen in Settings (Light, Dark, Match phone). All colours are tokens at the top of `css/styles.css`; add any new colour to all three blocks (light, dark via media query, and `[data-theme="dark"]`). Widget colours live in `android-native/res/values*/dd_colors.xml`; widget panes are about 90% opaque so they stay readable over any wallpaper.
- Lists that can be ticked (Home to-do, Plan, needs-attention, habits, calendar days, the Tasks and Habits widgets) keep ticked rows at the bottom, struck through, and rows glide to their new place (`data-flip`, see `render()` in `core.js`). Unticking lifts them back. Tasks ticked today stay visible; older ones move to Earlier.
- Motion is gentle (entrance rise, tick pop, list glide) and switched off by `prefers-reduced-motion`.
- Home is only what needs the user today and opens with the to-do list. Cards that have nothing to show (Needs your attention, Habits) are hidden rather than showing an empty state.
- Keep `main` a single-column grid with `minmax(0, 1fr)`; without it wide content stretches past the screen.
