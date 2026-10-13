// Entry point: loads modules, wires events, boots the app.
import { ui, app, render, commit, go } from './core.js';
import { save } from './store.js';
import { isNative, initBackButton } from './native.js';
import { refreshReminders } from './reminders-run.js';
import { syncAll, onCalendarChange } from './calendar.js';
import { pushSoon, pushNow, syncFromWidgets, openTarget } from './widgets.js';
import './views/home.js';
import './views/learn.js';
import './views/plan.js';
import './views/track.js';
import './sections/focus.js';
import './sections/money.js';
import './sections/body.js';
import './sections/career.js';
import './sections/settings.js';

Object.assign(app.actions, {
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
  app.actions[el.dataset.act](el.dataset, el);
  commit();
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-form]');
  if (!form || !app.forms[form.dataset.form]) return;
  e.preventDefault();
  app.forms[form.dataset.form](Object.fromEntries(new FormData(form)), form);
  commit();
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
  initBackButton(() => ui.view === 'home', () => go('home'));
  if ('serviceWorker' in navigator && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
