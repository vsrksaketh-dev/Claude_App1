// Daily news without Claude: reads public RSS feeds and writes data/news.json in the shape the app expects.
// Public information only. Runs in GitHub Actions (.github/workflows/news.yml), no dependencies.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const FEEDS = {
  International: [
    ['BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
    ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
    ['The Guardian', 'https://www.theguardian.com/world/rss'],
  ],
  Indian: [
    ['The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss'],
    ['Indian Express', 'https://indianexpress.com/section/india/feed/'],
    ['Times of India', 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms'],
  ],
  Business: [
    ['Mint', 'https://www.livemint.com/rss/companies'],
    ['Economic Times', 'https://economictimes.indiatimes.com/rssfeedstopstories.cms'],
    ['Business Standard', 'https://www.business-standard.com/rss/home_page_top_stories.rss'],
  ],
  Tech: [
    ['TechCrunch', 'https://techcrunch.com/feed/'],
    ['The Verge', 'https://www.theverge.com/rss/index.xml'],
    ['Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index'],
  ],
};
const PER_CAT = 6, MAX_AGE_H = 48;

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘')
  .replace(/\s+/g, ' ').trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

// Works for RSS (<item>) and Atom (<entry>).
export function parseFeed(xml) {
  const out = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    const desc = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content'));
    const when = Date.parse(decode(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')));
    if (title && /^https?:\/\//.test(link)) out.push({ title, link, desc, when: Number.isNaN(when) ? 0 : when });
  }
  return out;
}

// Keep the first two sentences, never padding or guessing: the summary is only what the feed says.
export function summarise(desc, title) {
  let t = desc.replace(/\s*(The post|Read more|Continue reading|Image:|Photograph:).*$/i, '').trim();
  if (!t || t.toLowerCase() === title.toLowerCase()) return '';
  const s = t.match(/[^.!?]+[.!?]+(\s|$)/g);
  t = s ? s.slice(0, 2).join('').trim() : t;
  return t.length > 320 ? t.slice(0, 317).replace(/\s+\S*$/, '') + '...' : t;
}

const words = t => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
const similar = (a, b) => { const x = words(a), y = words(b); let n = 0; for (const w of x) if (y.has(w)) n++; return n / Math.max(1, Math.min(x.size, y.size)) > 0.6; };

export function pick(entries, now = Date.now()) {
  const fresh = entries.filter(e => !e.when || now - e.when < MAX_AGE_H * 3600e3).sort((a, b) => b.when - a.when);
  const chosen = [];
  for (const e of fresh) {
    if (chosen.some(c => similar(c.title, e.title))) continue; // same event from another outlet
    chosen.push(e);
  }
  // Interleave outlets so one source cannot fill the list.
  const bySrc = {};
  for (const e of chosen) (bySrc[e.src] ||= []).push(e);
  const out = [];
  while (out.length < PER_CAT && Object.values(bySrc).some(a => a.length)) {
    for (const k of Object.keys(bySrc)) { const e = bySrc[k].shift(); if (e && out.length < PER_CAT) out.push(e); }
  }
  return out;
}

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; DailyDriverNews/1.0)', accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

async function main() {
  const out = process.argv[2] || 'data/news.json';
  const items = [], failed = [];
  for (const [cat, feeds] of Object.entries(FEEDS)) {
    const entries = [];
    for (const [src, url] of feeds) {
      try { for (const e of parseFeed(await get(url))) entries.push({ ...e, src }); }
      catch (err) { failed.push(`${src}: ${err.message}`); }
    }
    for (const e of pick(entries)) items.push({ cat, title: e.title, summary: summarise(e.desc, e.title), why: '', src: e.src, url: e.link });
  }
  if (failed.length) console.log('Feeds that failed:\n  ' + failed.join('\n  '));
  if (items.length < 8) { console.error('Too few stories (' + items.length + '); keeping the previous news.json.'); process.exit(existsSync(out) ? 0 : 1); }
  const ist = new Date(Date.now() + 5.5 * 3600e3);
  const date = ist.toISOString().slice(0, 10);
  writeFileSync(out, JSON.stringify({ date, generated: ist.toISOString().slice(0, 19) + '+05:30', items }, null, 2) + '\n');
  console.log(`Wrote ${items.length} stories for ${date}`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
