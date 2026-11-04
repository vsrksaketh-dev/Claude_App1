// Learn: the daily news, and a casebook for thinking like a consultant (aimed at HR transformation work).
import { S, ui, app, register } from '../core.js';
import { today, esc, pick, fmtDay } from '../util.js';
import { empty, chip, tabs, pills, subOf, head } from '../ui.js';
import { FRAMEWORKS, MENTAL_MODELS } from '../data.js';
import { PLAYBOOK, MINDSET, TOOLKIT, CASES, PRACTICE, HR_TECH } from '../casebook.js';

const TABS = [['news', 'News'], ['cases', 'Cases']];
const CATS = [['All', 'All'], ['International', 'World'], ['Indian', 'India'], ['Business', 'Business'], ['Tech', 'Tech']];

// ---- news ----
const story = (n, lead) => {
  const link = /^https?:\/\//.test(n.url || '');
  const open = link ? `<a class="story${lead ? ' lead' : ''}" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">` : `<div class="story${lead ? ' lead' : ''}">`;
  return `${open}<div class="row"><span class="chip">${esc(n.cat)}</span>${n.kind === 'fact' ? '<span class="chip plain">Fact</span>' : ''}</div>
    <span class="title">${esc(n.title)}</span><p${link ? ' class="clamp"' : ''}>${esc(n.summary)}</p>
    <p class="why"><b>Why it matters.</b> ${esc(n.why)}</p>
    <div class="row between"><span class="muted">${esc(n.src)}</span>${link ? '<span class="chip">Read</span>' : ''}</div>${link ? '</a>' : '</div>'}`;
};
function newsTab() {
  const cat = CATS.some(c => c[0] === ui.sub.newsCat) ? ui.sub.newsCat : 'All';
  const items = app.news.items || [];
  const list = items.filter(n => cat === 'All' || n.cat === cat);
  const stories = list.filter(n => n.kind !== 'fact'), facts = list.filter(n => n.kind === 'fact');
  const stale = app.news.date && app.news.date !== today();
  return `<div class="tabs">${CATS.map(([id, l]) => `<button class="${cat === id ? 'on' : ''}" data-act="newsCat" data-id="${id}">${l}</button>`).join('')}</div>
    <div class="row between" style="padding:0 6px"><span class="muted">${items.length ? `${stories.length} stories${facts.length ? ` and ${facts.length} facts` : ''}` : ''}</span>${app.news.date ? chip(stale ? 'Updated ' + fmtDay(app.news.date) : 'Updated today', stale ? 'warn' : 'ok') : ''}</div>
    ${items.length ? (list.length ? `<div class="news-list">${[...stories, ...facts].map((n, i) => story(n, i === 0 && n.kind !== 'fact')).join('')}</div>` : `<div class="card">${empty('Nothing in this category today.')}</div>`) : `<div class="card">${empty('News is unavailable right now. It refreshes every morning.')}</div>`}`;
}

