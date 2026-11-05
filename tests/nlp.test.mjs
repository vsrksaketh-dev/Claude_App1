import { parseQuick } from '../js/nlp.js';
const now = new Date(2026, 10, 5, 11, 20); // Thu 5 Nov 2026
const cases = [
 ['Submit DHRM fri 5pm !', { title: 'Submit DHRM', due: '2026-11-06', time: '17:00', important: true }],
 ['Call mom tomorrow at 7', { title: 'Call mom', due: '2026-11-06', time: '19:00' }],
 ['Gym every monday 6:30am', { title: 'Gym', due: '2026-11-09', time: '06:30', repeat: 'weekly' }],
 ['Pay rent 1 dec', { title: 'Pay rent', due: '2026-12-01' }],
 ['Read case today', { title: 'Read case', due: '2026-11-05' }],
 ['Quiz prep in 3 days', { title: 'Quiz prep', due: '2026-11-08' }],
 ['Water plants daily', { title: 'Water plants', due: '2026-11-05', repeat: 'daily' }],
 ['Buy 2 notebooks', { title: 'Buy 2 notebooks', due: '' }],
 ['Submit 13/11 by noon', { title: 'Submit', due: '2026-11-13', time: '12:00' }],
 ['Meet Ravi next mon', { title: 'Meet Ravi', due: '2026-11-16' }],
 ['Revise thu', { title: 'Revise', due: '2026-11-05' }],
 ['Pitch nov 20 at 3:15 pm', { title: 'Pitch', due: '2026-11-20', time: '15:15' }],
];
let f = 0;
for (const [inp, exp] of cases) { const r = parseQuick(inp, now); const bad = Object.entries(exp).filter(([k, v]) => r[k] !== v); if (bad.length) { f++; console.log('FAIL', inp, JSON.stringify(r)); } else console.log('PASS', inp); }
console.log(f ? f + ' failed' : 'all passed');
