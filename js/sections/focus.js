import { S, ui, app, register, render, $ } from '../core.js';
import { today, lastDays, fmtClock, fmtDay, esc } from '../util.js';
import { bar, barChart, chip } from '../ui.js';
import { focusOn, focusOver } from '../logic.js';
import { save } from '../store.js';

const remaining = () => S.timer.running ? Math.max(0, Math.ceil((S.timer.endsAt - Date.now()) / 1000)) : S.timer.remaining;

function ask() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* unsupported */ } }

function complete() {
  const t = S.timer;
  if (t.mode === 'focus') {
    S.focus[today()] = focusOn(today()) + t.len;
    const tag = t.tag || 'Untagged';
    const d = (S.focusTags[today()] ||= {}); d[tag] = (d[tag] || 0) + t.len;
    t.mode = 'break'; t.remaining = 5 * 60;
  } else { t.mode = 'focus'; t.remaining = t.len * 60; }
  t.running = false; t.endsAt = null; save();
  try { navigator.vibrate?.(300); if ('Notification' in window && Notification.permission === 'granted') new Notification(t.mode === 'break' ? 'Focus session done. Take 5.' : 'Break over. Back to work.'); } catch { /* ignore */ }
  render();
}
setInterval(() => {
  if (!S.timer.running) return;
  const r = remaining();
  if (r <= 0) return complete();
  const el = $('#timer');
  if (el) { el.textContent = fmtClock(r); const b = $('#timerbar'); if (b && S.timer.mode === 'focus') b.style.width = (1 - r / (S.timer.len * 60)) * 100 + '%'; }
}, 500);

export function focusView() {
  const tm = S.timer, r = remaining(), total = tm.len * 60;
  const tags = {};
  lastDays(30).forEach(k => Object.entries(S.focusTags[k] || {}).forEach(([g, m]) => { tags[g] = (tags[g] || 0) + m; }));
  const tagList = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  const known = [...new Set([...S.goals.filter(g => g.status === 'active').map(g => g.title), ...tagList.map(x => x[0])])].filter(x => x !== 'Untagged');
  const pts = lastDays(14).map(k => ({ label: fmtDay(k), value: focusOn(k), title: `${fmtDay(k)}: ${focusOn(k)} min` }));
  return `<div class="card"><h2>${tm.mode === 'focus' ? 'Deep work' : 'Break'}</h2><div class="timer" id="timer">${fmtClock(r)}</div>
    <div class="bar"><i id="timerbar" style="width:${tm.mode === 'focus' ? (1 - r / total) * 100 : 0}%"></i></div>
    <label style="margin-top:10px">What are you working on?<input data-bind="timerTag" list="focus-tags" value="${esc(tm.tag)}" placeholder="A goal, subject or skill"><datalist id="focus-tags">${known.map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
    <div class="row" style="margin-top:12px;justify-content:center">${tm.running ? '<button class="primary" data-act="timerPause">Pause</button>' : '<button class="primary" data-act="timerStart">Start</button>'}<button data-act="timerReset">Reset</button></div>
    <div class="row" style="justify-content:center;margin-top:8px">${[25, 50, 90].map(m => `<button class="${tm.len === m ? 'primary' : 'ghost'}" data-act="timerLen" data-id="${m}">${m} min</button>`).join('')}</div>
    <p class="muted">While a focus session runs, the app dims navigation. A web app cannot silence other apps, so turn on Do Not Disturb on your phone.</p></div>
  <div class="card"><h2>Focus hours</h2><p>Today <b>${focusOn(today())} min</b> · last 7 days <b>${(focusOver(7) / 60).toFixed(1)} h</b> · last 30 days <b>${(focusOver(30) / 60).toFixed(1)} h</b></p>${barChart(pts, { unit: ' min', summary: 'Focus minutes per day, last 14 days' })}</div>
  ${tagList.length ? `<div class="card"><h2>Where the time went (30 days)</h2><ul class="list">${tagList.map(([g, m]) => `<li><span class="grow">${esc(g)}</span>${chip((m / 60).toFixed(1) + ' h')}</li>`).join('')}</ul></div>` : ''}`;
}

register({
  id: 'focus', label: 'Focus', section: true,
  actions: {
    timerStart: () => { const t = S.timer; t.endsAt = Date.now() + t.remaining * 1000; t.running = true; ask(); },
    timerPause: () => { const t = S.timer; t.remaining = remaining(); t.running = false; t.endsAt = null; },
    timerReset: () => { const t = S.timer; t.mode = 'focus'; t.running = false; t.endsAt = null; t.remaining = t.len * 60; },
    timerLen: d => { const t = S.timer; t.len = Number(d.id); t.mode = 'focus'; t.running = false; t.endsAt = null; t.remaining = t.len * 60; },
  },
  inputs: { timerTag: el => { S.timer.tag = el.value; } },
});
