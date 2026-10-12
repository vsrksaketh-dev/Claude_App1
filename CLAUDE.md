# Daily Driver: developer notes

A personal, long-lived self-monitoring and self-development app. Plain ES modules, no build step, no dependencies. It is an installable web app (PWA); all data lives in the browser's localStorage on the user's device.

## Run and test
```sh
python3 -m http.server 8000            # serve the repo root
node tests/smoke.cjs <path-to-playwright> 8000   # end-to-end smoke test (needs Chromium)
```
Run the smoke test after any change to `js/`. It covers every screen, persistence and the v1 to v2 data migration.

## Layout
- `js/core.js`: shared state `S`, UI state `ui`, the `app` registry, `register()`, `render()`, `commit()`.
- `js/store.js`: schema, `migrate()`, save/export/import. **State shape is documented in `blank()`.**
- `js/logic.js`: domain logic (habit streaks, flashcard scheduling, task quadrants, weekly summary). No HTML.
- `js/util.js`: pure helpers (dates, escaping). `js/ui.js`: shared HTML snippets (tabs, bars, heatmap).
- `js/data.js`: static learning content (frameworks, guesstimates, jargon, mental models, prompts).
- `js/views/*`: bottom-nav screens: Today, Plan, Learn, Growth, More.
- `js/sections/*`: sub-screens inside More: Focus, Money, Career, Settings.
- `js/main.js`: event delegation and boot. `sw.js`: service worker (network first). Bump its cache name when adding files to `ASSETS`.
- `brief/`: rules and template for the daily brief routine (see Privacy).

## How things work
- Rendering is whole-screen template strings. Every interaction goes through `data-act` (click), `data-form` (submit) or `data-bind` (live typing, no re-render). Handlers are registered by each module and run through `commit()` which saves and re-renders.
- Always wrap user text in `esc()` before putting it in HTML.
- Extension points so modules do not import each other: `app.nudgeSources` (lines for "Needs attention"), `app.taskSources` (derived tasks for the Plan matrix), `app.todayCards` (extra cards on Today).

## Adding things
- **New section in More:** create `js/sections/x.js`, call `register({ id, label, section: true, order, enabled?, render, actions, forms, inputs })`, import it in `main.js`, add it to `sw.js` ASSETS. To make it switchable, add a flag to `modules` in `store.js` and a row in Settings.
- **New top-level screen:** register without `section`, add a button in `index.html`'s nav (keep to five).
- **Changing stored data:** add the new field with a default in `blank()`. If an old shape must change, bump `SCHEMA` and add a step in `migrate()`. Never drop user data silently, and add a migration test to `tests/smoke.cjs`.

## Privacy rules (the GitHub repo is public)
- Never commit real personal data: email content, deadlines, names, class schedules, addresses, tokens.
- `data/brief.json` is sample data only. The live daily brief is published to a private Claude page by a scheduled routine that follows `brief/RULES.md` and fills `brief/page.template.html`.

## Product principles
- Daily use should take minutes. Capture is one field; sorting happens later.
- Show progress honestly (streaks skip unscheduled days, short history shows a dash, not 0%).
- Placement is an optional module that the user will switch off after being placed. Keep the core independent of it.
