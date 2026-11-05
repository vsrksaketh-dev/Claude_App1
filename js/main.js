// Entry point: loads modules, wires events, boots the app.
import { ui, app, render, commit, go } from './core.js';
import { save } from './store.js';
import { countdownText } from './util.js';
import { parseQuick, describe } from './nlp.js';
import { watchErrors, logProblem } from './log.js';
watchErrors(() => ui.view);
import { isNative, initBackButton, autoBackup, initNotificationActions, readStateFile, writeStateFile } from './native.js';
import { completeTask, toggleHabit, habitDone } from './logic.js';
import { exportJSON, setMirror, adopt } from './store.js';
import { S } from './core.js';
import { today, addDays } from './util.js';
import { refreshReminders } from './reminders-run.js';
import { syncAll, onCalendarChange } from './calendar.js';
import { pushSoon, pushNow, syncFromWidgets, openTarget } from './widgets.js';
import './gestures.js';
import './views/home.js';
import './views/learn.js';
import './taskui.js';
import './views/tasks.js';
import './views/notes.js';
import './views/routine.js';
import './views/search.js';
import './views/academics.js';
import './views/review.js';
import './views/calendar.js';
import './sections/settings.js';

// Live preview under any quick-add box: what the typed words will set (date, time, priority, repeat).
app.inputs.nlp = el => { const out = el.parentElement.querySelector('.parsed'); if (!out) return; const d = describe(parseQuick(el.value)); out.textContent = d; out.hidden = !d; };
Object.assign(app.actions, {
  sheetClose: () => { ui.sheet = null; },
  sub: d => { ui.sub[d.group] = d.id; },
  openSource: d => { ui.view = d.view; if (d.section) ui.sub[d.view] = d.section; },
});

document.addEventListener('click', e => {
  const to = e.target.closest('[data-go]');
  if (to) { openTarget(to.dataset.go); return; }
  const nav = e.target.closest('[data-nav]');
  if (nav) { go(nav.dataset.nav, nav.dataset.sub ? { [nav.dataset.nav]: nav.dataset.sub } : undefined); return; }
  const el = e.target.closest('[data-act]');
  if (!el || !app.actions[el.dataset.act]) return;
  if (el.type === 'checkbox' && el.checked) app.pop = el.closest('[data-flip]')?.dataset.flip || '';
  try { app.actions[el.dataset.act](el.dataset, el); } catch (err) { logProblem('action', err, `${ui.view} · ${el.dataset.act}`); }
  if (el.dataset.close) { if (ui.sheet && ui.sheet.kind === 'menu') ui.sheet = null; }
  commit();
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]');
  if (!form || !app.forms[form.dataset.form]) return;
  e.preventDefault();
  try { app.forms[form.dataset.form](Object.fromEntries(new FormData(form)), form); } catch (err) { logProblem('form', err, `${ui.view} · ${form.dataset.form}`); }
  commit();
  // Quick-add bars keep the keyboard open so several tasks can be typed in a row.
  if (form.hasAttribute('data-keep')) { const again = document.querySelector(`[data-form="${form.dataset.form}"] input, [data-form="${form.dataset.form}"] textarea`); if (again) again.focus({ preventScroll: true }); }
});
document.addEventListener('input', e => {
  const h = app.inputs[e.target.dataset.bind];
  if (h) { h(e.target); save(); }
});

// News is public, so the daily routine commits data/news.json to the repo and the app reads the newest copy from there.
// Order: live copy from GitHub, then the last copy cached on the device, then the file bundled with the app.
const NEWS_URL = 'https://raw.githubusercontent.com/vsrksaketh-dev/Claude_App1/refs/heads/claude/zealous-cerf-fnwxob/data/news.json';
const NEWS_KEY = 'daily-driver-news';
async function loadNews() {
  const pick = j => (j && Array.isArray(j.items) && (app.news = j, true));
  try { const r = await fetch(NEWS_URL, { cache: 'no-cache' }); if (r.ok && pick(await r.json())) { try { localStorage.setItem(NEWS_KEY, JSON.stringify(app.news)); } catch { /* storage full */ } return; } } catch { /* offline */ }
  try { if (pick(JSON.parse(localStorage.getItem(NEWS_KEY)))) return; } catch { /* nothing cached */ }
  try { pick(await (await fetch('data/news.json')).json()); } catch { /* no news */ }
}

(async function boot() {
  // In the app, the phone file holds the newest copy if the web view's storage was full or cleared: take it before drawing anything.
  if (isNative()) {
    const file = await readStateFile();
    if (file && (file.meta?.savedAt || 0) > (S.meta.savedAt || 0)) { adopt(file); logProblem('info', 'Loaded the newer copy from the phone file', 'boot'); }
    setMirror(writeStateFile);
    writeStateFile(exportJSON());
  }
  try { app.brief = await (await fetch('data/brief.json', { cache: 'no-cache' })).json(); } catch { /* offline: render without brief */ }
  await loadNews();
  render();
  refreshReminders();
  // Calendar: sync now, whenever the app comes back to the front, and every 10 minutes while it is open.
  // Never re-render while the user is typing, or the form would be wiped.
  const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  onCalendarChange(() => { if (!typing()) render(); refreshReminders(); pushSoon(); });
  syncAll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAll(); });
  setInterval(() => { if (!document.hidden) syncAll(true); }, 10 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { refreshReminders(); pushNow(); } });
  app.afterCommit = pushSoon;
  syncFromWidgets();
  pushSoon();
  window.addEventListener('widgetOpen', syncFromWidgets);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncFromWidgets(); });
  initBackButton(() => ui.view === 'home' && !ui.nb.page && !ui.sheet, () => { if (ui.sheet) { ui.sheet = null; render(); } else if (ui.view === 'notes' && ui.nb.page) { ui.nb.page = null; render(); } else go('home'); });
  // Live countdowns (Next up on Home) tick without redrawing the page, so nothing being typed is disturbed.
  setInterval(() => document.querySelectorAll('[data-countdown]').forEach(el => { el.textContent = countdownText(Number(el.dataset.countdown)); }), 20000);
  // Reopening the app after a while: refresh the news and the widgets so neither shows yesterday.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadNews().then(() => { if (!typing()) render(); pushSoon(); }); });
  // Done / Snooze pressed on a notification.
  initNotificationActions(({ action, extra }) => {
    const t = extra.task && S.tasks.find(x => x.id === extra.task);
    if (t && action === 'done') completeTask(t.id);
    if (t && action === 'snooze') { const n = new Date(Date.now() + 36e5); t.due = today() < (t.due || '') ? t.due : today(); if (n.getDate() !== new Date().getDate()) t.due = addDays(today(), 1); t.time = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; }
    const h = extra.habit && S.habits.find(x => x.id === extra.habit);
    if (h && action === 'done' && !habitDone(h, extra.day || today())) toggleHabit(h, extra.day || today());
    if (t && action === 'tap') go('tasks');
    commit(); refreshReminders();
  });
  // Once a day, keep a copy of everything in the phone's private storage (Settings > Automatic backups can restore it).
  const daily = () => { if (S.meta.autoAt === today()) return; autoBackup(`dd-${today()}.json`, exportJSON()).then(ok => { if (ok) { S.meta.autoAt = today(); save(); } }).catch(() => {}); };
  setTimeout(daily, 4000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) daily(); });
  // Every minute, redraw the screens that show time (Home, Calendar) so "Next up", past events and the now line stay current; never while typing.
  setInterval(() => { if (!document.hidden && !typing() && ['home', 'calendar'].includes(ui.view)) render(); }, 60e3);
  if ('serviceWorker' in navigator && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
