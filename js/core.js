// App shell: shared state, the view/section registry and render loop.
// Feature modules call register() with { id, label, render, actions, forms, inputs }.
// Extension points other modules can push into: app.nudgeSources, app.taskSources, app.todayCards.
import { get, save } from './store.js';

export const S = get();
export const ui = { view: 'today', sub: {} };
export const app = {
  brief: { events: [], inbox: [] },
  news: { date: '', items: [] },   // public daily news, refreshed by the brief routine (data/news.json)
  views: {},        // top-level screens shown in the bottom nav
  sections: {},     // sub-screens inside "More"
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

export function render() {
  const v = app.views[ui.view] || app.views.today;
  $('#view').innerHTML = v.render();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === ui.view));
  document.body.classList.toggle('deep', S.timer.running && S.timer.mode === 'focus');
}
export const commit = () => { save(); render(); };
export const go = (view, sub) => { ui.view = view; if (sub) Object.assign(ui.sub, sub); render(); window.scrollTo(0, 0); };
export const byId = (arr, id) => arr.find(x => x.id === id);
export const remove = (key, id) => { S[key] = S[key].filter(x => x.id !== id); };
