// Entry point: loads modules, wires events, boots the app.
import { ui, app, render, commit, go } from './core.js';
import { save } from './store.js';
import { isNative, initBackButton } from './native.js';
import './views/today.js';
import './views/plan.js';
import './views/learn.js';
import './views/growth.js';
import './views/more.js';
import './sections/focus.js';
import './sections/money.js';
import './sections/career.js';
import './sections/settings.js';

Object.assign(app.actions, {
  sub: d => { ui.sub[d.group] = d.id; },
  openSource: d => { ui.view = d.view; if (d.section) ui.sub.more = d.section; },
});

document.addEventListener('click', e => {
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

(async function boot() {
  try { app.brief = await (await fetch('data/brief.json', { cache: 'no-cache' })).json(); } catch { /* offline: render without brief */ }
  render();
  initBackButton(() => ui.view === 'today', () => go('today'));
  if ('serviceWorker' in navigator && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
