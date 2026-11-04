// Shared HTML snippets.
import { ui, S } from './core.js';
import { esc } from './util.js';

// Screen header: big title, optional subtitle, optional control on the right.
// Three quiet dots at the top right open Settings from every screen, so Settings needs no space of its own.
export const me = () => `<button class="me" data-nav="settings" aria-label="Settings and more"><i></i><i></i><i></i></button>`;
export const head = (title, subtitle = '', right = '') => `<header class="top"><div><h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ''}</div><div class="top-r">${right}${ui.view === 'settings' ? '' : me()}</div></header>`;
export const field = (label, name, attrs = '') => `<label>${label}<input name="${name}" ${attrs}></label>`;
export const empty = msg => `<p class="muted">${msg}</p>`;
export const chip = (text, cls = '') => `<span class="chip ${cls}">${text}</span>`;
export const bar = (pct, over = false) => `<div class="bar ${over ? 'over' : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
export const subOf = (group, items) => (items.some(i => i[0] === ui.sub[group]) ? ui.sub[group] : items[0][0]);
export const tabs = (group, items) => {
  const cur = subOf(group, items);
  return `<div class="tabs" role="tablist">${items.map(([id, label]) => `<button role="tab" aria-selected="${cur === id}" class="${cur === id ? 'on' : ''}" data-act="sub" data-group="${group}" data-id="${id}">${label}</button>`).join('')}</div>`;
};
// A second row of pills inside a screen or tab (state lives in ui.sub[group]).
export const pills = (group, items) => { const cur = subOf(group, items); return `<div class="seg pills" role="tablist">${items.map(([id, l]) => `<button role="tab" aria-selected="${cur === id}" class="${cur === id ? 'on' : ''}" data-act="sub" data-group="${group}" data-id="${id}">${l}</button>`).join('')}</div>`; };
export const check = (act, id, on, extra = '') => `<input type="checkbox" class="tick" data-act="${act}" data-id="${esc(id)}" ${extra} ${on ? 'checked' : ''}>`;
