// App shell: shared state, the view/section registry and render loop.
// Feature modules call register() with { id, label, nav, enabled, render, actions, forms, inputs }.
// A view with a numeric `nav` appears in the bottom bar (five of them); one without (Settings) is opened from a link.
// Extension points other modules can push into: app.nudgeSources, app.taskSources, app.todayCards.
import { get, save } from './store.js';
import { logProblem } from './log.js';
import { icon } from './icons.js';
const NAV_ICON = { home: 'home', tasks: 'tasks', notes: 'notes', calendar: 'calendar', learn: 'learn' };

export const S = get();
export const ui = { view: 'home', sub: {}, sheet: null };   // sheet: { kind, ... } when a bottom sheet is open
export const app = {
  brief: { events: [], inbox: [] },
  news: { date: '', items: [] },   // public daily news, refreshed by the brief routine (data/news.json)
  views: {},        // screens; those with a `nav` order are in the bottom bar
  sections: {},     // feature modules that only contribute actions and forms
  actions: {},      // data-act handlers:   (dataset, element) => void
  forms: {},        // data-form handlers:  (fields, formElement) => void
  inputs: {},       // data-bind handlers:  (element) => void   (no re-render)
  nudgeSources: [], // () => string[]            lines for "Needs attention"
  taskSources: [],  // () => task[]              derived tasks shown in the matrix
  todayCards: [],   // () => html string         extra cards on Home
  after: [],        // () => void               run after every screen is drawn (notes editor: sizing and caret)
  afterCommit: null, // () => void               called after every saved change (used to refresh widgets)
  pop: '',          // data-flip key of the checkbox just ticked, so it can bounce after the re-render
  sheets: {},       // kind -> (ui.sheet) => html       bottom sheets (task editor, event editor, menus)
  menus: {},        // kind -> (id) => [{ label, icon, act, data, danger }]   long-press menus
};
export const $ = s => document.querySelector(s);

export function register(m) {
  (m.section ? app.sections : app.views)[m.id] = m;
  Object.assign(app.actions, m.actions || {});
  Object.assign(app.forms, m.forms || {});
  Object.assign(app.inputs, m.inputs || {});
}

export function applyTheme() {
  const r = document.documentElement;
  if (!S.theme || S.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
  const h = new Date().getHours();
  r.setAttribute('data-part', h >= 5 && h < 11 ? 'morning' : h < 17 && h >= 11 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night');   // the colour wash follows the time of day
  if (S.glass === false) r.setAttribute('data-glass', 'off'); else r.removeAttribute('data-glass');   // glass is on unless switched off in Settings
}
// The bottom bar is built from the registry: views with a `nav` order, hidden when their module is off.
function renderNav() {
  const items = Object.values(app.views).filter(v => v.nav && (!v.enabled || v.enabled())).sort((a, b) => a.nav - b.nav);
  $('#nav').innerHTML = items.map(v => `<button data-nav="${v.id}" class="${v.id === ui.view ? 'on' : ''}" aria-label="${v.label}">${icon(NAV_ICON[v.id] || 'home', 21)}<span>${v.label}</span></button>`).join('');
}
let lastView = null;
const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
// Rows marked data-flip glide to their new place when a list re-sorts (a ticked task sinking to the bottom, an unticked one rising).
function glide(before) {
  if (!before.size || calm()) return;
  $('#view').querySelectorAll('[data-flip]').forEach(el => {
    const old = before.get(el.dataset.flip);
    if (old === undefined || !el.animate) return;
    const dy = old - el.getBoundingClientRect().top;
    if (Math.abs(dy) > 2) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.3, 1.35, .5, 1)' });
  });
}
export function render() {
  applyTheme();
  const before = new Map();
  if (lastView === ui.view) $('#view').querySelectorAll('[data-flip]').forEach(el => before.set(el.dataset.flip, el.getBoundingClientRect().top));
  let v = app.views[ui.view];
  if (!v || (v.enabled && !v.enabled())) { ui.view = 'home'; v = app.views.home; }
  try { $('#view').innerHTML = v.render(); } catch (e) {
    // A broken screen must never leave the app stuck: forget the tab choices and offer a way back.
    console.error(e); logProblem('screen', e, ui.view); ui.sub = {};
    $('#view').innerHTML = '<section class="card"><h2>Something went wrong on this screen</h2><p class="muted">Your data is safe. Tap below to reopen it.</p><div class="row" style="margin-top:10px"><button class="primary" data-nav="' + ui.view + '">Reopen</button><button data-nav="home">Go to Home</button></div></section>';
  }
  $('#view').classList.toggle('enter', lastView !== ui.view && !calm());
  glide(before);
  if (app.pop) { const k = app.pop; app.pop = ''; [...$('#view').querySelectorAll('[data-flip]')].find(e => e.dataset.flip === k)?.classList.add('popped'); }
  lastView = ui.view;
  renderNav();
  renderSheet();
  app.after.forEach(f => f());
}
// The bottom sheet, drawn after the screen. A sheet whose builder returns nothing closes itself.
function renderSheet() {
  const box = $('#sheet'); if (!box) return;
  const b = ui.sheet && app.sheets[ui.sheet.kind];
  let html = '';
  try { html = b ? b(ui.sheet) : ''; } catch (e) { logProblem('sheet', e, ui.sheet && ui.sheet.kind); }
  if (!html) { ui.sheet = null; box.innerHTML = ''; document.body.classList.remove('sheet-open'); return; }
  box.innerHTML = `<div class="scrim" data-act="sheetClose"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  document.body.classList.add('sheet-open');
}
export const commit = () => { save(); render(); if (app.afterCommit) app.afterCommit(); };
export const go = (view, sub) => { ui.sheet = null; ui.view = view === 'plan' ? 'tasks' : view; if (sub) Object.assign(ui.sub, sub); render(); window.scrollTo(0, 0); };
export const byId = (arr, id) => arr.find(x => x.id === id);
export const remove = (key, id) => { S[key] = S[key].filter(x => x.id !== id); };
