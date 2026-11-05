// Shared HTML snippets.
import { ui, S, commit } from './core.js';
import { esc } from './util.js';
import { LABEL } from './links.js';
import { icon } from './icons.js';

// Screen header: big title, optional subtitle, optional control on the right.
// Three quiet dots at the top right open Settings from every screen, so Settings needs no space of its own.
export const me = () => `${ui.view === 'search' ? '' : `<button class="srch" data-nav="search" aria-label="Search everything">${icon('search', 21)}</button>`}<button class="me" data-nav="settings" aria-label="Settings and more">${icon('more', 21)}</button>`;
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
// Small buttons on the side of an event or task: Join a class, Open a document, see the Mail it came from.
const LINK_ICON = { meet: 'video', doc: 'file', form: 'form', mail: 'mail', link: 'link' };
export const linkBtns = links => (links && links.length ? `<span class="lks">${links.map(l => `<a class="lk lk-${l.kind}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${icon(LINK_ICON[l.kind] || 'link', 15)}${LABEL[l.kind]}</a>`).join('')}</span>` : '');
// A short message above the bottom bar, with an optional Undo. It is plain DOM, so it survives the screen being redrawn.
let toastTimer;
export function toast(text, undo) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button class="ghost" type="button">Undo</button>' : ''}`;
  const b = el.querySelector('button');
  if (b) b.onclick = () => { undo(); el.classList.remove('on'); commit(); };
  el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 6000);
}
