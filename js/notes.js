// Notes domain logic: books (notebooks), pages and blocks. No HTML here.
// A page is a title plus blocks; a block is { id, t, x, d, l }: t = p (text), h (heading), b (bullet), n (numbered), c (checkbox); d = ticked; l = indent 0-2.
import { S } from './core.js';
import { uid } from './util.js';

export const TYPES = { p: 'Text', h: 'Heading', b: 'Bullet', n: 'Number', c: 'Checklist' };
export const blk = (t = 'p', x = '', l = 0) => ({ id: uid(), t, x, d: false, l });
export const page = id => S.pages.find(p => p.id === id);
export const book = id => S.books.find(b => b.id === id);
export const bookName = id => (id && book(id)?.name) || 'Inbox';

export function ensureBook(name) {
  let b = S.books.find(x => x.name === name);
  if (!b) { b = { id: uid(), name, at: Date.now() }; S.books.push(b); }
  return b;
}
export function addPage({ title = '', bookId = '', blocks, ...rest } = {}) {
  const now = Date.now();
  const p = { id: uid(), title, bookId, blocks: blocks && blocks.length ? blocks : [blk()], pinned: false, at: now, upd: now, ...rest };
  S.pages.push(p);
  return p;
}
// Plain text in, a page out: "- item" becomes a bullet, "[ ] item" a checkbox, "# text" a heading. The first line is the title.
export function blocksFromText(text) {
  return String(text || '').split('\n').map(line => {
    let m;
    if ((m = line.match(/^\s*\[( |x|X)?\]\s+(.*)$/))) { const b = blk('c', m[2]); b.d = /x/i.test(m[1] || ''); return b; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) return blk('b', m[1]);
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) return blk('n', m[1]);
    if ((m = line.match(/^#+\s+(.*)$/))) return blk('h', m[1]);
    return blk('p', line);
  });
}
export function quickNote(text, extra = {}) {
  const lines = String(text || '').split('\n').filter(l => l.trim());
  if (!lines.length) return null;
  const one = lines.length === 1 && lines[0].length <= 80;
  return addPage({ title: lines[0].replace(/^Talking point:\s*/, '').slice(0, 80), blocks: one ? [blk()] : blocksFromText(lines.slice(1).join('\n')), ...extra });
}
export const pageText = p => [p.title, ...p.blocks.map(b => ({ b: '- ', c: b.d ? '[x] ' : '[ ] ', h: '# ' }[b.t] || '') + b.x)].filter(x => x !== '').join('\n');
export const pageTitle = p => (p.title || '').trim() || (p.blocks.find(b => b.x.trim())?.x.trim().slice(0, 60)) || 'Untitled';
export const pagePreview = p => p.blocks.filter(b => b.x.trim()).slice(p.title.trim() ? 0 : 1, p.title.trim() ? 2 : 3).map(b => b.x.trim()).join(' · ');
export const checkProgress = p => { const c = p.blocks.filter(b => b.t === 'c'); return c.length ? { done: c.filter(b => b.d).length, total: c.length } : null; };
export const wordCount = p => (pageText(p).match(/\S+/g) || []).length;
// Turn each unticked checklist line into a task, once.
export function checklistToTasks(p) {
  let n = 0;
  p.blocks.filter(b => b.t === 'c' && !b.d && b.x.trim()).forEach(b => {
    if (!S.tasks.some(t => !t.done && t.title === b.x.trim())) { S.tasks.push({ id: uid(), title: b.x.trim().slice(0, 140), due: '', important: false, done: false, kind: 'Task' }); n++; }
  });
  return n;
}
