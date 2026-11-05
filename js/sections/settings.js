// Settings: appearance, habits, profile, calendar, reminders, widgets and backup. Opened from the button on Home.
import { S, ui, register, commit, byId, remove } from '../core.js';
import { today, esc, uid } from '../util.js';
import { field, chip, head } from '../ui.js';
import { exportJSON, importJSON, reset, SCHEMA } from '../store.js';
import { saveBackup, isNative, notifyPermission, notifyTest, listAutoBackups, readAutoBackup } from '../native.js';
import { refreshReminders } from '../reminders-run.js';
import { pushNow } from '../widgets.js';
import { getSources, addSource, removeSource, syncAll, getHidden, setHidden } from '../calendar.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const THEMES = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Match phone']];

function render() {
  return `${head('Settings', '', '<button class="pill" data-nav="home">Done</button>')}
  <div class="card"><h2>Appearance</h2><div class="seg" role="group" aria-label="Theme">${THEMES.map(([k, l]) => `<button class="${(S.theme || 'system') === k ? 'on' : ''}" data-act="theme" data-id="${k}">${l}</button>`).join('')}</div>
    <label class="check" style="margin-top:14px"><input type="checkbox" data-act="glass" ${S.glass === false ? '' : 'checked'}> <span><b>Frosted glass</b><div class="muted">Translucent panes over a soft colour wash. Turn it off for solid panes if the app ever feels slow.</div></span></label></div>

  <div class="card"><h2>Habits</h2><p class="muted">Weekly goals like the gym five times a week, counters like eight glasses of water, workout types and nudges all live in Routine.</p><div class="row" style="margin-top:10px"><button class="primary" data-nav="routine">Open Routine</button></div></div>

  <div class="card"><h2>Profile</h2><form data-form="profile" class="inline">${field('Your name', 'name', `value="${esc(S.profile.name)}"`)}${field('Roll number', 'roll', `value="${esc(S.profile.roll)}"`)}${field('Starting at (optional)', 'company', `value="${esc(S.profile.company)}" placeholder="e.g. Deloitte"`)}${field('Start date (optional)', 'joining', `type="date" value="${esc(S.profile.joining)}"`)}<button>Save</button></form>
    <p class="muted">Your name appears in the greeting. A start date adds a countdown to Home.</p></div>

  <div class="card"><h2>Google Calendar</h2>
    ${getSources().length ? `<ul class="list">${getSources().map(s => `<li><div class="grow"><span class="title">${esc(s.name)}</span><div class="muted">${s.error ? esc(s.error) : s.at ? `${s.count} events synced ${Math.max(0, Math.round((Date.now() - s.at) / 6e4))} min ago` : 'Not synced yet'}</div></div><button class="ghost danger" data-act="calRemove" data-id="${s.id}">Remove</button></li>`).join('')}</ul><div class="row" style="margin-top:10px"><button data-act="calSync">Sync now</button></div>` : '<p class="muted">Not connected yet.</p>'}
    <form data-form="calAdd" class="inline">${field('Name', 'name', 'placeholder="Personal, College..."')}${field('Secret iCal address', 'url', 'type="url" required placeholder="https://calendar.google.com/calendar/ical/..."')}<button class="primary">Connect</button></form>
    <form data-form="calHide" class="inline">${field('Hide events containing', 'words', `value="${esc(getHidden())}" placeholder="not mine, optional"`)}<button>Save</button></form>
    <p class="muted">Comma separated. Matches the title, description or location, so shared or copied entries stay out of your day.</p>
    <details><summary>How to find the address</summary><ol><li>Open Google Calendar in a browser (calendar.google.com).</li><li>Settings (the gear), then under "Settings for my calendars" pick the calendar.</li><li>Choose "Integrate calendar" and copy "Secret address in iCal format".</li></ol>
      <p class="muted">Repeat for each calendar, for example your college account. Anyone with this address can read that calendar, so keep it private. It stays on this phone only and is left out of backups. You can reset it in the same Google Calendar screen.</p>
      <p class="muted">Tip: an event titled "Action: ..." or "Due: ..." shows up under "Needs your attention" on Home.</p></details></div>

  <div class="card"><h2>Nudges</h2>${isNative() ? '' : '<p class="muted">Nudges work in the Android app. This is the browser version, so they will not fire here.</p>'}
    <form data-form="reminders"><label class="check"><input type="checkbox" name="on" ${S.reminders.on ? 'checked' : ''}> <span><b>Turn nudges on</b><div class="muted">Short, kind notifications: your day in the morning, a wrap-up at night, and a gentle hello if you have been away.</div></span></label>
      <div class="inline">${field('Morning briefing', 'morning', `type="time" value="${S.reminders.morning}"`)}${field('Evening wrap-up', 'evening', `type="time" value="${S.reminders.evening}"`)}</div>
      <label class="check"><input type="checkbox" name="briefing" ${S.reminders.briefing !== false ? 'checked' : ''}> Morning briefing with your classes and tasks</label>
      <label class="check"><input type="checkbox" name="wrap" ${S.reminders.wrap !== false ? 'checked' : ''}> Evening wrap-up with what is next</label>
      <label class="check"><input type="checkbox" name="comeback" ${S.reminders.comeback !== false ? 'checked' : ''}> A gentle hello if I have been away for two or five days</label>
      <label class="check"><input type="checkbox" name="taskTimes" ${S.reminders.taskTimes !== false ? 'checked' : ''}> Task reminders at the time I set on a task</label>
      <label class="check"><input type="checkbox" name="habits" ${S.reminders.habits !== false ? 'checked' : ''}> Habit nudges at the times I set in Routine</label>
      <label class="check"><input type="checkbox" name="weekly" ${S.reminders.weekly !== false ? 'checked' : ''}> Weekly review on Sunday evening</label>
      <label class="check"><input type="checkbox" name="backup" ${S.reminders.backup !== false ? 'checked' : ''}> Remind me to back up when it has been a while</label>
      <label class="check"><input type="checkbox" name="deadlines" ${S.reminders.deadlines ? 'checked' : ''}> Deadlines: the day before, the day of, and 3 hours before an application closes</label>
      <label class="check"><input type="checkbox" name="events" ${S.reminders.events ? 'checked' : ''}> Calendar events: 15 minutes before</label>
      <div class="row"><button class="primary">Save nudges</button>${isNative() ? '<button type="button" data-act="nudgeTest">Send a test nudge</button>' : ''}</div></form>
    ${isNative() ? '<p class="muted">If a test nudge does not arrive, allow notifications for Daily Driver in Android settings, and set its battery to Unrestricted.</p>' : ''}</div>

  <div class="card"><h2>Home screen widgets</h2>${isNative() ? '' : '<p class="muted">Widgets are part of the Android app. This is the browser version.</p>'}
    <p>Touch and hold an empty spot on your home screen, tap Widgets, then find Daily Driver. There are eleven: Overview, Schedule, Tasks, News, Calendar, Habits, Next up, Quick add, Problem of the day and Deadlines, Notes.</p>
    <p class="muted">The News widget fetches fresh stories, and the calendar widgets re-read your Google calendars, by themselves about every half hour. For that, your private calendar addresses are also kept in this app's private storage on the phone (never uploaded anywhere else). Tasks and habits show what the app last sent, so open the app now and then. Tap any widget to open the app.</p>
    <p class="muted">If widgets stop refreshing, allow background activity: Android settings, Apps, Daily Driver, Battery, then Unrestricted (on OnePlus also allow Auto-launch).</p>
    <div class="row" style="margin-top:10px"><button data-act="widgetsNow">Update widgets now</button></div></div>

  ${isNative() ? `<div class="card"><h2>Automatic backups</h2><p class="muted">Once a day the app keeps a copy of everything in its private storage on this phone; the last seven are kept. Last one: ${esc(S.meta.autoAt || 'not yet')}.</p>
    ${ui.sub.autoList ? (ui.sub.autoList.length ? `<ul class="list">${ui.sub.autoList.map(n => `<li><span class="grow title">${esc(n.slice(3, 13))}</span><button class="ghost" data-act="autoRestore" data-id="${esc(n)}">${ui.sub.autoConfirm === n ? 'Tap again to restore' : 'Restore'}</button></li>`).join('')}</ul><p class="muted">Restoring replaces what is on the phone now with that day's copy.</p>` : '<p class="muted">No automatic backups yet.</p>') : '<div class="row"><button data-act="autoShow">Show backups</button></div>'}</div>` : ''}

  <div class="card"><h2>Your data</h2><p class="muted">Everything lives on this device. Last backup: ${S.meta.lastBackup || 'never'}.</p>
    <div class="row" style="margin-top:10px"><button class="primary" data-act="export">Export backup</button><button data-act="import">Import backup</button><button class="danger" data-act="wipe">Erase everything</button></div></div>
  <p class="muted" style="text-align:center">Daily Driver · data format v${SCHEMA}</p>`;
}

