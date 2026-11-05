// Problem log: the last 60 errors (script errors, failed promises, a screen that failed to draw), with time, screen and app version,
// kept in their own storage key so they survive a broken state. Settings shows them and can share them in one tap.
const KEY = 'daily-driver-log';
const MAX = 60;
export const VERSION = '2026.11.05b';
export function readLog() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
export function logProblem(kind, err, where = '') {
  try {
    const e = err || {};
    const entry = { at: new Date().toISOString(), kind, where, msg: String(e.message || e.reason || e).slice(0, 300), stack: String(e.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 500), v: VERSION };
    const list = readLog();
    if (list.length && list[list.length - 1].msg === entry.msg && list[list.length - 1].where === where) { list[list.length - 1].n = (list[list.length - 1].n || 1) + 1; list[list.length - 1].at = entry.at; }
    else list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch { /* storage full: nothing more we can do */ }
}
export const clearLog = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
export const logText = () => readLog().map(x => `${x.at} [${x.kind}${x.where ? ' · ' + x.where : ''}]${x.n ? ' x' + x.n : ''} ${x.msg}${x.stack ? '\n   ' + x.stack : ''}`).join('\n') || 'No problems recorded.';
// Catch everything that escapes: script errors and promises nobody handled.
export function watchErrors(where) {
  window.addEventListener('error', e => logProblem('error', e.error || e.message, where()));
  window.addEventListener('unhandledrejection', e => logProblem('promise', e.reason, where()));
}
