// Bridge to the Android wrapper (Capacitor). Everything here is a no-op in a normal browser.
const cap = () => window.Capacitor;
const cache = {};
export const isNative = () => !!cap()?.isNativePlatform?.();
const plugin = name => (cache[name] ||= cap().registerPlugin(name));

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

// Hardware back button: go to Today first, then leave the app.
export function initBackButton(isHome, goHome) {
  if (!isNative()) return;
  plugin('App').addListener('backButton', () => { if (isHome()) plugin('App').exitApp(); else goHome(); });
}
