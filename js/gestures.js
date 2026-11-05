// Touch gestures: swipe a row right to finish it, left to reveal Snooze and Delete; press and hold anything with data-menu
// for its menu (a sheet of actions). Rows opt in with markup only:
//   <li class="sw" data-swipe-done="taskDone" data-id="..."><div class="sw-under">...</div><div class="sw-row">...</div></li>
//   <li data-menu="task:<id>">...</li>     menus come from app.menus.task(id) -> [{ label, icon, act, data, danger }]
import { app, ui, commit, render } from './core.js';

let sx = 0, sy = 0, row = null, li = null, dx = 0, moved = false, swallow = false, holdTimer = 0;
const closeOpen = except => document.querySelectorAll('li.sw.open').forEach(x => { if (x !== except) x.classList.remove('open'); });

document.addEventListener('pointerdown', e => {
  if (e.button !== undefined && e.button !== 0) return;
  sx = e.clientX; sy = e.clientY; dx = 0; moved = false; swallow = false;   // a gesture only ever eats the click that ends it
  row = e.target.closest('.sw-row'); li = row ? row.closest('li.sw') : null;
  if (!e.target.closest('li.sw.open')) closeOpen();
  const m = e.target.closest('[data-menu]');
  clearTimeout(holdTimer);
  if (m && !e.target.closest('input, textarea, select, a')) holdTimer = setTimeout(() => {
    if (moved) return;
    swallow = true;
    ui.sheet = { kind: 'menu', menu: m.dataset.menu };
    if (navigator.vibrate) navigator.vibrate(12);
    render();
  }, 480);
}, { passive: true });

document.addEventListener('pointermove', e => {
  const mx = e.clientX - sx, my = e.clientY - sy;
  if (Math.abs(mx) > 8 || Math.abs(my) > 8) { moved = true; clearTimeout(holdTimer); }
  if (!row || !li) return;
  if (!li.classList.contains('swiping') && (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(my) * 1.3)) return;
  li.classList.add('swiping');
  dx = Math.max(-160, Math.min(150, mx + (li.classList.contains('open') ? -136 : 0)));
  row.style.transform = `translateX(${dx}px)`;
  li.querySelector('.sw-done')?.style.setProperty('opacity', dx > 0 ? Math.min(1, dx / 90) : 0);
}, { passive: true });

const end = () => {
  clearTimeout(holdTimer);
  if (!row || !li || !li.classList.contains('swiping')) { row = li = null; return; }
  swallow = true;
  const theLi = li, theRow = row;
  theLi.classList.remove('swiping'); theRow.style.transform = '';
  if (dx > 90 && theLi.dataset.swipeDone && app.actions[theLi.dataset.swipeDone]) {
    if (navigator.vibrate) navigator.vibrate(10);
    app.actions[theLi.dataset.swipeDone]({ id: theLi.dataset.id }, theLi);
    commit();
  } else if (dx < -60) { closeOpen(theLi); theLi.classList.add('open'); }
  else theLi.classList.remove('open');
  row = li = null;
};
document.addEventListener('pointerup', end);
document.addEventListener('pointercancel', end);
// A swipe or a long press should not also count as a tap on what is under the finger.
document.addEventListener('click', e => { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-menu]')) e.preventDefault(); });

// The menu sheet built from app.menus.
app.sheets.menu = s => {
  const [kind, id] = String(s.menu || '').split(':');
  const items = (app.menus[kind] && app.menus[kind](id)) || [];
  if (!items.length) return '';
  const head = items.title ? `<h2>${items.title}</h2>` : '';
  return `${head}<div class="menu">${items.map(it => `<button data-act="${it.act}" data-close="1" ${Object.entries(it.data || {}).map(([k, v]) => `data-${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ')} class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${it.label}</span></button>`).join('')}</div>`;
};
