import assert from 'node:assert/strict';
import { parseFeed, summarise, pick } from '../scripts/news.mjs';
const rss = `<rss><channel><item><title><![CDATA[Rates held steady &amp; markets rise]]></title><link>https://ex.com/a</link><description><![CDATA[<p>The central bank kept rates. Markets rose 1%. Third sentence here.</p><img src=x>]]></description><pubDate>Sat, 14 Nov 2026 03:00:00 GMT</pubDate></item>
<item><title>Bad link</title><link>nope</link></item></channel></rss>`;
const atom = `<feed><entry><title>Atom story</title><link href="https://ex.com/b"/><summary>One. Two.</summary><updated>2026-11-14T02:00:00Z</updated></entry></feed>`;
const a = parseFeed(rss), b = parseFeed(atom);
assert.equal(a.length, 1); assert.equal(a[0].title, 'Rates held steady & markets rise'); assert.equal(a[0].link, 'https://ex.com/a');
assert.equal(summarise(a[0].desc, a[0].title), 'The central bank kept rates. Markets rose 1%.');
assert.equal(b[0].link, 'https://ex.com/b'); assert.equal(summarise('Same title', 'Same title'), '');
const now = Date.parse('2026-11-14T06:00:00Z');
const e = (title, src, h) => ({ title, src, link: 'https://x/' + title, desc: '', when: now - h * 3600e3 });
const got = pick([e('Court rules on big merger deal', 'A', 1), e('Big merger deal ruled by court', 'B', 2), e('Old news', 'A', 90), e('Other story today', 'B', 3)], now);
assert.deepEqual(got.map(x => x.title).sort(), ['Court rules on big merger deal', 'Other story today']);
console.log('news tests passed');
