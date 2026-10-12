// Placement and career tracking. Optional module: switch it off in Settings once you are placed.
import { S, ui, app, register, byId, remove } from '../core.js';
import { today, daysFromToday, esc, uid, until } from '../util.js';
import { field, empty, chip, tabs, subOf } from '../ui.js';
import { STAR_TRAITS, KANBAN_COLUMNS, APPLY_STEPS } from '../data.js';

const TABS = [['board', 'Applications'], ['people', 'Network'], ['star', 'STAR stories']];
const on = () => S.modules.career;
const missing = a => APPLY_STEPS.filter(([k]) => !(a.steps || {})[k]).map(([, l]) => l);
const cvName = a => `${S.profile.roll || 'Roll Number'}_${S.profile.name || 'Full Name'}_${a.company}`;
const contactDue = c => c.last ? -daysFromToday(c.last) >= c.cadence : true;

// ---- hooks into Today and Plan ----
app.nudgeSources.push(() => {
  if (!on()) return [];
  const out = [];
  S.apps.filter(a => a.stage === 'To apply' && a.deadline && new Date(a.deadline) > new Date() && new Date(a.deadline) - Date.now() < 48 * 36e5)
    .forEach(a => out.push(`${esc(a.company)}: ${esc(missing(a).join(', ') || 'submit')} left, closes in ${until(a.deadline)}`));
  S.contacts.filter(contactDue).forEach(c => out.push(`Follow up with ${esc(c.name)}${c.org ? ' (' + esc(c.org) + ')' : ''}`));
  return out;
});
app.taskSources.push(() => !on() ? [] : S.apps.filter(a => a.stage === 'To apply' && a.deadline).map(a => ({
  id: 'app-' + a.id, derived: true, view: 'more', section: 'career', important: true, due: a.deadline.slice(0, 10), kind: 'Apply', at: a.deadline,
  title: `Apply: ${a.company}`, left: missing(a).join(', ') || 'all steps ticked',
})));
app.todayCards.push(() => {
  if (!on()) return '';
  const soon = iso => { const h = (new Date(iso) - Date.now()) / 36e5; return h > -2 && h <= 24; };
  const stars = `<p class="muted">${S.stars.length} STAR stories ready.</p>`;
  return S.apps.filter(a => a.talk && soon(a.talk)).map(a => `<div class="card alert"><h2>Prep: ${esc(a.company)} ${chip('in ' + until(a.talk), 'warn')}</h2>
    <p class="muted">${esc(a.role || 'Talk or interview')}</p>${a.about ? `<p>${esc(a.about)}</p>` : ''}
    ${a.questions ? `<h3>Questions to ask</h3><p style="white-space:pre-wrap">${esc(a.questions)}</p>` : empty('No questions drafted yet.')}
    ${a.stage === 'To apply' ? chip('Still to do: ' + esc(missing(a).join(', ') || 'submit'), 'warn') : ''}${stars}</div>`).join('');
});

