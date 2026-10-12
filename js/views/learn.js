import { S, ui, app, register } from '../core.js';
import { today, esc, pick, fmtDay } from '../util.js';
import { empty, chip, bar, tabs, subOf, head } from '../ui.js';
import { GUESSTIMATES, FRAMEWORKS, JARGON, MENTAL_MODELS, TEARDOWNS, HR_TRENDS, DAILY_FIVE } from '../data.js';
import { learnCount, learnStreak } from '../logic.js';

const TABS = [['daily', 'Daily'], ['news', 'News'], ['reference', 'Reference']];
const done = k => !!(S.learnDone[today()] || {})[k];
const tick = k => `<label class="check"><input type="checkbox" data-act="learnTick" data-key="${k}" ${done(k) ? 'checked' : ''}> Done for today</label>`;

function dailyTab() {
  const t = today(), g = pick(GUESSTIMATES), f = pick(FRAMEWORKS), j = pick(JARGON), mm = pick(MENTAL_MODELS);
  const weekIdx = Math.floor(Date.now() / 6048e5);
  const td = TEARDOWNS[weekIdx % TEARDOWNS.length], tr = HR_TRENDS[weekIdx % HR_TRENDS.length];
  const gs = S.guess[t] || { text: '', revealed: false };
  return `
  <div class="card"><div class="row between"><h2 style="margin:0">Daily five</h2>${chip(`${learnStreak()} day streak`, 'ok')}</div>${bar(learnCount(t) * 20)}<div class="row">${DAILY_FIVE.map(([k, l]) => chip(l, done(k) ? 'ok' : 'plain')).join('')}</div><p class="muted">Three of five keeps your streak alive.</p></div>
  <div class="card"><h2>Guesstimate</h2><p class="title">${esc(g.q)}</p><p class="muted">Hint: ${esc(g.hint)}</p>
    <textarea data-bind="guess" aria-label="Your approach" placeholder="Write your approach before you peek...">${esc(gs.text)}</textarea>
    ${gs.revealed ? `<h3>Breakdown</h3><ol class="list steps">${g.steps.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ol><p class="quote">${esc(g.answer)}</p>` : `<button class="primary" data-act="reveal">Reveal breakdown</button>`}
    ${tick('guess')}</div>
  <div class="card"><h2>Framework ${chip(esc(f.area), 'plain')}</h2><p class="title">${esc(f.name)}</p><p>${esc(f.summary)}</p>
    <ul class="list">${f.parts.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ul>
    <p><b>Use it for:</b> ${esc(f.use)}</p><p class="muted"><b>Example:</b> ${esc(f.example)}</p>
    ${tick('framework')}</div>
  <div class="card"><h2>Jargon buster</h2><p class="title">${esc(j.term)}</p><p>${esc(j.meaning)}</p>${tick('jargon')}</div>
  <div class="card"><h2>Mental model</h2><p class="title">${esc(mm.name)}</p><p>${esc(mm.summary)}</p><p><b>Use it when:</b> ${esc(mm.use)}</p><p class="muted"><b>Example:</b> ${esc(mm.example)}</p>${tick('model')}</div>
  <details class="card"><summary>Weekly reading: campaign teardown and HR trend</summary><div><h2>Campaign teardown ${chip(esc(td.verdict), 'plain')}</h2><p class="title">${esc(td.name)}</p><p class="muted">${esc(td.brand)} · ${esc(td.year)}</p>
    <ul class="list">${[['Audience', td.audience], ['Positioning', td.positioning], ['Tactics', td.tactics], ['Result', td.result]].map(([a, b]) => `<li><div><b>${a}</b><div>${esc(b)}</div></div></li>`).join('')}</ul><p class="quote">${esc(td.lesson)}</p></div>
    <div><h2>HR and OB trend</h2><p class="title">${esc(tr.title)}</p><p>${esc(tr.body)}</p><p class="muted">${esc(tr.lens)}</p></div></details>`;
}

function newsTab() {
  const cats = ['International', 'Indian', 'Business', 'Tech'];
  const cat = ui.sub.newsCat || cats[0];
  const items = app.news.items || [];
  const list = items.filter(n => n.cat === cat);
  const stale = app.news.date && app.news.date !== today();
  return `<div class="card"><div class="row between"><h2 style="margin:0">News</h2>${app.news.date ? chip(stale ? 'Updated ' + fmtDay(app.news.date) : 'Updated today', stale ? 'warn' : 'ok') : ''}</div>
    <div class="tabs" style="margin-top:12px">${cats.map(c => `<button class="${cat === c ? 'on' : ''}" data-act="newsCat" data-id="${c}">${c}</button>`).join('')}</div>
    ${items.length ? (list.length ? list.map(n => { const link = /^https?:\/\//.test(n.url || ''); return `<${link ? `a class="panel story" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"` : 'div class="panel story"'}><span class="title">${n.kind === 'fact' ? 'Fact: ' : ''}${esc(n.title)}</span><p>${esc(n.summary)}</p><p class="muted"><b>Why it matters:</b> ${esc(n.why)}</p><span class="row"><span class="chip plain">${esc(n.src)}</span>${link ? '<span class="chip">Read more</span>' : ''}</span></${link ? 'a' : 'div'}>`; }).join('') : empty('No stories in this category.')) : empty('News is unavailable right now. It refreshes every morning.')}
    <label class="check" style="margin-top:14px"><input type="checkbox" data-act="learnTick" data-key="news" ${done('news') ? 'checked' : ''}> I read today's news</label></div>`;
}

function referenceTab() {
  const group = (title, items) => `<div class="card"><h2>${title}</h2><div class="stack tight">${items}</div></div>`;
  return `<p class="muted">Everything the Daily tab draws from. Tap an item to open it.</p>
  ${group('Frameworks', FRAMEWORKS.map(f => `<details class="ref"><summary>${esc(f.name)} ${chip(esc(f.area), 'plain')}</summary><p>${esc(f.summary)}</p><ul class="list">${f.parts.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ul><p><b>Use it for:</b> ${esc(f.use)}</p><p class="muted"><b>Example:</b> ${esc(f.example)}</p></details>`).join(''))}
  ${group('Mental models', MENTAL_MODELS.map(m => `<details class="ref"><summary>${esc(m.name)}</summary><p>${esc(m.summary)}</p><p><b>Use it when:</b> ${esc(m.use)}</p><p class="muted"><b>Example:</b> ${esc(m.example)}</p></details>`).join(''))}
  ${group('Jargon', JARGON.map(j => `<details class="ref"><summary>${esc(j.term)}</summary><p>${esc(j.meaning)}</p></details>`).join(''))}`;
}

function render() {
  const sub = subOf('learn', TABS);
  return `${head('Learn', 'Knowledge that compounds.')}${tabs('learn', TABS)}<div class="stack">${{ daily: dailyTab, news: newsTab, reference: referenceTab }[sub]()}</div>`;
}

register({
  id: 'learn', label: 'Learn', nav: 2, render,
  actions: {
    newsCat: d => { ui.sub.newsCat = d.id; },
    reveal: () => { (S.guess[today()] ||= { text: '' }).revealed = true; },
  },
  inputs: {
    guess: el => { (S.guess[today()] ||= { revealed: false }).text = el.value; },
  },
});
