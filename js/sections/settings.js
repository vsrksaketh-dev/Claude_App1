import { S, register, commit } from '../core.js';
import { saveBackup, isNative, notifyPermission } from '../native.js';
import { refreshReminders } from '../reminders-run.js';
import { getSources, addSource, removeSource, syncAll, getHidden, setHidden } from '../calendar.js';
import { today, esc } from '../util.js';
import { field } from '../ui.js';
import { exportJSON, importJSON, reset, flush, SCHEMA } from '../store.js';

const MODULES = [['career', 'Career and placement', 'Applications, network, STAR stories. Switch off once you are placed.'], ['money', 'Money', 'Budget ledger and subscription renewals.']];

function view() {
  return `<div class="card"><h2>Profile</h2><form data-form="profile" class="inline">${field('Your name', 'name', `value="${esc(S.profile.name)}"`)}${field('Roll number', 'roll', `value="${esc(S.profile.roll)}"`)}<button>Save</button></form>
    <p class="muted">Name appears in the greeting. Name and roll number are used for CV file names.</p></div>
  <div class="card"><h2>Modules</h2><ul class="list">${MODULES.map(([k, l, d]) => `<li><label class="check"><input type="checkbox" data-act="module" data-id="${k}" ${S.modules[k] ? 'checked' : ''}> <span><b>${l}</b><div class="muted">${d}</div></span></label></li>`).join('')}</ul>
    <p class="muted">Turning a module off hides it and its reminders. Your data stays and comes back if you turn it on again.</p></div>
  <div class="card"><h2>Google Calendar</h2>
    ${getSources().length ? `<ul class="list">${getSources().map(s => `<li><div class="grow"><span class="title">${esc(s.name)}</span><div class="muted">${s.error ? esc(s.error) : s.at ? `${s.count} events synced ${Math.max(0, Math.round((Date.now() - s.at) / 6e4))} min ago` : 'Not synced yet'}</div></div><button class="ghost danger" data-act="calRemove" data-id="${s.id}">Remove</button></li>`).join('')}</ul><div class="row"><button data-act="calSync">Sync now</button></div>` : '<p class="muted">Not connected yet.</p>'}
    <form data-form="calAdd" class="inline">${field('Name', 'name', 'placeholder="Personal, College..."')}${field('Secret iCal address', 'url', 'type="url" required placeholder="https://calendar.google.com/calendar/ical/..."')}<button class="primary">Connect</button></form>
    <form data-form="calHide" class="inline">${field('Hide events containing', 'words', `value="${esc(getHidden())}" placeholder="not mine, optional"`)}<button>Save</button></form>
    <p class="muted">Comma separated. Matches the title, description or location, so shared or copied entries stay out of your day.</p>
    <details><summary>How to find the address</summary><ol><li>Open Google Calendar in a browser (calendar.google.com).</li><li>Settings (gear), then under "Settings for my calendars" pick the calendar.</li><li>Choose "Integrate calendar" and copy "Secret address in iCal format".</li></ol>
      <p class="muted">Repeat for each calendar, for example your college account. Anyone with this address can read that calendar, so keep it private. The address stays on this phone only and is left out of backups. You can reset it in the same Google Calendar screen.</p>
      <p class="muted">The app re-reads it when you open it and every few minutes while open. Google can take a little while to publish a change to this address.</p></details></div>
  <div class="card"><h2>Reminders</h2>${isNative() ? '' : '<p class="muted">Reminders work in the Android app. This is the browser version, so they will not fire here.</p>'}
    <form data-form="reminders"><label class="check"><input type="checkbox" name="on" ${S.reminders.on ? 'checked' : ''}> Turn reminders on</label>
      <div class="inline">${field('Morning plan', 'morning', `type="time" value="${S.reminders.morning}"`)}${field('Evening reflection', 'evening', `type="time" value="${S.reminders.evening}"`)}</div>
      <label class="check"><input type="checkbox" name="deadlines" ${S.reminders.deadlines ? 'checked' : ''}> Deadlines: the day before, the day of, and 3 hours before an application closes</label>
      <label class="check"><input type="checkbox" name="events" ${S.reminders.events ? 'checked' : ''}> Calendar events: 15 minutes before</label>
      <label class="check"><input type="checkbox" name="cards" ${S.reminders.cards ? 'checked' : ''}> Flashcards due, at 6 PM</label>
      <button class="primary">Save reminders</button></form></div>
  <div class="card"><h2>Your data</h2><p class="muted">Everything lives on this device. Last backup: ${S.meta.lastBackup || 'never'}.</p>
    <div class="row"><button class="primary" data-act="export">Export backup</button><button data-act="import">Import backup</button><button class="danger" data-act="wipe">Erase everything</button></div></div>
  <p class="muted">Daily Driver · data format v${SCHEMA}</p>`;
}

register({
  id: 'settings', label: 'Settings', section: true, order: 9, render: view,
  actions: {
    module: d => { S.modules[d.id] = !S.modules[d.id]; },
    calSync: () => { syncAll(true).then(() => commit()); },
    calRemove: d => { removeSource(d.id); refreshReminders(); },
    export: () => {
      saveBackup(`daily-driver-${today()}.json`, exportJSON())
        .then(() => { S.meta.lastBackup = today(); commit(); })
        .catch(() => alert('Could not export the backup.'));
    },
    import: () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json';
      i.onchange = async () => { try { importJSON(await i.files[0].text()); location.reload(); } catch { alert('That file is not a valid backup.'); } };
      i.click();
    },
    wipe: () => { if (confirm('Erase all data on this device? Export a backup first.')) { reset(); location.reload(); } },
  },
  forms: {
    calHide: f => { setHidden(f.words); },
    calAdd: f => {
      try { addSource(f.name, f.url); } catch (e) { alert(e.message); return; }
      syncAll(true).then(() => commit());
    },
    profile: f => { S.profile.name = f.name.trim(); S.profile.roll = f.roll.trim(); },
    reminders: f => {
      S.reminders = { on: !!f.on, morning: f.morning || '07:30', evening: f.evening || '21:00', deadlines: !!f.deadlines, cards: !!f.cards, events: !!f.events };
      if (S.reminders.on && isNative()) notifyPermission().then(ok => { if (!ok) alert('Notifications are blocked. Allow them for Daily Driver in Android settings.'); });
      refreshReminders();
    },
  },
});
