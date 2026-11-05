// The five-minute weekly review (offered on Home on Sunday and Monday): what the week held, what to do with what is still open,
// and next week's top three, which then sit at the top of Home all week.
import { S, ui, register, go } from '../core.js';
import { today, addDays, esc, fmtDay, lastDays } from '../util.js';
import { head, empty, toast } from '../ui.js';
import { icon } from '../icons.js';
import { openTasks, byRank } from '../logic.js';
import { mondayOf, attendKey } from '../study.js';
import { agendaOn } from '../agenda.js';
import { isClass } from '../colors.js';

// The week being reviewed: on Monday, the one that just ended; otherwise the current one.
export const reviewWeek = () => mondayOf(new Date().getDay() === 1 ? addDays(today(), -1) : today());
export const nextMonday = () => addDays(reviewWeek(), 7);
export const reviewDue = () => { const d = new Date().getDay(); return (d === 0 || d === 1) && !(S.reviews[reviewWeek()] || {}).at; };
export const weekTop = () => ((S.reviews[mondayOf(today())] || {}).top || []).map(id => S.tasks.find(t => t.id === id)).filter(Boolean);

function render() {
  const wk = reviewWeek(), days = Array.from({ length: 7 }, (_, i) => addDays(wk, i)).filter(k => k <= today());
  const done = days.reduce((a, k) => a + (S.stats.tasksDone[k] || 0), 0);
  const habits = days.reduce((a, k) => a + Object.values(S.habitLog[k] || {}).filter(Boolean).length, 0);
  let classes = 0, attended = 0;
  days.forEach(k => agendaOn(k).filter(e => isClass(e) && e.start < Date.now()).forEach(e => { classes++; if (S.attend[attendKey(e)] === 'y') attended++; }));
  const notes = S.pages.filter(p => !p.trashed && p.at >= new Date(wk + 'T00:00:00').getTime()).length;
  const nextMon = nextMonday(), carry = openTasks().filter(t => !t.derived && t.due && t.due < nextMon).sort(byRank);
  const top = ((S.reviews[nextMon] || {}).top || []);
  const pickable = openTasks().filter(t => !t.derived).sort(byRank).slice(0, 15);
  const stat = (n, l) => `<div><b>${n}</b><span>${l}</span></div>`;
  return `${head('Weekly review', `Week of ${fmtDay(wk)}`, '<button class="pill" data-act="reviewDone">Finish</button>')}
  <section class="card"><h2>${icon('spark', 15)} This week</h2><div class="recap-grid">${stat(done, 'tasks done')}${stat(habits, 'habit check-ins')}${stat(classes ? `${attended}/${classes}` : '0', 'classes attended')}${stat(notes, 'notes added')}</div></section>
  <section class="card"><h2>Still open (${carry.length})</h2>${carry.length ? `<ul class="list">${carry.map(t => `<li><div class="grow"><span class="title">${esc(t.title)}</span><div class="muted">${t.due < today() ? 'was due ' : 'due '}${esc(fmtDay(t.due))}</div></div><span class="row" style="gap:4px;flex:none"><button class="pill" data-act="revMove" data-id="${esc(t.id)}">Next week</button><button class="ghost danger" data-act="revDrop" data-id="${esc(t.id)}">Drop</button></span></li>`).join('')}</ul><div class="row" style="margin-top:8px"><button data-act="revMoveAll">Move all to Monday</button></div>` : empty('Nothing left over. Clean week.')}</section>
  <section class="card"><h2>Next week's top three ${top.length ? `(${top.length}/3)` : ''}</h2><p class="muted">The three that would make next week a good one. They sit at the top of Home all week.</p>
    ${pickable.length ? `<ul class="list">${pickable.map(t => `<li><button class="pick ${top.includes(t.id) ? 'on' : ''}" data-act="revTop" data-id="${esc(t.id)}" aria-pressed="${top.includes(t.id)}">${top.includes(t.id) ? icon('check', 16) : ''}</button><span class="grow title">${esc(t.title)}</span></li>`).join('')}</ul>` : empty('No open tasks to pick from.')}</section>
  <div class="row"><button class="primary" data-act="reviewDone">Finish the review</button></div>`;
}

register({
  id: 'review', label: 'Weekly review', render,
  actions: {
    revMove: d => { const t = S.tasks.find(x => x.id === d.id); if (t) t.due = nextMonday(); },
    revMoveAll: () => { const nm = nextMonday(); openTasks().filter(t => !t.derived && t.due && t.due < nm).forEach(t => { t.due = nm; }); toast('Moved to Monday'); },
    revDrop: d => { const i = S.tasks.findIndex(x => x.id === d.id); if (i < 0) return; const [t] = S.tasks.splice(i, 1); toast(`Dropped "${t.title.slice(0, 40)}"`, () => { S.tasks.splice(i, 0, t); }); },
    revTop: d => { const r = (S.reviews[nextMonday()] ||= {}); r.top = r.top || []; if (r.top.includes(d.id)) r.top = r.top.filter(x => x !== d.id); else if (r.top.length < 3) r.top.push(d.id); else toast('Three is the limit. Untick one first.'); },
    reviewDone: () => { (S.reviews[reviewWeek()] ||= {}).at = Date.now(); go('home'); toast('Review done. Have a good week.'); },
  },
});
