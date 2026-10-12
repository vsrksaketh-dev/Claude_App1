import { S, ui, app, register, byId, remove } from '../core.js';
import { today, esc, pick, uid, fmtDay } from '../util.js';
import { field, empty, chip, bar, tabs, subOf, check } from '../ui.js';
import { GUESSTIMATES, FRAMEWORKS, JARGON, MENTAL_MODELS, TEARDOWNS, HR_TRENDS, LIB_KINDS, DAILY_FIVE } from '../data.js';
import { dueCards, newCard, rateCard, learnCount, learnStreak } from '../logic.js';

const TABS = [['daily', 'Daily'], ['review', 'Review'], ['library', 'Library'], ['log', 'Log']];
const done = k => !!(S.learnDone[today()] || {})[k];
const tick = k => `<label class="check"><input type="checkbox" data-act="learnTick" data-key="${k}" ${done(k) ? 'checked' : ''}> Done for today</label>`;

function dailyTab() {
  const t = today(), g = pick(GUESSTIMATES), f = pick(FRAMEWORKS), j = pick(JARGON), mm = pick(MENTAL_MODELS);
  const weekIdx = Math.floor(Date.now() / 6048e5);
  const td = TEARDOWNS[weekIdx % TEARDOWNS.length], tr = HR_TRENDS[weekIdx % HR_TRENDS.length];
  const gs = S.guess[t] || { text: '', revealed: false };
  return `
  <div class="card"><div class="row between"><h2>Today ${learnCount(t)}/5</h2>${chip(`${learnStreak()} day streak`, 'ok')}</div>${bar(learnCount(t) * 20)}<p class="muted">Three of five keeps the streak alive.</p></div>
  <div class="card"><h2>🎲 Guesstimate</h2><p class="title">${esc(g.q)}</p><p class="muted">Hint: ${esc(g.hint)}</p>
    <textarea data-bind="guess" aria-label="Your approach" placeholder="Write your approach before you peek...">${esc(gs.text)}</textarea>
    ${gs.revealed ? `<h3>Breakdown</h3><ol class="list steps">${g.steps.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ol><p class="quote">${esc(g.answer)}</p>` : `<button class="primary" data-act="reveal">Reveal breakdown</button>`}
    ${tick('guess')}</div>
  <div class="card"><h2>📐 Framework ${chip(esc(f.area), 'plain')}</h2><p class="title">${esc(f.name)}</p><p>${esc(f.summary)}</p>
    <ul class="list">${f.parts.map(([a, b]) => `<li><div><b>${esc(a)}</b><div class="muted">${esc(b)}</div></div></li>`).join('')}</ul>
    <p><b>Use it for:</b> ${esc(f.use)}</p><p class="muted"><b>Example:</b> ${esc(f.example)}</p>
    <div class="row"><button data-act="addCard" data-kind="framework">Add to flashcards</button></div>${tick('framework')}</div>
  <div class="card"><h2>📖 Jargon buster</h2><p class="title">${esc(j.term)}</p><p>${esc(j.meaning)}</p><div class="row"><button data-act="addCard" data-kind="jargon">Add to flashcards</button></div>${tick('jargon')}</div>
  <div class="card"><h2>🧭 Mental model</h2><p class="title">${esc(mm.name)}</p><p>${esc(mm.summary)}</p><p><b>Use it when:</b> ${esc(mm.use)}</p><p class="muted"><b>Example:</b> ${esc(mm.example)}</p><div class="row"><button data-act="addCard" data-kind="model">Add to flashcards</button></div>${tick('model')}</div>
  <div class="card"><h2>📰 News</h2><p>Read it on Today, then tick it off.</p><button data-nav="today">Open Today</button>${tick('news')}</div>
  <details class="card"><summary>Weekly reading: campaign teardown and HR trend</summary><div><h2>🎬 Campaign teardown ${chip(esc(td.verdict), 'plain')}</h2><p class="title">${esc(td.name)}</p><p class="muted">${esc(td.brand)} · ${esc(td.year)}</p>
    <ul class="list">${[['Audience', td.audience], ['Positioning', td.positioning], ['Tactics', td.tactics], ['Result', td.result]].map(([a, b]) => `<li><div><b>${a}</b><div>${esc(b)}</div></div></li>`).join('')}</ul><p class="quote">${esc(td.lesson)}</p></div>
    <div><h2>🏢 HR and OB trend</h2><p class="title">${esc(tr.title)}</p><p>${esc(tr.body)}</p><p class="muted">${esc(tr.lens)}</p></div></details>`;
}

function reviewTab() {
  const due = dueCards();
  const c = due[0];
  const showing = ui.sub.cardFlip;
  const decks = [...new Set(S.cards.map(x => x.deck))];
  return `
  <div class="card"><h2>🧠 Flashcards</h2><p class="muted">${due.length} due · ${S.cards.length} total${decks.length ? ' · ' + decks.map(esc).join(', ') : ''}</p>
    ${c ? `<div class="flash"><p class="muted">${esc(c.deck)}</p><p class="big">${esc(c.front)}</p>${showing ? `<p style="white-space:pre-wrap">${esc(c.back)}</p>
      <div class="row">${[['Again', 0], ['Hard', 1], ['Good', 2], ['Easy', 3]].map(([l, q]) => `<button class="${q === 2 ? 'primary' : ''}" data-act="rate" data-id="${c.id}" data-q="${q}">${l}</button>`).join('')}</div>` : `<button class="primary" data-act="flip">Show answer</button>`}</div>`
      : empty(S.cards.length ? 'All caught up. Come back tomorrow.' : 'No cards yet. Add them from the Daily tab or below.')}</div>
  <div class="card"><h2>Add a card</h2><form data-form="card">${field('Front (question)', 'front', 'required')}<label>Back (answer)<textarea name="back" required></textarea></label>${field('Deck', 'deck', 'placeholder="General"')}<button class="primary">Add card</button></form></div>
  ${S.cards.length ? `<details class="card"><summary>All cards (${S.cards.length})</summary><ul class="list">${S.cards.map(x => `<li><div class="grow"><span class="title">${esc(x.front)}</span><div class="muted">${esc(x.deck)} · next ${x.due === today() ? 'today' : fmtDay(x.due)}</div></div><button class="ghost danger" data-act="cardDel" data-id="${x.id}" aria-label="Delete">✕</button></li>`).join('')}</ul></details>` : ''}`;
}

function libraryTab() {
  const st = ui.sub.libStatus || 'Reading';
  const list = S.library.filter(x => x.status === st);
  return `<div class="tabs">${['Reading', 'Want', 'Done'].map(s => `<button class="${st === s ? 'on' : ''}" data-act="libStatus" data-id="${s}">${s} (${S.library.filter(x => x.status === s).length})</button>`).join('')}</div>
  ${list.length ? list.map(x => `<div class="card"><div class="row between"><span class="title">${esc(x.title)}</span>${chip(esc(x.kind), 'plain')}</div>
    <div class="row">${['Want', 'Reading', 'Done'].filter(s => s !== x.status).map(s => `<button data-act="libMove" data-id="${x.id}" data-status="${s}">${s}</button>`).join('')}${x.status === 'Done' ? `<label class="check">Rating <select data-bind="libRating" data-id="${x.id}">${['', 1, 2, 3, 4, 5].map(r => `<option ${String(x.rating || '') === String(r) ? 'selected' : ''}>${r}</option>`).join('')}</select></label>` : ''}<button class="ghost danger" data-act="libDel" data-id="${x.id}">Delete</button></div>
    ${x.notes.length ? `<ul class="list">${x.notes.slice().reverse().map(n => `<li><div class="grow">${esc(n.text)}<div class="muted">${fmtDay(n.date)}</div></div></li>`).join('')}</ul>` : ''}
    <form data-form="libNote" class="row" style="flex-wrap:nowrap"><input type="hidden" name="id" value="${x.id}"><input name="text" class="grow" placeholder="Add a note or highlight" required><button>Add</button></form></div>`).join('') : empty('Nothing here yet.')}
  <div class="card"><h2>Add to library</h2><form data-form="lib" class="inline">${field('Title', 'title', 'required')}<label>Type<select name="kind">${LIB_KINDS.map(k => `<option>${k}</option>`).join('')}</select></label><label>Status<select name="status"><option>Want</option><option>Reading</option><option>Done</option></select></label><button class="primary">Add</button></form></div>`;
}

function logTab() {
  const byDay = {};
  S.learnLog.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60).forEach(e => (byDay[e.date] ||= []).push(e));
  return `<div class="card"><h2>Today I learned</h2><form data-form="til">${field('What did you learn?', 'text', 'required')}${field('Topic (optional)', 'topic', 'placeholder="Marketing, finance, a skill..."')}<button class="primary">Log it</button></form></div>
  ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, es]) => `<div class="card"><h3>${fmtDay(d)}</h3><ul class="list">${es.map(e => `<li><div class="grow">${esc(e.text)}${e.topic ? ' ' + chip(esc(e.topic), 'plain') : ''}</div><button class="ghost danger" data-act="tilDel" data-id="${e.id}" aria-label="Delete">✕</button></li>`).join('')}</ul></div>`).join('') : empty('Writing down what you learn makes it stick. Start with one line.')}`;
}

