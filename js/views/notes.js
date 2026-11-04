// Notes: notebooks (books) with pages. A page is a title plus lines that can be text, headings, bullets, numbers or checkboxes.
// The editor never re-renders while typing (data-bind); structural changes (Enter, a new line type, ticking) re-render and put the caret back.
import { S, ui, app, register, commit, render as rerender } from '../core.js';
import { esc, uid, fmtDay, dateKey } from '../util.js';
import { empty, chip, head } from '../ui.js';
import { TYPES, blk, page, book, bookName, addPage, quickNote, pageText, pageTitle, pagePreview, checkProgress, wordCount, checklistToTasks, ensureBook } from '../notes.js';

const nb = ui.nb = { book: 'all', page: null, q: '', blk: null, confirm: '', focus: null, newBook: false };
const STARTERS = ['Interview prep', 'Case notes', 'Ideas', 'Reading list'];
const when = ms => fmtDay(dateKey(new Date(ms)));
const cur = () => page(nb.page);

const pageRow = p => { const pr = checkProgress(p);
  return `<li class="pg" data-pg data-q="${esc((pageText(p) + ' ' + bookName(p.bookId)).toLowerCase())}" data-flip="p:${esc(p.id)}">
    <button class="pg-main" data-act="pageOpen" data-id="${esc(p.id)}"><span class="title">${esc(pageTitle(p))}</span>${pagePreview(p) ? `<span class="pg-pre">${esc(pagePreview(p))}</span>` : ''}
      <span class="pg-meta">${chip(esc(bookName(p.bookId)), 'plain')}<span class="muted">${esc(when(p.upd || p.at))}</span>${pr ? chip(`${pr.done}/${pr.total}`, pr.done === pr.total ? 'ok' : '') : ''}</span></button>
    <button class="ghost pin ${p.pinned ? 'on' : ''}" data-act="pagePin" data-id="${esc(p.id)}" aria-pressed="${!!p.pinned}" aria-label="${p.pinned ? 'Unpin' : 'Pin'} page">${p.pinned ? 'Pinned' : 'Pin'}</button></li>`; };

