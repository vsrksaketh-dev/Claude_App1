// Notes: notebooks (books) with pages. A page is a title plus lines that can be text, headings, bullets, numbers, checkboxes or quotes.
// The editor never re-renders while typing (data-bind); structural changes (Enter, a new line type, ticking) re-render and put the caret back.
// Deleting moves a page to Trash, where it stays for 30 days and can be restored.
import { S, ui, app, register, commit, render as rerender } from '../core.js';
import { esc, uid, fmtDay, dateKey } from '../util.js';
import { empty, chip, head, linkBtns } from '../ui.js';
import { extractLinks } from '../links.js';
import { saveFile, fileURL, openFile, removeFile, isImage, sizeText } from '../files.js';
import { toast } from '../ui.js';
import { blk, page, book, bookName, addPage, quickNote, pageText, pageTitle, pagePreview, checkProgress, wordCount, checklistToTasks, ensureBook } from '../notes.js';

const nb = ui.nb = { view: null, book: 'all', page: null, q: '', blk: null, confirm: '', focus: null, newBook: false, sort: 'recent', more: false };
const STARTERS = ['Interview prep', 'Case notes', 'Class notes', 'Ideas', 'Reading list'];
const TRASH_DAYS = 30;
const when = ms => fmtDay(dateKey(new Date(ms)));
const ago = ms => { const m = Math.round((Date.now() - ms) / 6e4); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : when(ms); };
const cur = () => page(nb.page);
const live = () => S.pages.filter(p => !p.trashed);
const trash = () => S.pages.filter(p => p.trashed);
// Pages left in Trash longer than 30 days are removed for good.
const dropFiles = list => list.forEach(p => (p.files || []).forEach(removeFile));
const purge = () => { const lim = Date.now() - TRASH_DAYS * 864e5; const old = S.pages.filter(p => p.trashed && p.trashed < lim); if (old.length) { dropFiles(old); S.pages = S.pages.filter(p => !old.includes(p)); } };

const pageRow = p => { const pr = checkProgress(p);
  return `<li class="pg ${p.pinned ? 'pinned' : ''}" data-pg data-q="${esc((pageText(p) + ' ' + bookName(p.bookId)).toLowerCase())}" data-flip="p:${esc(p.id)}">
    <button class="pg-main" data-act="pageOpen" data-id="${esc(p.id)}"><span class="title">${esc(pageTitle(p))}</span>${pagePreview(p) ? `<span class="pg-pre">${esc(pagePreview(p))}</span>` : ''}
      <span class="pg-meta">${nb.book === 'all' ? chip(esc(bookName(p.bookId)), 'plain') : ''}<span class="muted">${esc(when(p.upd || p.at))}</span>${pr ? chip(`${pr.done}/${pr.total}`, pr.done === pr.total ? 'ok' : '') : ''}${p.tp ? chip('Talking point', 'plain') : ''}</span></button>
    <button class="ghost pin ${p.pinned ? 'on' : ''}" data-act="pagePin" data-id="${esc(p.id)}" aria-pressed="${!!p.pinned}" aria-label="${p.pinned ? 'Unpin' : 'Pin'} page">${p.pinned ? 'Pinned' : 'Pin'}</button></li>`; };

const trashRow = p => `<li class="pg"><div class="grow"><span class="title">${esc(pageTitle(p))}</span><div class="muted">Deleted ${esc(ago(p.trashed))} · ${esc(bookName(p.bookId))}</div></div>
  <span class="row" style="gap:4px;flex:none"><button class="ghost" data-act="pageRestore" data-id="${esc(p.id)}">Restore</button><button class="ghost danger" data-act="pagePurge" data-id="${esc(p.id)}">${nb.confirm === 'x:' + p.id ? 'Sure?' : 'Delete'}</button></span></li>`;

const SORTS = { recent: (a, b) => (b.upd || b.at) - (a.upd || a.at), created: (a, b) => b.at - a.at, az: (a, b) => pageTitle(a).localeCompare(pageTitle(b)) };