// ---- cases ----
const PAGES = [['practice', 'Practice'], ['cases', 'Cases'], ['toolkit', 'Toolkit'], ['tech', 'HR tech']];
const li = (a, b) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`;
const fw = f => `<details class="ref"><summary>${esc(f.name)} ${chip(esc(f.area), 'plain')}</summary><p>${esc(f.summary)}</p><ul class="list">${f.parts.map(([a, b]) => li(a, b)).join('')}</ul><p><b>Use it for:</b> ${esc(f.use)}</p><p class="muted"><b>Example:</b> ${esc(f.example)}</p></details>`;

function practicePage() {
  const idx = ((new Date().getDate() + (ui.sub.pOff || 0)) % PRACTICE.length + PRACTICE.length) % PRACTICE.length;
  const p = PRACTICE[idx];
  const key = today() + ':' + idx, gs = S.guess[key] || { text: '', revealed: false };
  const kv = (k, v) => `<div><b>${k}</b>${v}</div>`;
  return `<div class="card"><div class="row between"><h2 style="margin:0">Problem of the day</h2><button class="ghost" data-act="nextProblem">Another</button></div>
    <p class="title" style="margin-top:12px">${esc(p.q)}</p>
    <p class="muted">Write how you would structure it before you look. Two minutes is enough.</p>
    <textarea data-bind="guess" data-key="${esc(key)}" aria-label="Your approach" placeholder="Clarify, structure, hypothesis, data, recommendation...">${esc(gs.text)}</textarea>
    ${gs.revealed ? `<div class="kv">${kv('Questions to clarify', `<ul>${p.clarify.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`)}${kv('A structure', `<ul>${p.tree.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`)}${kv('Starting hypothesis', esc(p.hypo))}${kv('Data to ask for', esc(p.data))}${kv('Recommendation', esc(p.rec))}</div>
      <p class="muted">This is one reasonable answer, not the answer. Compare it with yours and note what you missed.</p>` : `<div class="row"><button class="primary" data-act="reveal" data-key="${esc(key)}">Show a suggested approach</button></div>`}</div>
  <div class="card"><h2>The playbook</h2><ol class="list steps">${PLAYBOOK.map(([a, b]) => li(a, b)).join('')}</ol>
    <details><summary>Habits of thought</summary><ul class="list">${MINDSET.map(([a, b]) => li(a, b)).join('')}</ul></details></div>`;
}
function casesPage() {
  const week = Math.floor(Date.now() / 6048e5), c0 = CASES[week % CASES.length];
  const one = c => `<details class="ref" ${c === c0 ? 'open' : ''}><summary>${esc(c.title)} ${chip(esc(c.theme), 'plain')}</summary>
    <p class="muted">${esc(c.org)}</p><p>${esc(c.situation)}</p>
    <div class="kv"><div><b>The question</b>${esc(c.question)}</div><div><b>What happened</b><ul>${c.moves.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div><div><b>Outcome</b>${esc(c.result)}</div><div><b>Lesson</b>${esc(c.lesson)}</div></div>
    <p class="muted"><b>Frameworks to reach for:</b> ${esc(c.lens)}</p></details>`;
  return `<div class="card"><h2>Case library ${chip(`${CASES.length} cases`, 'plain')}</h2><p class="muted">Summaries of widely reported public cases. Verify figures before quoting them. This week's pick is open.</p><div class="stack" style="gap:10px;margin-top:12px">${CASES.map(one).join('')}</div></div>`;
}
function toolkitPage() {
  const extra = FRAMEWORKS.filter(f => f.area === 'HR' || f.area === 'Strategy');
  return `<div class="card"><h2>Change and organisation tools</h2><div class="stack" style="gap:10px;margin-top:12px">${TOOLKIT.map(fw).join('')}</div></div>
    <div class="card"><h2>Classic HR and strategy frameworks</h2><div class="stack" style="gap:10px;margin-top:12px">${extra.map(fw).join('')}</div></div>
    <div class="card"><h2>Thinking models</h2><div class="stack" style="gap:10px;margin-top:12px">${MENTAL_MODELS.map(m => `<details class="ref"><summary>${esc(m.name)}</summary><p>${esc(m.summary)}</p><p><b>Use it when:</b> ${esc(m.use)}</p><p class="muted"><b>Example:</b> ${esc(m.example)}</p></details>`).join('')}</div></div>`;
}
function techPage() {
  return `<div class="card"><h2>The HR technology map</h2><p class="muted">Transformation work is usually delivered through these systems, so know what each is for.</p><div class="kv" style="margin-top:12px">${HR_TECH.map(([a, b]) => `<div><b>${esc(a)}</b>${esc(b)}</div>`).join('')}</div></div>`;
}
function casesTab() {
  const page = subOf('casepage', PAGES);
  return `${pills('casepage', PAGES)}${{ practice: practicePage, cases: casesPage, toolkit: toolkitPage, tech: techPage }[page]()}`;
}

function render() {
  const sub = subOf('learn', TABS);
  return `${head('Learn', sub === 'news' ? 'What is happening, and why it matters.' : 'Think like an HR transformation consultant.')}${tabs('learn', TABS)}<div class="stack">${{ news: newsTab, cases: casesTab }[sub]()}</div>`;
}

register({
  id: 'learn', label: 'Learn', nav: 2, render,
  actions: {
    newsCat: d => { ui.sub.newsCat = d.id; },
    reveal: d => { (S.guess[d.key] ||= { text: '' }).revealed = true; },
    nextProblem: () => { ui.sub.pOff = (ui.sub.pOff || 0) + 1; },
  },
  inputs: {
    guess: el => { (S.guess[el.dataset.key] ||= { revealed: false }).text = el.value; },
  },
});