register({
  id: 'settings', label: 'Settings', render,
  actions: {
    theme: d => { S.theme = d.id; },
    widgetsNow: () => { pushNow(); },
    nudgeTest: () => { notifyTest().then(ok => alert(ok ? 'A test nudge will arrive in a few seconds.' : 'Notifications are blocked. Allow them for Daily Driver in Android settings.')); },
    glass: () => { S.glass = S.glass === false; },
    calSync: () => { syncAll(true).then(() => commit()); },
    calRemove: d => { removeSource(d.id); refreshReminders(); },
    export: () => {
      saveBackup(`daily-driver-${today()}.json`, exportJSON())
        .then(() => { S.meta.lastBackup = today(); commit(); })
        .catch(() => alert('Could not export the backup.'));
    },
    autoShow: () => { listAutoBackups().then(l => { ui.sub.autoList = l; commit(); }); },
    autoRestore: d => { if (ui.sub.autoConfirm !== d.id) { ui.sub.autoConfirm = d.id; return; } readAutoBackup(d.id).then(t => { importJSON(t); location.reload(); }).catch(() => alert('That backup could not be read.')); },
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
    profile: f => { S.profile.name = f.name.trim(); S.profile.roll = f.roll.trim(); S.profile.company = (f.company || '').trim(); S.profile.joining = f.joining || ''; },
    reminders: f => {
      S.reminders = { on: !!f.on, morning: f.morning || '07:30', evening: f.evening || '21:00', briefing: !!f.briefing, wrap: !!f.wrap, comeback: !!f.comeback, weekly: !!f.weekly, habits: !!f.habits, taskTimes: !!f.taskTimes, backup: !!f.backup, deadlines: !!f.deadlines, cards: false, events: !!f.events };
      if (S.reminders.on && isNative()) notifyPermission().then(ok => { if (!ok) alert('Notifications are blocked. Allow them for Daily Driver in Android settings.'); });
      refreshReminders();
    },
  },
});
