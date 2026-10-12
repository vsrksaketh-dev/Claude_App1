// App shell: shared state, the view/section registry and render loop.
// Feature modules call register() with { id, label, nav, enabled, render, actions, forms, inputs }.
// A view with a numeric `nav` appears in the bottom bar; one without (Settings) is opened from a link.
// Extension points other modules can push into: app.nudgeSources, app.taskSources, app.todayCards.
import { get, save } from './store.js';

export const S = get();
export const ui = { view: 'home', sub: {} };
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
  todayCards: [],   // () => html string         extra cards on Today
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
}
// The bottom bar is built from the registry: views with a `nav` order, hidden when their module is off.
function renderNav() {
  const items = Object.values(app.views).filter(v => v.nav && (!v.enabled || v.enabled())).sort((a, b) => a.nav - b.nav);
  $('#nav').innerHTML = items.map(v => `<button data-nav="${v.id}" class="${v.id === ui.view ? 'on' : ''}">${v.label}</button>`).join('');
}
export function render() {
  applyTheme();
  let v = app.views[ui.view];
  if (!v || (v.enabled && !v.enabled())) { ui.view = 'home'; v = app.views.home; }
  $('#view').innerHTML = v.render();
  renderNav();
  document.body.classList.toggle('deep', S.timer.running && S.timer.mode === 'focus');
}
export const commit = () => { save(); render(); };
export const go = (view, sub) => { ui.view = view; if (sub) Object.assign(ui.sub, sub); render(); window.scrollTo(0, 0); };
export const byId = (arr, id) => arr.find(x => x.id === id);
export const remove = (key, id) => { S[key] = S[key].filter(x => x.id !== id); };