function listView() {
  purge();
  if (nb.book === 'trash') {
    const t = trash().sort((a, b) => b.trashed - a.trashed);
    return `${head('Trash', t.length ? `${t.length} page${t.length === 1 ? '' : 's'}, kept for ${TRASH_DAYS} days` : 'Empty')}
      <div class="row"><button class="pill" data-act="noteBook" data-id="all">Back to notes</button>${t.length ? `<button class="ghost danger" data-act="trashEmpty">${nb.confirm === 'trash' ? 'Tap again to empty Trash' : 'Empty Trash'}</button>` : ''}</div>
      <section class="card">${t.length ? `<ul class="list pages">${t.map(trashRow).join('')}</ul>` : empty('Nothing in Trash.')}</section>`;
  }
  const pages = live();
  const inBook = p => nb.book === 'all' || (nb.book === 'inbox' ? !p.bookId || !book(p.bookId) : p.bookId === nb.book);
  const all = pages.filter(inBook).sort(SORTS[nb.sort] || SORTS.recent);
  const pinned = all.filter(p => p.pinned), rest = all.filter(p => !p.pinned);
  const inboxN = pages.filter(p => !p.bookId || !book(p.bookId)).length;
  const cnt = id => pages.filter(p => p.bookId === id).length;
  const b = book(nb.book), tn = trash().length;
  const chipB = (id, label, n) => `<button role="tab" aria-selected="${nb.book === id}" class="${nb.book === id ? 'on' : ''}" data-act="noteBook" data-id="${esc(id)}"><span>${esc(label)}</span> <i>${n}</i></button>`;
  const bookBar = `<div class="bookbar" role="tablist" aria-label="Books">${chipB('all', 'All', pages.length)}${inboxN || nb.book === 'inbox' ? chipB('inbox', 'Inbox', inboxN) : ''}${S.books.map(x => chipB(x.id, x.name, cnt(x.id))).join('')}
    <button class="add" data-act="bookNew">+ Book</button>${tn ? `<button class="trash" data-act="noteBook" data-id="trash">Trash <i>${tn}</i></button>` : ''}</div>`;
  const newBook = nb.newBook ? `<form data-form="book" class="capture"><input name="name" placeholder="Book name, like Interview prep" maxlength="40" required aria-label="Book name"><button class="primary">Create</button></form>` : '';
  const manage = b ? `<section class="card book-manage"><div class="row between"><input class="book-name" data-bind="bookName" data-id="${esc(b.id)}" value="${esc(b.name)}" maxlength="40" aria-label="Book name"><button class="ghost danger" data-act="bookDel" data-id="${esc(b.id)}">${nb.confirm === 'b:' + b.id ? 'Tap again to delete' : 'Delete book'}</button></div>
    ${nb.confirm === 'b:' + b.id ? `<p class="muted">Its ${cnt(b.id)} page${cnt(b.id) === 1 ? '' : 's'} move to the Inbox. Nothing is lost.</p>` : '<p class="muted">Tap the name to rename the book.</p>'}</section>` : '';
  const sortBar = all.length > 1 ? `<div class="seg sortbar" role="group" aria-label="Sort">${[['recent', 'Recent'], ['created', 'Newest'], ['az', 'A to Z']].map(([k, l]) => `<button class="${nb.sort === k ? 'on' : ''}" data-act="noteSort" data-id="${k}">${l}</button>`).join('')}</div>` : '';
  return `${head('Notes', pages.length ? `${pages.length} page${pages.length === 1 ? '' : 's'} in ${S.books.length + 1} book${S.books.length ? 's' : ''}` : 'Your second brain')}
  <form data-form="jot" data-keep class="capture"><input name="text" placeholder="Jot something down" aria-label="Quick note" required><button class="primary">Save</button></form>
  <div class="row notes-tools"><button class="primary" data-act="pageNew">New page</button>
    <input class="search" type="search" data-bind="noteSearch" value="${esc(nb.q)}" placeholder="Search notes" aria-label="Search notes"></div>
  ${bookBar}${newBook}${manage}
  ${all.length ? `${sortBar}${pinned.length ? `<section class="card"><h3 class="group-h">Pinned</h3><ul class="list pages">${pinned.map(pageRow).join('')}</ul></section>` : ''}
    ${rest.length ? `<section class="card">${pinned.length ? '<h3 class="group-h">Pages</h3>' : ''}<ul class="list pages">${rest.map(pageRow).join('')}</ul></section>` : ''}
    <p class="muted nores" hidden>No page matches that search.</p>`
    : `<section class="card">${empty(pages.length ? 'No pages in this book yet. Tap New page.' : 'Nothing here yet. Jot a thought above, or start a page. Share a link from any app and it lands here too.')}
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
  const ph = all.length === 1 && !b.x && b.t === 'p' ? ' placeholder="Start typing. Try - for bullets, [] for a checklist, # for a heading, > for a quote"' : '';
  return `<div class="blk t-${b.t} ${b.d ? 'done' : ''} ${nb.blk === b.id ? 'cur' : ''}" style="--lv:${lvl}" data-flip="b:${esc(b.id)}">${mark}<textarea rows="1" data-grow data-blk="${esc(b.id)}" data-bind="blkText" data-id="${esc(b.id)}" aria-label="Line"${ph}>${esc(b.x)}</textarea></div>`;
};

