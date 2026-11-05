// Classes & exams: end-term countdowns with a revision checklist per paper and a daily target, and attendance per course from the
// classes on your calendar (mark each past class attended or missed; a course below the minimum is flagged). Not a tab: opened from
// Home and from the Calendar.
import { S, ui, app, register } from '../core.js';
import { today, addDays, esc, uid, fmtDay } from '../util.js';
import { head, empty, check, toast } from '../ui.js';
import { icon } from '../icons.js';
import { agendaOn } from '../agenda.js';
import { colorFor, isClass } from '../colors.js';
import { upcomingExams, examDays, topicsLeft, dailyTarget, courseStats, attendKey, attendOf, minAttend } from '../study.js';

const clock = ms => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();
export const attendBtns = e => { const a = attendOf(e), k = esc(attendKey(e)); return `<span class="attend" role="group" aria-label="Attendance"><button class="${a === 'y' ? 'on y' : ''}" data-act="attendMark" data-k="${k}" data-v="y" aria-pressed="${a === 'y'}">Attended</button><button class="${a === 'n' ? 'on n' : ''}" data-act="attendMark" data-k="${k}" data-v="n" aria-pressed="${a === 'n'}">Missed</button></span>`; };

function examRow(x) {
  const n = examDays(x), tl = x.topics || [], done = tl.filter(t => t.d).length;
  return `<div class="exam ${n <= 3 ? 'soon' : ''}" data-menu="exam:${esc(x.id)}"><div class="cd"><b>${n === 0 ? 'Today' : n}</b>${n ? `<small>day${n === 1 ? '' : 's'}</small>` : ''}</div>
    <div><button class="sr-item" data-act="examOpen" data-id="${esc(x.id)}"><span class="title">${esc(x.subject)}</span><span class="muted">${esc(fmtDay(x.date))}${x.time ? ' · ' + esc(x.time) : ''}${x.where ? ' · ' + esc(x.where) : ''}</span></button>
      ${tl.length ? `<div class="muted">${done} of ${tl.length} topics revised</div><div class="meter"><i style="width:${Math.round(100 * done / tl.length)}%"></i></div>` : `<button class="ghost" data-act="examOpen" data-id="${esc(x.id)}">${icon('plus', 15)} Add revision topics</button>`}</div></div>`;
}

function render() {
  const ex = upcomingExams(), tgt = dailyTarget(), cs = courseStats(), min = minAttend();
  const recent = [];
  for (let i = 0; i >= -6; i--) agendaOn(addDays(today(), i)).filter(e => isClass(e) && e.start < Date.now() && !attendOf(e)).forEach(e => recent.push(e));
  return `${head('Classes & exams', ex.length ? `${ex.length} exam${ex.length === 1 ? '' : 's'} ahead` : 'Attendance and revision', '<button class="pill" data-nav="home">Home</button>')}
  ${tgt.left ? `<div class="banner">${icon('school', 20)}<div class="grow"><b>Revise ${tgt.perDay} topic${tgt.perDay === 1 ? '' : 's'} today</b><div class="muted">${tgt.left} left across your papers; this pace finishes each one before its exam.</div></div></div>` : ''}
  <section class="card"><h2>Exams</h2>${ex.length ? ex.map(examRow).join('') : empty('No exams yet. Add your end-term papers below.')}
    <form data-form="examAdd" class="inline" style="margin-top:12px"><label>Paper<input name="subject" required placeholder="DHRM end-term"></label><label>Date<input name="date" type="date" required value="${addDays(today(), 7)}"></label><label>Time<input name="time" type="time"></label><label>Room<input name="where" placeholder="CR 1"></label><button class="primary">Add exam</button></form></section>
  ${recent.length ? `<section class="card"><h2>Mark attendance</h2><ul class="list">${recent.slice(0, 12).map(e => `<li style="--c:${colorFor(e)}"><span class="cbar"></span><div class="grow"><span class="title">${esc(e.title)}</span><div class="muted">${esc(fmtDay(new Date(e.start).toLocaleDateString('en-CA')))} · ${clock(e.start)}</div></div>${attendBtns(e)}</li>`).join('')}</ul></section>` : ''}
  <section class="card"><h2>Attendance by course</h2>${cs.length ? cs.map(c => `<div class="course" style="--c:${c.color}"><span class="bar"></span><div><span class="title">${esc(c.name)}</span><div class="muted">${c.y} attended · ${c.n} missed${c.unmarked ? ` · ${c.unmarked} not marked` : ''}</div>${c.pct !== null ? `<div class="meter ${c.pct < min ? 'low' : ''}"><i style="width:${c.pct}%"></i></div>` : ''}</div><span class="pct ${c.pct !== null && c.pct < min ? 'low' : ''}">${c.pct === null ? '–' : c.pct + '%'}</span></div>`).join('') : empty('Classes from your calendar show up here once they have happened.')}
    <form data-form="minAttend" class="row" style="margin-top:12px;align-items:center"><span class="muted">Flag a course below</span><input name="min" type="number" min="50" max="100" value="${min}" style="width:80px">%<button>Save</button></form></section>`;
}

