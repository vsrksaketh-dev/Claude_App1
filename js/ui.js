// Shared HTML snippets.
import { ui } from './core.js';
import { esc } from './util.js';

// Screen header: big title, optional subtitle, optional control on the right.
export const head = (title, subtitle = '', right = '') => `<header class="top"><div><h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ''}</div>${right}</header>`;
export const field = (label, name, attrs = '') => `<label>${label}<input name="${name}" ${attrs}></label>`;
export const empty = msg => `<p class="muted">${msg}</p>`;
export const chip = (text, cls = '') => `<span class="chip ${cls}">${text}</span>`;
export const bar = (pct, over = false) => `<div class="bar ${over ? 'over' : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
export const subOf = (group, items) => (items.some(i => i[0] === ui.sub[group]) ? ui.sub[group] : items[0][0]);
export const tabs = (group, items) => {
  const cur = subOf(group, items);
  return `<div class="tabs" role="tablist">${items.map(([id, label]) => `<button role="tab" aria-selected="${cur === id}" class="${cur === id ? 'on' : ''}" data-act="sub" data-group="${group}" data-id="${id}">${label}</button>`).join('')}</div>`;
};
export const check = (act, id, on, extra = '') => `<input type="checkbox" class="tick" data-act="${act}" data-id="${esc(id)}" ${extra} ${on ? 'checked' : ''}>`;

// Bar chart. points: [{ label, value, title }]; max defaults to the largest value.
export const barChart = (points, { max, unit = '', summary = '' } = {}) => {
  const top = max ?? Math.max(1, ...points.map(p => p.value));
  return `<div class="bars" role="img" aria-label="${esc(summary)}">${points.map(p => `<i title="${esc(p.title ?? `${p.label}: ${Math.round(p.value)}${unit}`)}" style="height:${Math.max(3, p.value / top * 100)}%" class="${p.value ? '' : 'zero'}"></i>`).join('')}</div>
    <div class="bars-axis"><span>${esc(points[0]?.label ?? '')}</span><span>${esc(points[points.length - 1]?.label ?? '')}</span></div>`;
};
// Heatmap. cells: [{ date, level 0-4 }] oldest first, laid out in week columns starting on Monday.
export const heatmap = (cells, startPad = 0) => `<div class="heat" role="img" aria-label="Daily completion heatmap">${'<i class="h-1"></i>'.repeat(startPad)}${cells.map(c => `<i class="h${c.level}" title="${esc(c.date)}"></i>`).join('')}</div>`;