function pageView() {
  const p = cur();
  const sel = p.bookId && book(p.bookId) ? p.bookId : '';
  const pr = checkProgress(p);
  nIdx = 0;
  const t = (nb.blk && p.blocks.find(b => b.id === nb.blk))?.t;
  const fm = (id, label) => `<button data-act="blkType" data-t="${id}" class="${t === id ? 'on' : ''}">${label}</button>`;
  const links = extractLinks(pageText(p), 6);
  return `<div class="pg-top"><button class="pill" data-act="pageClose">‹ Notes</button><span class="row" style="gap:2px">
      <button class="ghost" data-act="pagePin" data-id="${esc(p.id)}" aria-pressed="${!!p.pinned}">${p.pinned ? 'Unpin' : 'Pin'}</button>
      <button class="ghost" data-act="pageMore" aria-expanded="${nb.more}">More</button>
      <button class="ghost danger" data-act="pageDel" data-id="${esc(p.id)}">${nb.confirm === 'p:' + p.id ? 'Move to Trash?' : 'Delete'}</button></span></div>
  ${nb.more ? `<div class="row more-row"><button class="pill" data-act="pageCopy" data-id="${esc(p.id)}">Copy text</button><button class="pill" data-act="pageToTask" data-id="${esc(p.id)}">Make it a task</button><button class="pill" data-act="pageDup" data-id="${esc(p.id)}">Duplicate</button></div>` : ''}
  <section class="card editor"><textarea class="pg-title" rows="1" data-grow data-bind="pageTitle" placeholder="Title" maxlength="160" aria-label="Page title">${esc(p.title)}</textarea>
    <div class="pg-info"><select data-bind="pageBook" aria-label="Book"><option value="" ${sel === '' ? 'selected' : ''}>Inbox</option>${S.books.map(b => `<option value="${esc(b.id)}" ${sel === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      <span class="muted" data-words>${wordCount(p)} words · saved ${esc(ago(p.upd || p.at))}</span>${pr ? chip(`${pr.done}/${pr.total} done`, pr.done === pr.total ? 'ok' : '') : ''}</div>
    <div class="blocks">${p.blocks.map((b, i) => blockRow(b, p.blocks, i)).join('')}</div>
    <button class="ghost addline" data-act="blkAdd">+ Add a line</button>
    <div class="pg-files">${(p.files || []).filter(isImage).map(f => `<button class="thumb" data-act="fileView" data-id="${esc(f.id)}" aria-label="Open ${esc(f.name)}"><img data-file="${esc(f.id)}" alt="${esc(f.name)}"></button>`).join('')}</div>
    ${(p.files || []).filter(f => !isImage(f)).length ? `<ul class="list files">${p.files.filter(f => !isImage(f)).map(f => `<li><div class="grow"><span class="title">${esc(f.name)}</span><div class="muted">${esc(sizeText(f.size))}</div></div><button class="ghost" data-act="fileOpen" data-id="${esc(f.id)}">Open</button><button class="ghost danger x" data-act="fileDel" data-id="${esc(f.id)}" aria-label="Remove file">×</button></li>`).join('')}</ul>` : ''}
    <label class="attach"><input type="file" data-bind="fileAdd" accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv" multiple hidden><span>+ Photo or file</span></label>
    ${links.length ? `<div class="pg-links"><span class="muted">Links on this page</span>${linkBtns(links)}</div>` : ''}
    ${pr && pr.done < pr.total ? `<div class="row"><button data-act="pageTasks" data-id="${esc(p.id)}">Turn open checklist items into tasks</button></div>` : ''}</section>
  <div class="fmtbar" role="toolbar" aria-label="Format the current line">${fm('p', 'Text')}${fm('h', 'Heading')}${fm('b', 'Bullet')}${fm('n', 'Number')}${fm('c', 'Check')}${fm('q', 'Quote')}<span class="sep"></span>
    <button data-act="blkIndent" data-d="1">Indent</button><button data-act="blkIndent" data-d="-1">Outdent</button><span class="sep"></span><button data-act="blkMove" data-d="-1">Up</button><button data-act="blkMove" data-d="1">Down</button><button class="danger" data-act="blkDel">Remove</button></div>`;
}

// Full-screen view of an attached photo, with Remove.
function viewer(p) {
  const f = (p.files || []).find(x => x.id === nb.view); if (!f) return '';
  return `<div class="viewer" role="dialog" aria-label="${esc(f.name)}"><img data-file="${esc(f.id)}" alt="${esc(f.name)}"><div class="row"><button class="pill" data-act="fileView" data-id="">Close</button><button class="pill" data-act="fileOpen" data-id="${esc(f.id)}">Share or open</button><button class="pill danger" data-act="fileDel" data-id="${esc(f.id)}">Remove</button></div></div>`;
}

function render() {
  if (nb.page && (!cur() || cur().trashed)) nb.page = null;
  document.body.classList.toggle('editing', !!nb.page);
  return nb.page ? pageView() + viewer(cur()) : listView();
}

const touch = p => { p.upd = Date.now(); };
const curBlk = p => p.blocks.find(b => b.id === nb.blk) || p.blocks[p.blocks.length - 1];
const open = id => { nb.page = id; nb.confirm = ''; nb.more = false; window.scrollTo(0, 0); };

// Typing shortcuts at the start of a text line: "- " bullet, "[] " checkbox, "# " heading, "1. " numbered, "> " quote.
const SHORT = [[/^(?:-|\*|•) /, 'b'], [/^\[ ?\] /, 'c'], [/^#{1,3} /, 'h'], [/^\d+[.)] /, 'n'], [/^> /, 'q']];
function shortcut(b) {
  if (b.t !== 'p') return false;
  for (const [re, t] of SHORT) { const m = b.x.match(re); if (m) { b.t = t; b.x = b.x.slice(m[0].length); return true; } }
  return false;
}

register({
  id: 'notes', label: 'Notes', nav: 3, render,
  actions: {
    noteBook: d => { nb.book = d.id; nb.confirm = ''; nb.newBook = false; },
    noteSort: d => { nb.sort = d.id; },
    bookNew: () => { nb.newBook = !nb.newBook; },
    bookStarter: d => { nb.book = ensureBook(d.id).id; },
    bookDel: d => { if (nb.confirm !== 'b:' + d.id) { nb.confirm = 'b:' + d.id; return; } S.pages.forEach(p => { if (p.bookId === d.id) p.bookId = ''; }); S.books = S.books.filter(b => b.id !== d.id); nb.book = 'all'; nb.confirm = ''; },
    pageNew: () => { const p = addPage({ bookId: nb.book !== 'all' && nb.book !== 'inbox' && nb.book !== 'trash' ? nb.book : '' }); open(p.id); nb.focus = { sel: '.pg-title' }; },
    pageOpen: d => { open(d.id); },
    pageClose: () => { nb.page = null; nb.confirm = ''; nb.blk = null; nb.more = false; },
    pageMore: () => { nb.more = !nb.more; },
    pagePin: d => { const p = page(d.id); if (p) p.pinned = !p.pinned; },
    pageDel: d => { if (nb.confirm !== 'p:' + d.id) { nb.confirm = 'p:' + d.id; return; } const p = page(d.id); if (p) p.trashed = Date.now(); nb.page = null; nb.confirm = ''; },
    pageRestore: d => { const p = page(d.id); if (p) delete p.trashed; if (!trash().length) nb.book = 'all'; },
    pagePurge: d => { if (nb.confirm !== 'x:' + d.id) { nb.confirm = 'x:' + d.id; return; } dropFiles(S.pages.filter(p => p.id === d.id)); S.pages = S.pages.filter(p => p.id !== d.id); nb.confirm = ''; if (!trash().length) nb.book = 'all'; },
    trashEmpty: () => { if (nb.confirm !== 'trash') { nb.confirm = 'trash'; return; } dropFiles(trash()); S.pages = S.pages.filter(p => !p.trashed); nb.confirm = ''; nb.book = 'all'; },
    pageCopy: d => { const p = page(d.id); if (p && navigator.clipboard) navigator.clipboard.writeText(pageText(p)).catch(() => {}); nb.more = false; },
    pageToTask: d => { const p = page(d.id); if (!p) return; const title = pageTitle(p).slice(0, 140); if (!S.tasks.some(t => !t.done && t.title === title)) S.tasks.push({ id: uid(), title, due: '', time: '', repeat: '', important: false, done: false, kind: 'Task', note: 'From the note "' + title + '"' }); nb.more = false; },
    pageDup: d => { const p = page(d.id); if (!p) return; const c = addPage({ title: (p.title || pageTitle(p)) + ' (copy)', bookId: p.bookId, blocks: p.blocks.map(b => ({ ...b, id: uid() })), files: [] }); open(c.id); },
    fileView: d => { nb.view = d.id || null; },
    fileOpen: d => { const f = (cur()?.files || []).find(x => x.id === d.id); if (f) openFile(f).catch(() => toast('That file could not be opened.')); },
    fileDel: d => { const p = cur(); const f = (p?.files || []).find(x => x.id === d.id); if (!f) return; p.files = p.files.filter(x => x.id !== f.id); nb.view = null; touch(p); toast(`Removed ${f.name}`, () => { p.files.push(f); }); setTimeout(() => { if (!p.files.some(x => x.id === f.id)) removeFile(f); }, 7000); },
    pageTasks: d => { const p = page(d.id); if (p) checklistToTasks(p); },
    blkAdd: () => { const p = cur(); if (!p) return; const last = p.blocks[p.blocks.length - 1]; const b = blk(last && ['b', 'n', 'c'].includes(last.t) ? last.t : 'p', '', last ? last.l || 0 : 0); p.blocks.push(b); nb.blk = b.id; nb.focus = { id: b.id, pos: 0 }; touch(p); },
    blkCheck: d => { const p = cur(), b = p?.blocks.find(x => x.id === d.id); if (b) { b.d = !b.d; touch(p); } },
    blkType: d => { const p = cur(); if (!p) return; const b = curBlk(p); b.t = d.t; if (d.t !== 'c') b.d = false; if (['p', 'h', 'q'].includes(d.t)) b.l = 0; nb.blk = b.id; nb.focus = { id: b.id }; touch(p); },
    blkIndent: d => { const p = cur(); if (!p) return; const b = curBlk(p); b.l = Math.max(0, Math.min(2, (b.l || 0) + Number(d.d))); nb.focus = { id: b.id }; touch(p); },
    blkMove: d => { const p = cur(); if (!p) return; const b = curBlk(p), i = p.blocks.indexOf(b), j = i + Number(d.d); if (j < 0 || j >= p.blocks.length) { nb.focus = { id: b.id }; return; } p.blocks.splice(i, 1); p.blocks.splice(j, 0, b); nb.focus = { id: b.id }; touch(p); },
    blkDel: () => { const p = cur(); if (!p) return; const b = curBlk(p), i = p.blocks.indexOf(b); p.blocks.splice(i, 1); if (!p.blocks.length) p.blocks.push(blk()); const nx = p.blocks[Math.max(0, i - 1)]; nb.blk = nx.id; nb.focus = { id: nx.id, pos: nx.x.length }; touch(p); },
  },
  forms: {
    jot: f => { quickNote(f.text); },
    book: f => { const n = (f.name || '').trim(); if (n) { nb.book = ensureBook(n).id; nb.newBook = false; } },
  },
  inputs: {
    noteSearch: el => {
      nb.q = el.value; const q = el.value.trim().toLowerCase(); let shown = 0;
      document.querySelectorAll('[data-pg]').forEach(li => { li.hidden = !!q && !li.dataset.q.includes(q); if (!li.hidden) shown++; });
      document.querySelectorAll('#view section.card:has(.pages)').forEach(sec => { sec.hidden = !!q && !sec.querySelector('[data-pg]:not([hidden])'); });
      const n = document.querySelector('.nores'); if (n) n.hidden = !q || shown > 0;
    },
    fileAdd: el => {
      const p = cur(); if (!p || !el.files.length) return;
      Promise.all([...el.files].map(f => saveFile(f).then(m => { (p.files ||= []).push(m); }).catch(e => toast(e.message || 'That file could not be saved.'))))
        .then(() => { touch(p); commit(); });
    },
    bookName: el => { const b = book(el.dataset.id); if (b) b.name = el.value.slice(0, 40) || b.name; },
    pageTitle: el => { const p = cur(); if (p) { p.title = el.value.replace(/\n/g, ' '); touch(p); grow(el); } },
    pageBook: el => { const p = cur(); if (p) { p.bookId = el.value; touch(p); } },
    blkText: el => {
      const p = cur(), b = p?.blocks.find(x => x.id === el.dataset.id); if (!b) return;
      b.x = el.value; touch(p); nb.blk = b.id;
      if (shortcut(b)) { nb.focus = { id: b.id, pos: b.x.length }; rerender(); return; }
      grow(el); const w = document.querySelector('[data-words]'); if (w) w.textContent = `${wordCount(p)} words · saved just now`;
    },
  },
});

function grow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// After every draw: size the text boxes to their text, and put the caret where an edit asked for it.
app.after.push(() => {
  if (ui.view !== 'notes') document.body.classList.remove('editing');
  document.querySelectorAll('img[data-file]').forEach(img => { const f = (cur()?.files || []).find(x => x.id === img.dataset.file); if (f) fileURL(f).then(u => { img.src = u; }).catch(() => { img.alt = 'Missing file'; }); });
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
  if (['b', 'n', 'c', 'q'].includes(b.t) && !el.value.trim()) { b.t = 'p'; b.l = 0; b.d = false; b.x = ''; nb.focus = { id: b.id, pos: 0 }; }
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
// Enter in the title jumps to the first line instead of adding a line break to the title.
function titleEnter() { const p = cur(); if (!p) return; nb.focus = { id: p.blocks[0].id, pos: 0 }; nb.blk = p.blocks[0].id; rerender(); }
const isLine = e => e.target && e.target.matches && e.target.matches('textarea[data-blk]');
const isTitle = e => e.target && e.target.matches && e.target.matches('textarea.pg-title');
document.addEventListener('keydown', e => {
  if (isTitle(e) && e.key === 'Enter') { e.preventDefault(); titleEnter(); return; }
  if (!isLine(e)) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); split(e.target); }
  else if (e.key === 'Backspace' && e.target.selectionStart === 0 && e.target.selectionEnd === 0 && !e.isComposing) { if (back(e.target) !== false) e.preventDefault(); }
});
document.addEventListener('beforeinput', e => {   // soft keyboards that do not send key events
  if (isTitle(e) && (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak')) { e.preventDefault(); titleEnter(); return; }
  if (!isLine(e)) return;
  if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); split(e.target); }
  else if (e.inputType === 'deleteContentBackward' && e.target.selectionStart === 0 && e.target.selectionEnd === 0) { if (back(e.target) !== false) e.preventDefault(); }
});
document.addEventListener('focusin', e => { if (isLine(e)) { nb.blk = e.target.dataset.blk; document.querySelectorAll('.blk.cur').forEach(x => x.classList.remove('cur')); e.target.closest('.blk')?.classList.add('cur'); } });
// Tapping the format bar must not take the keyboard away from the line being edited.
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.fmtbar')) e.preventDefault(); });
