# Daily Driver: developer notes

A personal, long-lived self-monitoring and self-development app. Plain ES modules, no build step, no dependencies. It is an installable web app (PWA); all data lives in the browser's localStorage on the user's device.

## Run and test
```sh
python3 -m http.server 8000            # serve the repo root
node tests/smoke.cjs <path-to-playwright> 8000   # end-to-end smoke test (needs Chromium)
node tests/ics.test.mjs                          # calendar reader unit tests
```
Run the smoke test after any change to `js/`. It covers every screen, persistence and the v1 to v2 data migration.

## Layout
- `js/core.js`: shared state `S`, UI state `ui`, the `app` registry, `register()`, `render()`, `commit()`.
- `js/store.js`: schema, `migrate()`, save/export/import. **State shape is documented in `blank()`.**
- `js/logic.js`: domain logic (habit streaks, flashcard scheduling, task quadrants, weekly summary). No HTML.
- `js/util.js`: pure helpers (dates, escaping). `js/ui.js`: shared HTML snippets (tabs, bars, heatmap).
- `js/data.js`: static learning content (frameworks, guesstimates, jargon, mental models, prompts).
- `js/views/*`: screens in the bottom bar: Home, Learn, Plan, Track (four tabs). `js/sections/*`: feature modules: Money, Body (workout log, calories), Focus (all shown inside Track), Settings (opened from the button on Home, no tab) and Career (shown as tabs inside Plan).
- `js/ics.js`: iCalendar reader (time zones, all-day, recurrence). `js/calendar.js`: calendar sync, secret addresses kept in their own storage keys (never in `S` or backups). `js/native.js`: Android bridge (uses `window.Capacitor.Plugins`; there is no bundler, so never call `registerPlugin` or import `@capacitor/*` in `js/`). The smoke test simulates the bridge. `js/reminders*.js`: local notifications.
- `js/main.js`: event delegation and boot. `sw.js`: service worker (network first). Bump its cache name when adding files to `ASSETS`.
- `js/schedule.js`: the day's items from all sources. `js/widgets.js`: builds a JSON snapshot after each change and hands it to `WidgetBridge.update` (`js/native.js`). `android-native/`: Java widget providers, layouts and manifest receivers that CI copies into the generated Android project. Widgets read the snapshot, never the web app. Any snapshot field change needs the Java side updated too. Widgets are interactive: ticks and page flips are handled natively and queued as ops that `syncFromWidgets()` applies when the app next opens; a tap carries a target like `learn:news` or `plan:tasks:add` that `openTarget()` turns into a tab. Layout adapts to the widget's height.
- `brief/`: rules and template for the daily brief routine (see Privacy).

## How things work
- Rendering is whole-screen template strings. Every interaction goes through `data-act` (click), `data-form` (submit) or `data-bind` (live typing, no re-render). Handlers are registered by each module and run through `commit()` which saves and re-renders.
- Always wrap user text in `esc()` before putting it in HTML.
- Extension points so modules do not import each other: `app.nudgeSources` (lines for "Needs attention"), `app.taskSources` (derived tasks for the Plan matrix), `app.todayCards` (extra cards on Today).

## Adding things
- **New screen:** create the file, call `register({ id, label, nav: <position>, enabled?, render, actions, forms, inputs })`, import it in `main.js`, add it to `sw.js` ASSETS. The bottom bar is built from views that have `nav` (keep it to five). A view without `nav` (Settings) is opened with a `data-nav` link. To make a module switchable, add a flag to `modules` in `store.js` and a row in Settings.
- **New tab inside a screen:** add it to that screen's tab list and page map (see `plan.js`, which pulls in the Career pages).
- **Changing stored data:** add the new field with a default in `blank()`. If an old shape must change, bump `SCHEMA` and add a step in `migrate()`. Never drop user data silently, and add a migration test to `tests/smoke.cjs`.

## Privacy rules (the GitHub repo is public)
- Never commit real personal data: email content, deadlines, names, class schedules, addresses, tokens, calendar addresses.
- `data/brief.json` is sample data only. The live daily brief is published to a private Claude page by a scheduled routine that follows `brief/RULES.md` and fills `brief/page.template.html`.

## Product principles
- Daily use should take minutes. Capture is one field; sorting happens later.
- Show progress honestly (streaks skip unscheduled days, short history shows a dash, not 0%).
- Placement is an optional module that the user will switch off after being placed. Keep the core independent of it.

## Visual design rules
- Soft and welcoming: rounded cards on a calm tinted background, pill buttons and pill-shaped tabs, round checkboxes, a floating rounded bottom bar. One friendly typeface (Plus Jakarta Sans, bundled in `fonts/`) and one teal accent; amber, red and green are for state only.
- No emoji, no icon sets, no gradients. Navigation and section titles are plain words. Never use serif type or all-caps tracked labels (they read as the generic editorial look the user rejected).
- Light and dark are both designed and chosen in Settings (Light, Dark, Match phone). All colours are tokens at the top of `css/styles.css`; add any new colour to all three blocks (light, dark via media query, and `[data-theme="dark"]`).
- Home is only what needs the user today. News and learning live in Learn, trackers and charts in Track, tasks and applications in Plan.
- Keep `main` a single-column grid with `minmax(0, 1fr)`; without it wide content stretches past the screen.
