// Search: one box over everything in the app: tasks (open and done), notes, habits, events from 30 days ago to 90 days ahead,
// today's news and saved stories, and the casebook. Not a tab; opened from the Search button at the top of every screen.
// Results redraw as you type without redrawing the page, so the keyboard stays up.
import { S, ui, app, register, go } from '../core.js';
import { today, addDays, esc, fmtDay } from '../util.js';
import { head, chip, empty } from '../ui.js';
import { agendaOn } from '../agenda.js';
import { pageText, pageTitle, bookName } from '../notes.js';
import { CASES, PRACTICE, TOOLKIT } from '../casebook.js';

const sr = ui.sr = { q: '' };
const hit = (text, q) => String(text || '').toLowerCase().includes(q);
const snip = (text, q) => { const t = String(text || '').replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(q); if (i < 0) return t.slice(0, 90); const a = Math.max(0, i - 30); return (a ? '…' : '') + t.slice(a, a + 100) + (a + 100 < t.length ? '…' : ''); };
const item = (title, sub, attrs, tag) => `<li><button class="sr-item" ${attrs}><span class="title">${esc(title)}</span>${sub ? `<span class="muted">${esc(sub)}</span>` : ''}</button>${tag ? chip(esc(tag), 'plain') : ''}</li>`;

export function results(qRaw) {
  const q = qRaw.trim().toLowerCase();
  if (q.length < 2) return `<p class="muted">Type at least two letters. Searches tasks, notes, habits, your calendar, news and the casebook.</p>`;
  const groups = [];
  const tasks = S.tasks.filter(t => hit(t.title, q) || hit(t.note, q) || (t.subs || []).some(s => hit(s.x, q)));
  if (tasks.length) groups.push(['Tasks', tasks.slice(0, 12).map(t => item(t.title, [t.done ? 'done' : t.due ? 'due ' + fmtDay(t.due) : 'no date', t.note ? snip(t.note, q) : ''].filter(Boolean).join(' · '), `data-act="srTask" data-id="${esc(t.id)}"`, t.done ? 'Done' : ''))]);
  const pages = S.pages.filter(p => !p.trashed && hit(pageText(p), q));
  if (pages.length) groups.push(['Notes', pages.slice(0, 12).map(p => item(pageTitle(p), snip(pageText(p), q), `data-act="srPage" data-id="${esc(p.id)}"`, bookName(p.bookId)))]);
  const habits = S.habits.filter(h => !h.archived && hit(h.name, q));
  if (habits.length) groups.push(['Habits', habits.map(h => item(h.name, '', 'data-nav="routine"', ''))]);
  const evs = [];
  for (let i = -30; i <= 90 && evs.length < 15; i++) {
    const k = addDays(today(), i);
    agendaOn(k).filter(e => e.kind !== 'task' && (hit(e.title, q) || hit(e.where, q) || hit(e.desc, q))).forEach(e => evs.push([k, e]));
  }
  if (evs.length) groups.push(['Calendar', evs.slice(0, 15).map(([k, e]) => item(e.title, `${fmtDay(k)}${e.allDay ? '' : ' · ' + new Date(e.start).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}${e.where ? ' · ' + e.where : ''}`, `data-go="calendar:day:${k}"`, k < today() ? 'Past' : ''))]);
  const news = [...(app.news.items || []), ...S.saved.filter(x => !(app.news.items || []).some(n => n.title === x.title))].filter(n => hit(n.title, q) || hit(n.summary, q));
  if (news.length) groups.push(['News', news.slice(0, 10).map(n => /^https?:/.test(n.url || '') ? `<li><a class="sr-item" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><span class="title">${esc(n.title)}</span><span class="muted">${esc(n.src || '')}</span></a>${chip(esc(n.cat), 'plain')}</li>` : item(n.title, n.src, 'data-go="learn:news"', n.cat))]);
  const lib = [...CASES.map(c => [c.title, c.theme, c.title + ' ' + c.situation + ' ' + c.lesson]), ...TOOLKIT.map(f => [f.name, f.area, f.name + ' ' + f.summary]), ...PRACTICE.map(p => [p.q, 'Practice', p.q])].filter(x => hit(x[2], q));
  if (lib.length) groups.push(['Casebook', lib.slice(0, 10).map(([t, tag]) => item(t, '', 'data-go="learn:cases"', tag))]);
  if (!groups.length) return empty(`Nothing matches "${esc(qRaw.trim())}".`);
  return groups.map(([name, rows]) => `<section class="card"><h3 class="group-h" style="margin-top:0">${name} ${chip(String(rows.length), 'plain')}</h3><ul class="list sr-list">${rows.join('')}</ul></section>`).join('');
}

function render() {
  return `${head('Search', 'Everything in one place', '<button class="pill" data-act="srBack">Done</button>')}
  <input class="search big" type="search" data-bind="srq" value="${esc(sr.q)}" placeholder="Search tasks, notes, calendar, news" aria-label="Search everything" autofocus>
  <div id="sres">${results(sr.q)}</div>`;
}

register({
  id: 'search', label: 'Search', render,
  actions: {
    srBack: () => { go('home'); },
    srTask: d => { const t = S.tasks.find(x => x.id === d.id); if (!t) return; ui.view = 'tasks'; if (ui.te) { ui.te.id = t.done ? null : t.id; ui.te.filter = 'all'; } },
    srPage: d => { ui.view = 'notes'; if (ui.nb) { ui.nb.page = d.id; ui.nb.more = false; } },
  },
  inputs: { srq: el => { sr.q = el.value; const box = document.getElementById('sres'); if (box) box.innerHTML = results(sr.q); } },
});
app.after.push(() => { if (ui.view === 'search') { const el = document.querySelector('[data-bind=srq]'); if (el && document.activeElement !== el && !sr.q) el.focus(); } });
