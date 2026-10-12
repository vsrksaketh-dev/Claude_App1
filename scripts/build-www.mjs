// Copies the web app into www/ so Capacitor can bundle it. Only runtime files go in; docs, tests and the brief rules stay out.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
for (const p of ['index.html', 'manifest.webmanifest', 'css', 'js', 'data', 'icons']) cpSync(p, `www/${p}`, { recursive: true });
console.log('www/ ready');