function listView() {
  const inBook = p => nb.book === 'all' || (nb.book === 'inbox' ? !p.bookId || !book(p.bookId) : p.bookId === nb.book);
  const all = S.pages.filter(inBook).sort((a, b) => (b.upd || b.at) - (a.upd || a.at));
  const pinned = all.filter(p => p.pinned), rest = all.filter(p => !p.pinned);
  const inboxN = S.pages.filter(p => !p.bookId || !book(p.bookId)).length;
  const cnt = id => S.pages.filter(p => p.bookId === id).length;
  const b = book(nb.book);
  const bookBar = `<div class="bookbar" role="tablist" aria-label="Books">
    <button role="tab" aria-selected="${nb.book === 'all'}" class="${nb.book === 'all' ? 'on' : ''}" data-act="noteBook" data-id="all">All <i>${S.pages.length}</i></button>
    ${inboxN || nb.book === 'inbox' ? `<button role="tab" aria-selected="${nb.book === 'inbox'}" class="${nb.book === 'inbox' ? 'on' : ''}" data-act="noteBook" data-id="inbox">Inbox <i>${inboxN}</i></button>` : ''}
    ${S.books.map(x => `<button role="tab" aria-selected="${nb.book === x.id}" class="${nb.book === x.id ? 'on' : ''}" data-act="noteBook" data-id="${esc(x.id)}">${esc(x.name)} <i>${cnt(x.id)}</i></button>`).join('')}
    <button class="add" data-act="bookNew">+ Book</button></div>`;
  const newBook = nb.newBook ? `<form data-form="book" class="capture"><input name="name" placeholder="Book name, like Interview prep" maxlength="40" required aria-label="Book name"><button class="primary">Create</button></form>` : '';
  const manage = b ? `<section class="card book-manage"><div class="row between"><input class="book-name" data-bind="bookName" data-id="${esc(b.id)}" value="${esc(b.name)}" maxlength="40" aria-label="Book name"><button class="ghost danger" data-act="bookDel" data-id="${esc(b.id)}">${nb.confirm === 'b:' + b.id ? 'Tap again to delete the book' : 'Delete book'}</button></div>
    ${nb.confirm === 'b:' + b.id ? `<p class="muted">Its ${cnt(b.id)} page${cnt(b.id) === 1 ? '' : 's'} move to the Inbox. Nothing is lost.</p>` : ''}</section>` : '';
  return `${head('Notes', S.pages.length ? `${S.pages.length} page${S.pages.length === 1 ? '' : 's'} in ${S.books.length + 1} book${S.books.length ? 's' : ''}` : 'Your second brain')}
  <form data-form="jot" data-keep class="capture"><input name="text" placeholder="Jot something down" aria-label="Quick note" required><button class="primary">Save</button></form>
  <div class="row"><button class="primary" data-act="pageNew">New page</button>
    <input class="search" type="search" data-bind="noteSearch" value="${esc(nb.q)}" placeholder="Search notes" aria-label="Search notes"></div>
  ${bookBar}${newBook}${manage}
  ${all.length ? `${pinned.length ? `<section class="card"><h3 class="group-h">Pinned</h3><ul class="list pages">${pinned.map(pageRow).join('')}</ul></section>` : ''}
    ${rest.length ? `<section class="card">${pinned.length ? '<h3 class="group-h">Pages</h3>' : ''}<ul class="list pages">${rest.map(pageRow).join('')}</ul></section>` : ''}`
    : `<section class="card">${empty(S.pages.length ? 'No pages in this book yet. Tap New page.' : 'Nothing here yet. Jot a thought above, or start a page. Share a link from any app and it lands here too.')}
      ${!S.books.length ? `<div class="starters"><span class="muted">Start a book:</span>${STARTERS.map(n => `<button class="pill" data-act="bookStarter" data-id="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}</section>`}`;
}

let nIdx = 0;
const blockRow = (b, all, i) => {
  if (b.t !== 'n') nIdx = 0;
  const lvl = Math.min(2, b.l || 0);
  let mark = '';
  if (b.t === 'b') mark = `<span class="mk">${['•', '◦', '▪'][lvl]}</span>`;
  else if (b.t === 'n') { const prev = all[i - 1]; nIdx = prev && prev.t === 'n' && (prev.l || 0) === lvl ? nIdx + 1 : 1; mark = `<span class="mk num">${nIdx}.</span>`; }
  else if (b.t === 'c') mark = `<input type="checkbox" class="tick" data-act="blkCheck" data-id="${esc(b.id)}" ${b.d ? 'checked' : ''} aria-label="Done">`;
  const ph = all.length === 1 && !b.x && b.t === 'p' ? ' placeholder="Start typing. Try - for bullets, [] for a checklist, # for a heading"' : '';
  return `<div class="blk t-${b.t} ${b.d ? 'done' : ''} ${nb.blk === b.id ? 'cur' : ''}" style="--lv:${lvl}" data-flip="b:${esc(b.id)}">${mark}<textarea rows="1" data-grow data-blk="${esc(b.id)}" data-bind="blkText" data-id="${esc(b.id)}" aria-label="Line"${ph}>${esc(b.x)}</textarea></div>`;
};

function pageView() {
  const p = cur();
  const sel = p.bookId && book(p.bookId) ? p.bookId : '';
  const pr = checkProgress(p);
  nIdx = 0;
  const t = (nb.blk && p.blocks.find(b => b.id === nb.blk))?.t;
  const fm = (id, label) => `<button data-act="blkType" data-t="${id}" class="${t === id ? 'on' : ''}">${label}</button>`;
  return `<div class="pg-top"><button class="pill" data-act="pageClose">Notes</button><span class="row" style="gap:6px">
      <button class="ghost" data-act="pagePin" data-id="${esc(p.id)}" aria-pressed="${!!p.pinned}">${p.pinned ? 'Unpin' : 'Pin'}</button>
      <button class="ghost" data-act="pageCopy" data-id="${esc(p.id)}">Copy</button>
      <button class="ghost danger" data-act="pageDel" data-id="${esc(p.id)}">${nb.confirm === 'p:' + p.id ? 'Tap again to delete' : 'Delete'}</button></span></div>
  <section class="card editor"><input class="pg-title" data-bind="pageTitle" value="${esc(p.title)}" placeholder="Title" maxlength="120" aria-label="Page title">
    <div class="pg-info"><select data-bind="pageBook" aria-label="Book"><option value="" ${sel === '' ? 'selected' : ''}>Inbox</option>${S.books.map(b => `<option value="${esc(b.id)}" ${sel === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      <span class="muted" data-words>${wordCount(p)} words · ${esc(when(p.upd || p.at))}</span>${pr ? chip(`${pr.done}/${pr.total} done`, pr.done === pr.total ? 'ok' : '') : ''}</div>
    <div class="blocks">${p.blocks.map((b, i) => blockRow(b, p.blocks, i)).join('')}</div>
    <button class="ghost addline" data-act="blkAdd">+ Add a line</button>
    ${pr && pr.done < pr.total ? `<div class="row"><button data-act="pageTasks" data-id="${esc(p.id)}">Turn open checklist items into tasks</button></div>` : ''}</section>
  <div class="fmtbar" role="toolbar" aria-label="Format the current line">${fm('p', 'Text')}${fm('h', 'Heading')}${fm('b', 'Bullet')}${fm('n', 'Number')}${fm('c', 'Check')}<span class="sep"></span>
    <button data-act="blkIndent" data-d="1">Indent</button><button data-act="blkIndent" data-d="-1">Outdent</button><span class="sep"></span><button data-act="blkMove" data-d="-1">Up</button><button data-act="blkMove" data-d="1">Down</button><button class="danger" data-act="blkDel">Remove</button></div>`;
}

function render() {
  document.body.classList.toggle('editing', !!(nb.page && cur()));
  if (nb.page && !cur()) nb.page = null;
  return nb.page ? pageView() : listView();
}

const touch = p => { p.upd = Date.now(); };
const curBlk = p => p.blocks.find(b => b.id === nb.blk) || p.blocks[p.blocks.length - 1];
const open = id => { nb.page = id; nb.confirm = ''; window.scrollTo(0, 0); };

// Typing shortcuts: "- " bullet, "[] " checkbox, "# " heading, "1. " numbered. Returns true when the line changed type.
const SHORT = [[/^(?:-|\*|•) /, 'b'], [/^\[ ?\] ?/, 'c'], [/^#{1,3} /, 'h'], [/^\d+[.)] /, 'n']];
function shortcut(b) {
  if (b.t !== 'p') return false;
  for (const [re, t] of SHORT) { const m = b.x.match(re); if (m && (re.source.startsWith('^\\[') ? /^\[ ?\] /.test(b.x) || b.x === '[]' : true)) { b.t = t; b.x = b.x.slice(m[0].length); return true; } }
  return false;
}

register({
  id: 'notes', label: 'Notes', nav: 3, render,
  actions: {
    noteBook: d => { nb.book = d.id; nb.confirm = ''; nb.newBook = false; },
    bookNew: () => { nb.newBook = !nb.newBook; },
    bookStarter: d => { nb.book = ensureBook(d.id).id; },
    bookDel: d => { if (nb.confirm !== 'b:' + d.id) { nb.confirm = 'b:' + d.id; return; } S.pages.forEach(p => { if (p.bookId === d.id) p.bookId = ''; }); S.books = S.books.filter(b => b.id !== d.id); nb.book = 'all'; nb.confirm = ''; },
    pageNew: () => { const p = addPage({ bookId: nb.book !== 'all' && nb.book !== 'inbox' ? nb.book : '' }); open(p.id); nb.focus = { sel: '.pg-title' }; },
    pageOpen: d => { open(d.id); },
    pageClose: () => { nb.page = null; nb.confirm = ''; nb.blk = null; },
    pagePin: d => { const p = page(d.id); if (p) p.pinned = !p.pinned; },
    pageDel: d => { if (nb.confirm !== 'p:' + d.id) { nb.confirm = 'p:' + d.id; return; } S.pages = S.pages.filter(p => p.id !== d.id); nb.page = null; nb.confirm = ''; },
    pageCopy: d => { const p = page(d.id); if (p && navigator.clipboard) navigator.clipboard.writeText(pageText(p)).catch(() => {}); },
    pageTasks: d => { const p = page(d.id); if (p) checklistToTasks(p); },
    blkAdd: () => { const p = cur(); if (!p) return; const last = p.blocks[p.blocks.length - 1]; const b = blk(last && ['b', 'n', 'c'].includes(last.t) ? last.t : 'p', '', last ? last.l || 0 : 0); p.blocks.push(b); nb.blk = b.id; nb.focus = { id: b.id, pos: 0 }; touch(p); },
    blkCheck: d => { const p = cur(), b = p?.blocks.find(x => x.id === d.id); if (b) { b.d = !b.d; touch(p); } },
    blkType: d => { const p = cur(); if (!p) return; const b = curBlk(p); b.t = d.t; if (d.t !== 'c') b.d = false; if (d.t === 'p' || d.t === 'h') b.l = 0; nb.blk = b.id; nb.focus = { id: b.id }; touch(p); },
    blkIndent: d => { const p = cur(); if (!p) return; const b = curBlk(p); b.l = Math.max(0, Math.min(2, (b.l || 0) + Number(d.d))); nb.focus = { id: b.id }; touch(p); },
    blkMove: d => { const p = cur(); if (!p) return; const b = curBlk(p), i = p.blocks.indexOf(b), j = i + Number(d.d); if (j < 0 || j >= p.blocks.length) { nb.focus = { id: b.id }; return; } p.blocks.splice(i, 1); p.blocks.splice(j, 0, b); nb.focus = { id: b.id }; touch(p); },
    blkDel: () => { const p = cur(); if (!p) return; const b = curBlk(p), i = p.blocks.indexOf(b); p.blocks.splice(i, 1); if (!p.blocks.length) p.blocks.push(blk()); const nx = p.blocks[Math.max(0, i - 1)]; nb.blk = nx.id; nb.focus = { id: nx.id, pos: nx.x.length }; touch(p); },
  },
  forms: {
    jot: f => { quickNote(f.text); },
    book: f => { const n = (f.name || '').trim(); if (n) { nb.book = ensureBook(n).id; nb.newBook = false; } },
  },
  inputs: {
    noteSearch: el => { nb.q = el.value; const q = el.value.trim().toLowerCase(); document.querySelectorAll('[data-pg]').forEach(li => { li.hidden = !!q && !li.dataset.q.includes(q); }); },
    bookName: el => { const b = book(el.dataset.id); if (b) b.name = el.value.slice(0, 40) || b.name; },
    pageTitle: el => { const p = cur(); if (p) { p.title = el.value; touch(p); } },
    pageBook: el => { const p = cur(); if (p) { p.bookId = el.value; touch(p); } },
    blkText: el => {
      const p = cur(), b = p?.blocks.find(x => x.id === el.dataset.id); if (!b) return;
      b.x = el.value; touch(p); nb.blk = b.id;
      if (shortcut(b)) { nb.focus = { id: b.id, pos: b.x.length }; rerender(); return; }
      grow(el); const w = document.querySelector('[data-words]'); if (w) w.textContent = `${wordCount(p)} words · ${when(p.upd)}`;
    },
  },
});

function grow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// After every draw: size the text boxes to their text, and put the caret where an edit asked for it.
app.after.push(() => {
  document.querySelectorAll('textarea[data-grow]').forEach(grow);
  const f = nb.focus; nb.focus = null;
  if (!f || ui.view !== 'notes') return;
  const el = f.id ? document.querySelector(`[data-blk="${CSS.escape(f.id)}"]`) : document.querySelector(f.sel);
  if (!el) return;
  el.focus({ preventScroll: false });
  const pos = f.pos === undefined ? el.value.length : f.pos;
  try { el.setSelectionRange(pos, pos); } catch { /* not a text box */ }
});

// ---- keys inside a line: Enter makes the next line (continuing a list), Backspace at the start steps back ----
function split(el) {
  const p = cur(), i = p.blocks.findIndex(x => x.id === el.dataset.blk), b = p.blocks[i]; if (!b) return;
  const pos = el.selectionStart, before = el.value.slice(0, pos), after = el.value.slice(el.selectionEnd);
  if (['b', 'n', 'c'].includes(b.t) && !el.value.trim()) { b.t = 'p'; b.l = 0; b.d = false; b.x = ''; nb.focus = { id: b.id, pos: 0 }; }
  else {
    b.x = before;
    const nxt = blk(['b', 'n', 'c'].includes(b.t) ? b.t : 'p', after, b.l || 0);
    p.blocks.splice(i + 1, 0, nxt); nb.blk = nxt.id; nb.focus = { id: nxt.id, pos: 0 };
  }
  touch(p); commit();
}
function back(el) {
  const p = cur(), i = p.blocks.findIndex(x => x.id === el.dataset.blk), b = p.blocks[i]; if (!b) return;
  if (b.t !== 'p') { b.t = 'p'; b.d = false; b.l = 0; nb.focus = { id: b.id, pos: 0 }; }
  else if (i > 0) { const prev = p.blocks[i - 1], at = prev.x.length; prev.x += b.x; p.blocks.splice(i, 1); nb.blk = prev.id; nb.focus = { id: prev.id, pos: at }; }
  else return false;
  touch(p); commit();
}
const isLine = e => e.target && e.target.matches && e.target.matches('textarea[data-blk]');
document.addEventListener('keydown', e => {
  if (!isLine(e)) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); split(e.target); }
  else if (e.key === 'Backspace' && e.target.selectionStart === 0 && e.target.selectionEnd === 0 && !e.isComposing) { if (back(e.target) !== false) e.preventDefault(); }
});
document.addEventListener('beforeinput', e => {   // soft keyboards that do not send key events
  if (!isLine(e)) return;
  if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); split(e.target); }
  else if (e.inputType === 'deleteContentBackward' && e.target.selectionStart === 0 && e.target.selectionEnd === 0) { if (back(e.target) !== false) e.preventDefault(); }
});
document.addEventListener('focusin', e => { if (isLine(e)) { nb.blk = e.target.dataset.blk; document.querySelectorAll('.blk.cur').forEach(x => x.classList.remove('cur')); e.target.closest('.blk')?.classList.add('cur'); } });
// Tapping the format bar must not take the keyboard away from the line being edited.
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.fmtbar')) e.preventDefault(); });
