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

// Hands the widget snapshot to the native side, which stores it and redraws the home-screen widgets.
export async function widgetPush(json) {
  if (!isNative()) return;
  try { await plugin('WidgetBridge').update({ json }); } catch { /* widgets not available in this build */ }
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
