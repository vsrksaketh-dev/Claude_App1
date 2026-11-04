// Prints what the JavaScript ICS reader finds in a file, as JSON, for the Java reader to be compared against.
// Usage: TZ=Asia/Kolkata node ics-expected.mjs <file.ics> <winStartMs> <winEndMs>
import { readFileSync } from 'node:fs';
import { parseICS } from '../../js/ics.js';
const [file, a, b] = process.argv.slice(2);
const r = parseICS(readFileSync(file, 'utf8'), Number(a), Number(b));
console.log(JSON.stringify(r.events.map(e => [e.start, e.end, e.title, e.where, e.allDay ? 1 : 0, e.desc])));
