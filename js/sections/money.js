import { S, app, register, remove } from '../core.js';
import { today, inr, esc, uid } from '../util.js';
import { field, empty, chip, bar } from '../ui.js';
import { EXPENSE_CATS } from '../data.js';

const nextBilling = day => {
  const t = new Date(today() + 'T00:00:00');
  const clamp = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let d = clamp(t.getFullYear(), t.getMonth());
  if (d < t) d = clamp(t.getFullYear(), t.getMonth() + 1);
  return d;
};
const daysToBilling = day => Math.round((nextBilling(day) - new Date(today() + 'T00:00:00')) / 864e5);
const on = () => S.modules.money;

app.nudgeSources.push(() => !on() ? [] : S.subs.filter(s => daysToBilling(s.day) <= 3).map(s => {
  const d = daysToBilling(s.day);
  return `${esc(s.name)} renews ${d === 0 ? 'today' : `in ${d} day${d > 1 ? 's' : ''}`} (${inr(s.amount)})`;
}));

function view() {
  const total = S.subs.reduce((a, s) => a + s.amount, 0);
  const sorted = [...S.subs].sort((a, b) => daysToBilling(a.day) - daysToBilling(b.day));
  const ym = today().slice(0, 7), month = S.expenses.filter(e => e.date.startsWith(ym)), spent = month.reduce((a, e) => a + e.amount, 0);
  const pct = S.budget ? spent / S.budget * 100 : 0;
  const byCat = EXPENSE_CATS.map(c => [c, month.filter(e => e.cat === c).reduce((a, e) => a + e.amount, 0)]).filter(x => x[1]);
  return `
  <div class="card"><h2>This month</h2><p><span class="big">${inr(spent)}</span> ${S.budget ? `of ${inr(S.budget)} · ${S.budget - spent >= 0 ? inr(S.budget - spent) + ' left' : chip(inr(spent - S.budget) + ' over', 'bad')}` : ''}</p>
    ${S.budget ? bar(pct, pct > 100) : ''}${byCat.length ? `<p class="muted">${byCat.map(([c, v]) => `${c} ${inr(v)}`).join(' · ')}</p>` : ''}
    <form data-form="budget" class="inline">${field('Monthly budget (₹)', 'budget', `type="number" min="0" value="${S.budget || ''}"`)}<button>Set</button></form></div>
  <div class="card"><h2>Quick add</h2><form data-form="expense" class="inline">${field('Amount (₹)', 'amount', 'type="number" min="0" step="any" required')}<label>Category<select name="cat">${EXPENSE_CATS.map(c => `<option>${c}</option>`).join('')}</select></label>${field('Note', 'note')}${field('Date', 'date', `type="date" value="${today()}" required`)}<button class="primary">Log</button></form></div>
  <div class="card"><h2>Recent</h2>${S.expenses.length ? `<ul class="list">${[...S.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(e => `<li><div class="grow"><span class="title">${inr(e.amount)}</span> ${chip(esc(e.cat), 'plain')}<div class="muted">${esc(e.date)} ${esc(e.note)}</div></div><button class="ghost danger" data-act="delExpense" data-id="${e.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : empty('Nothing logged yet.')}</div>
  <div class="card"><h2>Subscriptions ${chip(inr(total) + '/month')}</h2>${sorted.length ? `<ul class="list">${sorted.map(s => { const d = daysToBilling(s.day); return `<li><div class="grow"><span class="title">${esc(s.name)}</span><div class="muted">${inr(s.amount)} · renews on the ${s.day}th</div></div>${chip(d === 0 ? 'today' : d + 'd', d <= 3 ? 'warn' : '')}<button class="ghost danger" data-act="delSub" data-id="${s.id}" aria-label="Delete">×</button></li>`; }).join('')}</ul>` : empty('Add Canva, AI tools, Netflix...')}
    <form data-form="sub" class="inline">${field('Name', 'name', 'required')}${field('Amount (₹)', 'amount', 'type="number" min="0" step="any" required')}${field('Billing day (1-31)', 'day', 'type="number" min="1" max="31" required')}<button class="primary">Add</button></form></div>`;
}
register({
  id: 'money', label: 'Money', section: true, order: 2, enabled: on, render: view,
  actions: { delSub: d => remove('subs', d.id), delExpense: d => remove('expenses', d.id) },
  forms: {
    sub: f => S.subs.push({ id: uid(), name: f.name, amount: Number(f.amount), day: Number(f.day) }),
    expense: f => S.expenses.push({ id: uid(), amount: Number(f.amount), cat: f.cat, note: f.note, date: f.date }),
    budget: f => { S.budget = Number(f.budget) || 0; },
  },
});
