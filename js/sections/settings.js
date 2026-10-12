import { S, register } from '../core.js';
import { today, esc } from '../util.js';
import { field } from '../ui.js';
import { exportJSON, importJSON, reset, flush, SCHEMA } from '../store.js';

const MODULES = [['career', 'Career and placement', 'Applications, network, STAR stories. Switch off once you are placed.'], ['money', 'Money', 'Budget ledger and subscription renewals.']];

function view() {
  return `<div class="card"><h2>Profile</h2><form data-form="profile" class="inline">${field('Your name', 'name', `value="${esc(S.profile.name)}"`)}${field('Roll number', 'roll', `value="${esc(S.profile.roll)}"`)}<button>Save</button></form>
    <p class="muted">Name appears in the greeting. Name and roll number are used for CV file names.</p></div>
  <div class="card"><h2>Modules</h2><ul class="list">${MODULES.map(([k, l, d]) => `<li><label class="check"><input type="checkbox" data-act="module" data-id="${k}" ${S.modules[k] ? 'checked' : ''}> <span><b>${l}</b><div class="muted">${d}</div></span></label></li>`).join('')}</ul>
    <p class="muted">Turning a module off hides it and its reminders. Your data stays and comes back if you turn it on again.</p></div>
  <div class="card"><h2>Your data</h2><p class="muted">Everything lives on this device. Last backup: ${S.meta.lastBackup || 'never'}.</p>
    <div class="row"><button class="primary" data-act="export">Export backup</button><button data-act="import">Import backup</button><button class="danger" data-act="wipe">Erase everything</button></div></div>
  <p class="muted">Daily Driver · data format v${SCHEMA}</p>`;
}

register({
  id: 'settings', label: 'Settings', section: true, order: 9, render: view,
  actions: {
    module: d => { S.modules[d.id] = !S.modules[d.id]; },
    export: () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
      a.download = `daily-driver-${today()}.json`; a.click();
      S.meta.lastBackup = today();
    },
    import: () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json';
      i.onchange = async () => { try { importJSON(await i.files[0].text()); location.reload(); } catch { alert('That file is not a valid backup.'); } };
      i.click();
    },
    wipe: () => { if (confirm('Erase all data on this device? Export a backup first.')) { reset(); location.reload(); } },
  },
  forms: { profile: f => { S.profile.name = f.name.trim(); S.profile.roll = f.roll.trim(); } },
});