app.sheets.exam = s => {
  const x = S.exams.find(e => e.id === s.id); if (!x) return '';
  return `<h2>${esc(x.subject)}</h2><form data-form="examSave" data-id="${esc(x.id)}" class="inline"><label>Paper<input name="subject" value="${esc(x.subject)}" required></label><label>Date<input name="date" type="date" value="${esc(x.date)}" required></label><label>Time<input name="time" type="time" value="${esc(x.time || '')}"></label><label>Room<input name="where" value="${esc(x.where || '')}"></label><button class="primary">Save</button></form>
  <div class="subs"><h3 class="group-h">Revision topics</h3>${(x.topics || []).length ? `<ul class="list">${x.topics.map(t => `<li class="${t.d ? 'done' : ''}">${check('topicTick', t.id, t.d, `data-exam="${esc(x.id)}"`)}<span class="grow title">${esc(t.x)}</span><button class="ghost danger x" data-act="topicDel" data-exam="${esc(x.id)}" data-id="${esc(t.id)}" aria-label="Remove">${icon('close', 15)}</button></li>`).join('')}</ul>` : ''}
    <form data-form="topicAdd" data-id="${esc(x.id)}" data-keep class="capture"><input name="x" placeholder="Add a topic, like Unit 3: rewards" required maxlength="120"><button class="primary">Add</button></form></div>
  <div class="row sheet-foot"><button class="ghost danger" data-act="examDel" data-id="${esc(x.id)}">${icon('trash', 16)} Delete exam</button></div>`;
};
app.menus.exam = id => { const x = S.exams.find(e => e.id === id); if (!x) return []; const m = [{ label: 'Open', icon: icon('edit', 19), act: 'examOpen', data: { id } }, { label: 'Delete', icon: icon('trash', 19), act: 'examDel', data: { id }, danger: true }]; m.title = esc(x.subject); return m; };

register({
  id: 'academics', label: 'Classes & exams', render,
  actions: {
    attendMark: d => { if (S.attend[d.k] === d.v) delete S.attend[d.k]; else S.attend[d.k] = d.v; },
    examOpen: d => { ui.sheet = { kind: 'exam', id: d.id }; },
    examDel: d => { const i = S.exams.findIndex(x => x.id === d.id); if (i < 0) return; const [x] = S.exams.splice(i, 1); ui.sheet = null; toast(`Deleted ${x.subject}`, () => { S.exams.splice(i, 0, x); }); },
    topicTick: d => { const x = S.exams.find(e => e.id === d.exam), t = x && x.topics.find(y => y.id === d.id); if (t) t.d = !t.d; },
    topicDel: d => { const x = S.exams.find(e => e.id === d.exam); if (x) x.topics = x.topics.filter(y => y.id !== d.id); },
  },
  forms: {
    examAdd: f => { const sub = (f.subject || '').trim(); if (sub && f.date) S.exams.push({ id: uid(), subject: sub, date: f.date, time: f.time || '', where: (f.where || '').trim(), topics: [] }); },
    examSave: (f, form) => { const x = S.exams.find(e => e.id === form.dataset.id); if (x) Object.assign(x, { subject: (f.subject || x.subject).trim(), date: f.date || x.date, time: f.time || '', where: (f.where || '').trim() }); ui.sheet = null; },
    topicAdd: (f, form) => { const x = S.exams.find(e => e.id === form.dataset.id), t = (f.x || '').trim(); if (x && t) (x.topics ||= []).push({ id: uid(), x: t, d: false }); },
    minAttend: f => { S.study.minAttend = Math.max(50, Math.min(100, Number(f.min) || 75)); },
  },
});