function board() {
  const card = (x, ci) => `<div class="card"><div class="row between"><span class="title">${esc(x.company)}</span>${x.stage === 'To apply' && x.deadline ? chip('closes in ' + until(x.deadline), new Date(x.deadline) - Date.now() < 864e5 ? 'bad' : 'warn') : ''}</div>
    <div class="muted">${esc(x.role)}</div>
    ${x.stage === 'To apply' ? `<ul class="list">${APPLY_STEPS.map(([k, l]) => `<li style="padding:5px 0"><label class="check"><input type="checkbox" data-act="step" data-id="${x.id}" data-step="${k}" ${(x.steps || {})[k] ? 'checked' : ''}> ${l}</label></li>`).join('')}</ul>
      <input data-bind="app" data-id="${x.id}" data-field="applicantId" aria-label="Applicant ID" placeholder="Applicant ID from company portal" value="${esc(x.applicantId)}">
      <div class="row" style="margin-top:6px"><code class="grow muted" style="overflow-wrap:anywhere">${esc(cvName(x))}</code><button data-act="copy" data-text="${esc(cvName(x))}">Copy name</button></div>` : ''}
    <details><summary>Prep and notes</summary>
      <label>Talk or interview<input type="datetime-local" data-bind="app" data-id="${x.id}" data-field="talk" value="${esc(x.talk)}"></label>
      <label>What they do, roles on offer<textarea data-bind="app" data-id="${x.id}" data-field="about">${esc(x.about)}</textarea></label>
      <label>Questions to ask (one per line)<textarea data-bind="app" data-id="${x.id}" data-field="questions">${esc(x.questions)}</textarea></label>
      <label>Notes<textarea data-bind="app" data-id="${x.id}" data-field="notes">${esc(x.notes)}</textarea></label></details>
    <div class="row">${ci > 0 ? `<button data-act="moveApp" data-id="${x.id}" data-dir="-1" aria-label="Move back">←</button>` : ''}${ci < KANBAN_COLUMNS.length - 1 ? `<button data-act="moveApp" data-id="${x.id}" data-dir="1" aria-label="Move forward">→</button>` : ''}<button class="ghost danger" data-act="delApp" data-id="${x.id}">Delete</button></div></div>`;
  return `${S.profile.roll && S.profile.name ? '' : '<p class="muted">Set your roll number and full name in Settings so CV file names fill in.</p>'}
  <div class="kanban">${KANBAN_COLUMNS.map((col, ci) => `<div class="col"><h3>${col} ${chip(S.apps.filter(x => x.stage === col).length)}</h3>${S.apps.filter(x => x.stage === col).sort((p, q) => (p.deadline || '9').localeCompare(q.deadline || '9')).map(x => card(x, ci)).join('')}</div>`).join('')}</div>
  <div class="card"><h2>Add application</h2><form data-form="app" class="inline">${field('Company', 'company', 'required')}${field('Role', 'role')}${field('Apply by', 'deadline', 'type="datetime-local"')}<button class="primary">Add</button></form>
    <p class="muted">Tick the four steps and the card moves to Applied. Anything in To apply with a deadline appears in Plan and on Today.</p></div>`;
}
function people() {
  const sorted = [...S.contacts].sort((a, b) => (contactDue(b) - contactDue(a)) || (a.last || '').localeCompare(b.last || ''));
  return `<div class="card"><h2>Network</h2>${sorted.length ? `<ul class="list">${sorted.map(c => { const ago = c.last ? -daysFromToday(c.last) : null; return `<li><div class="grow"><span class="title">${esc(c.name)}</span> ${chip(esc(c.kind), 'plain')} ${contactDue(c) ? chip('Follow up', 'warn') : ''}<div class="muted">${esc(c.org)} · ${ago === null ? 'never contacted' : ago + ' days ago'} · every ${c.cadence}d</div>${c.note ? `<div class="muted">${esc(c.note)}</div>` : ''}</div><button data-act="contacted" data-id="${c.id}">Done today</button><button class="ghost danger" data-act="delContact" data-id="${c.id}" aria-label="Delete">×</button></li>`; }).join('')}</ul>` : empty('Add alumni, faculty, mentors and recruiters. People outlast any job search.')}
    <form data-form="contact" class="inline">${field('Name', 'name', 'required')}${field('Organisation', 'org')}<label>Type<select name="kind"><option>Alumni</option><option>Faculty</option><option>Recruiter</option><option>Mentor</option><option>Other</option></select></label><label>Nudge every<select name="cadence"><option value="30">30 days</option><option value="45">45 days</option><option value="60">60 days</option></select></label>${field('Note', 'note')}<button class="primary">Add</button></form></div>`;
}
function stories() {
  const f = ui.sub.starFilter || 'All';
  const list = S.stars.filter(s => f === 'All' || s.trait === f);
  return `<div class="card"><h2>STAR story bank</h2><div class="tabs">${['All', ...STAR_TRAITS].map(t => `<button class="${f === t ? 'on' : ''}" data-act="starFilter" data-id="${t}">${t}</button>`).join('')}</div>
    ${list.length ? list.map(s => `<details class="card"><summary>${esc(s.title)} ${chip(esc(s.trait), 'plain')}</summary>${[['Situation', s.s], ['Task', s.t], ['Action', s.a], ['Result', s.r]].map(([k, v]) => `<p><b>${k}:</b> ${esc(v)}</p>`).join('')}<button class="ghost danger" data-act="delStar" data-id="${s.id}">Delete</button></details>`).join('') : empty('No stories yet.')}
    <details><summary>Add story</summary><form data-form="star">${field('Title', 'title', 'required')}<label>Trait<select name="trait">${STAR_TRAITS.map(t => `<option>${t}</option>`).join('')}</select></label><label>Situation<textarea name="s" required></textarea></label><label>Task<textarea name="t" required></textarea></label><label>Action<textarea name="a" required></textarea></label><label>Result (use numbers)<textarea name="r" required></textarea></label><button class="primary">Save story</button></form></details></div>`;
}

function view() {
  const sub = subOf('career', TABS);
  return `${tabs('career', TABS)}${{ board, people, star: stories }[sub]()}`;
}

register({
  id: 'career', label: 'Career', section: true, order: 3, enabled: on, render: view,
  actions: {
    starFilter: d => { ui.sub.starFilter = d.id; },
    step: d => {
      const x = byId(S.apps, d.id); x.steps = x.steps || {}; x.steps[d.step] = !x.steps[d.step];
      if (x.stage === 'To apply' && APPLY_STEPS.every(([k]) => x.steps[k])) x.stage = 'Applied';
    },
    copy: d => { try { navigator.clipboard.writeText(d.text).catch(() => {}); } catch { /* clipboard unavailable */ } },
    moveApp: d => { const a = byId(S.apps, d.id); a.stage = KANBAN_COLUMNS[KANBAN_COLUMNS.indexOf(a.stage) + Number(d.dir)]; },
    delApp: d => remove('apps', d.id),
    contacted: d => { byId(S.contacts, d.id).last = today(); },
    delContact: d => remove('contacts', d.id),
    delStar: d => remove('stars', d.id),
  },
  forms: {
    app: f => S.apps.push({ id: uid(), company: f.company, role: f.role, deadline: f.deadline, stage: KANBAN_COLUMNS[0], steps: {} }),
    contact: f => S.contacts.push({ id: uid(), name: f.name, org: f.org, kind: f.kind, cadence: Number(f.cadence), note: f.note, last: '' }),
    star: f => S.stars.push({ id: uid(), title: f.title, trait: f.trait, s: f.s, t: f.t, a: f.a, r: f.r }),
  },
  inputs: { app: el => { const x = byId(S.apps, el.dataset.id); if (x) x[el.dataset.field] = el.value; } },
});
