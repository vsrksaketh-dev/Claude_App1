// Files attached to notes (photos, PDFs, documents). In the Android app they are saved in the app's private storage on the phone;
// in a browser they go to IndexedDB. Notes only keep { id, name, type, size }. Files are not part of the JSON backup.
import { isNative } from './native.js';

const MAX = 15 * 1024 * 1024;
const fsp = () => window.Capacitor.Plugins.Filesystem;
const DIR = 'files';
const urls = new Map();   // id -> object URL, so a page redraw does not re-read the file

// ---- browser storage ----
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('dd-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('f', mode); const out = fn(t.objectStore('f')); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); }); };

const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const fromB64 = (b64, type) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type }); };
const safe = n => String(n || 'file').replace(/[^\w.\-]+/g, '_').slice(-60);

export async function saveFile(file) {
  if (file.size > MAX) throw new Error('That file is over 15 MB. Attach a smaller one, or add a link instead.');
  const meta = { id: Math.random().toString(36).slice(2, 10), name: file.name || 'file', type: file.type || 'application/octet-stream', size: file.size };
  if (isNative()) {
    try { await fsp().mkdir({ path: DIR, directory: 'DATA', recursive: true }); } catch { /* exists */ }
    await fsp().writeFile({ path: `${DIR}/${meta.id}-${safe(meta.name)}`, data: await toB64(file), directory: 'DATA' });
  } else await tx('readwrite', s => s.put(file, meta.id));
  return meta;
}
async function blobOf(meta) {
  if (isNative()) { const r = await fsp().readFile({ path: `${DIR}/${meta.id}-${safe(meta.name)}`, directory: 'DATA' }); return fromB64(typeof r.data === 'string' ? r.data : '', meta.type); }
  return tx('readonly', s => s.get(meta.id));
}
export async function fileURL(meta) {
  if (urls.has(meta.id)) return urls.get(meta.id);
  const b = await blobOf(meta); if (!b) throw new Error('missing');
  const u = URL.createObjectURL(b); urls.set(meta.id, u); return u;
}
// Opening: in the app, Android's chooser offers whichever app can open it (a PDF reader, Docs, Photos...); in a browser, a new tab.
export async function openFile(meta) {
  if (isNative()) {
    const { uri } = await fsp().getUri({ path: `${DIR}/${meta.id}-${safe(meta.name)}`, directory: 'DATA' });
    await window.Capacitor.Plugins.Share.share({ title: meta.name, url: uri, dialogTitle: 'Open with' });
    return;
  }
  window.open(await fileURL(meta), '_blank');
}
export async function removeFile(meta) {
  urls.delete(meta.id);
  try { if (isNative()) await fsp().deleteFile({ path: `${DIR}/${meta.id}-${safe(meta.name)}`, directory: 'DATA' }); else await tx('readwrite', s => s.delete(meta.id)); } catch { /* already gone */ }
}
export const isImage = m => /^image\//.test(m.type);
export const sizeText = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
