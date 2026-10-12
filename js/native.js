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

// Hardware back button: go to Today first, then leave the app.
export function initBackButton(isHome, goHome) {
  if (!isNative()) return;
  plugin('App').addListener('backButton', () => { if (isHome()) plugin('App').exitApp(); else goHome(); });
}