function render() {
  const sub = subOf('learn', TABS);
  return `<h1>Learn</h1>${tabs('learn', TABS)}${{ daily: dailyTab, review: reviewTab, library: libraryTab, log: logTab }[sub]()}`;
}

register({
  id: 'learn', label: 'Learn', render,
  actions: {
    reveal: () => { (S.guess[today()] ||= { text: '' }).revealed = true; },
    flip: () => { ui.sub.cardFlip = true; },
    rate: d => { rateCard(byId(S.cards, d.id), Number(d.q)); ui.sub.cardFlip = false; },
    cardDel: d => remove('cards', d.id),
    addCard: d => {
      if (d.kind === 'framework') { const f = pick(FRAMEWORKS); newCard(`${f.name}: what are its parts and when do you use it?`, f.parts.map(([a, b]) => `${a}: ${b}`).join('\n') + `\nUse: ${f.use}`, f.area); }
      if (d.kind === 'jargon') { const j = pick(JARGON); newCard(`What is ${j.term}?`, j.meaning, 'Jargon'); }
      if (d.kind === 'model') { const m = pick(MENTAL_MODELS); newCard(`Mental model: ${m.name}`, `${m.summary}\nUse when: ${m.use}\nExample: ${m.example}`, 'Mental models'); }
    },
    libStatus: d => { ui.sub.libStatus = d.id; },
    libMove: d => { byId(S.library, d.id).status = d.status; },
    libDel: d => remove('library', d.id),
    tilDel: d => remove('learnLog', d.id),
  },
  forms: {
    card: f => newCard(f.front.trim(), f.back.trim(), f.deck.trim() || 'General'),
    lib: f => S.library.push({ id: uid(), title: f.title, kind: f.kind, status: f.status, rating: '', notes: [] }),
    libNote: f => byId(S.library, f.id).notes.push({ id: uid(), date: today(), text: f.text }),
    til: f => { S.learnLog.push({ id: uid(), date: today(), text: f.text, topic: f.topic }); },
  },
  inputs: {
    guess: el => { (S.guess[today()] ||= { revealed: false }).text = el.value; },
    libRating: el => { byId(S.library, el.dataset.id).rating = el.value; },
  },
});
