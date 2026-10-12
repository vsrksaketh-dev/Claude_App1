import { S, register, commit } from '../core.js';
import { saveBackup, isNative, notifyPermission } from '../native.js';
import { refreshReminders } from '../reminders-run.js';
import { today, esc } from '../util.js';
import { field } from '../ui.js';
import { exportJSON, importJSON, reset, flush, SCHEMA } from '../store.js';

const MODULES = [['career', 'Career and placement', 'Applications, network, STAR stories. Switch off once you are placed.'], ['money', 'Money', 'Budget ledger and subscription renewals.']];

function view() {
  return `<div class="card"><h2>Profile</h2><form data-form="profile" class="inline">${field('Your name', 'name', `value="${esc(S.profile.name)}"`)}${field('Roll number', 'roll', `value="${esc(S.profile.roll)}"`)}<button>Save</button></form>
    <p class="muted">Name appears in the greeting. Name and roll number are used for CV file names.</p></div>
  <div class="card"><h2>Modules</h2><ul class="list">${MODULES.map(([k, l, d]) => `<li><label class="check"><input type="checkbox" data-act="module" data-id="${k}" ${S.modules[k] ? 'checked' : ''}> <span><b>${l}</b><div class="muted">${d}</div></span></label></li>`).join('')}</ul>
    <p class="muted">Turning a module off hides it and its reminders. Your data stays and comes back if you turn it on again.</p></div>
  <div class="card"><h2>Reminders</h2>${isNative() ? '' : '<p class="muted">Reminders work in the Android app. This is the browser version, so they will not fire here.</p>'}
    <form data-form="reminders"><label class="check"><input type="checkbox" name="on" ${S.reminders.on ? 'checked' : ''}> Turn reminders on</label>
      <div class="inline">${field('Morning plan', 'morning', `type="time" value="${S.reminders.morning}"`)}${field('Evening reflection', 'evening', `type="time" value="${S.reminders.evening}"`)}</div>
      <label class="check"><input type="checkbox" name="deadlines" ${S.reminders.deadlines ? 'checked' : ''}> Deadlines: the day before, the day of, and 3 hours before an application closes</label>
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
    profile: f => { S.profile.name = f.name.trim(); S.profile.roll = f.roll.trim(); },
    reminders: f => {
      S.reminders = { on: !!f.on, morning: f.morning || '07:30', evening: f.evening || '21:00', deadlines: !!f.deadlines, cards: !!f.cards };
      if (S.reminders.on && isNative()) notifyPermission().then(ok => { if (!ok) alert('Notifications are blocked. Allow them for Daily Driver in Android settings.'); });
      refreshReminders();
    },
  },
});
