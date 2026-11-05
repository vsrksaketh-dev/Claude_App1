// Bridge to the Android wrapper (Capacitor). Everything here is a no-op in a normal browser.
const cap = () => window.Capacitor;
export const isNative = () => !!cap()?.isNativePlatform?.();
// The app has no bundler, so it cannot import @capacitor/core. Inside the Android shell, window.Capacitor.Plugins already
// holds a proxy for every installed plugin; registerPlugin only exists when the core script was bundled, so it is a fallback.
const plugin = name => {
  const c = cap();
  const p = c?.Plugins?.[name] || (typeof c?.registerPlugin === 'function' ? c.registerPlugin(name) : null);
  if (!p) throw new Error(`The Android feature "${name}" is not available in this build.`);
  return p;
};

// Save the backup as a file. In the app, open the Android share sheet (Drive, email, WhatsApp, Files...).
export async function saveBackup(name, text) {
  if (!isNative()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; a.click();
    return true;
  }
  const file = await plugin('Filesystem').writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
  await plugin('Share').share({ title: 'Daily Driver backup', url: file.uri, dialogTitle: 'Save your backup' });
  return true;
}

// Automatic backups: one file a day in the app's private storage on the phone (not in the browser storage, so they survive
// the web view's data being cleared), the last seven kept. Restoring one is in Settings.
const BK = 'backups';
export async function autoBackup(name, text, keep = 7) {
  if (!isNative()) return false;
  const fs = plugin('Filesystem');
  try { await fs.mkdir({ path: BK, directory: 'DATA', recursive: true }); } catch { /* already there */ }
  await fs.writeFile({ path: `${BK}/${name}`, data: text, directory: 'DATA', encoding: 'utf8' });
  const names = await listAutoBackups();
  for (const old of names.slice(keep)) { try { await fs.deleteFile({ path: `${BK}/${old}`, directory: 'DATA' }); } catch { /* gone */ } }
  return true;
}
export async function listAutoBackups() {
  if (!isNative()) return [];
  try { const r = await plugin('Filesystem').readdir({ path: BK, directory: 'DATA' }); return (r.files || []).map(f => typeof f === 'string' ? f : f.name).filter(n => /^dd-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse(); } catch { return []; }
}
export async function readAutoBackup(name) { const r = await plugin('Filesystem').readFile({ path: `${BK}/${name}`, directory: 'DATA', encoding: 'utf8' }); return typeof r.data === 'string' ? r.data : String(r.data); }

// Plain GET that works for calendar links. Browsers block these (no CORS), the Android app's native HTTP does not.
export async function httpGetText(url) {
  if (isNative()) {
    const r = await plugin('CapacitorHttp').get({ url, responseType: 'text', headers: { Accept: 'text/calendar, text/plain, */*' } });
    if (r.status >= 400) throw new Error(`The calendar link answered HTTP ${r.status}. Check the address.`);
    return typeof r.data === 'string' ? r.data : String(r.data);
  }
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`The calendar link answered HTTP ${r.status}. Check the address.`);
  return r.text();
}

// Local notifications (Android app only). Pending ones are replaced wholesale on every schedule call.
export async function notifyPermission() {
  if (!isNative()) return false;
  const n = plugin('LocalNotifications');
  let p = await n.checkPermissions();
  if (p.display !== 'granted') p = await n.requestPermissions();
  return p.display === 'granted';
}
export async function scheduleAll(list) {
  if (!isNative()) return;
  const n = plugin('LocalNotifications');
  const pending = await n.getPending();
  if (pending.notifications.length) await n.cancel({ notifications: pending.notifications.map(x => ({ id: x.id })) });
  if (list.length) await n.schedule({ notifications: list });
}

// A notification a few seconds from now, so the phone's notification and battery settings can be checked on the spot.
export async function notifyTest() {
  if (!isNative()) return false;
  const n = plugin('LocalNotifications');
  if (!(await notifyPermission())) return false;
  await n.schedule({ notifications: [{ id: 9, title: 'Daily Driver', body: 'This is how your nudges will look.', schedule: { at: new Date(Date.now() + 4000), allowWhileIdle: true } }] });
  return true;
}

// Hands the widget snapshot to the native side, which stores it and redraws the home-screen widgets.
export async function widgetPush(json, ics) {
  if (!isNative()) return;
  try { await plugin('WidgetBridge').update({ json, ics }); } catch { /* widgets not available in this build */ }
}

// What the home-screen widgets queued while the app was closed (ticked tasks, habits) and which tab was tapped.
export async function widgetTake() {
  if (!isNative()) return { ops: [], target: '' };
  try { const r = await plugin('WidgetBridge').take(); return { ops: JSON.parse(r.ops || '[]'), target: r.target || '' }; } catch { return { ops: [], target: '' }; }
}

// Hardware back button: go to Today first, then leave the app.
export function initBackButton(isHome, goHome) {
  if (!isNative()) return;
  plugin('App').addListener('backButton', () => { if (isHome()) plugin('App').exitApp(); else goHome(); });
}
