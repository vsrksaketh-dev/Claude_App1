// Links found in an event or task (a class's meeting link, a case study's document, the email it came from), shown as small buttons.
// Kinds: meet (Zoom, Teams, Google Meet), doc (Drive, Docs, PDFs), form, mail (Gmail), link. Mirrored natively in CalendarSync.java.
const URL_RE = /https?:\/\/[^\s<>"'\]\)]+/gi;
const KIND = [
  ['meet', /zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|webex\.com|whereby\.com|gotomeet|bluejeans/i],
  ['form', /forms\.gle|forms\.office\.com|docs\.google\.com\/forms|joinsuperset\.com|app\.joinsuperset/i],
  ['mail', /mail\.google\.com/i],
  ['doc', /docs\.google\.com|drive\.google\.com|sheets\.google|slides\.google|sharepoint\.com|onedrive|1drv\.ms|dropbox\.com|notion\.so|canva\.com|\.pdf(\?|#|$)|\.docx?(\?|#|$)|\.pptx?(\?|#|$)|\.xlsx?(\?|#|$)/i],
];
export const LABEL = { meet: 'Join', doc: 'Open', form: 'Form', mail: 'Mail', link: 'Link' };
const RANK = { meet: 0, doc: 1, form: 2, mail: 3, link: 4 };
export const linkKind = u => (KIND.find(([, re]) => re.test(u)) || ['link'])[0];
export const stripLinks = t => String(t || '').replace(URL_RE, '').replace(/\s{2,}/g, ' ').replace(/\s*[:·-]\s*$/, '').trim();
export function extractLinks(text, max = 3) {
  const seen = new Set(), out = [];
  (String(text || '').match(URL_RE) || []).forEach(raw => {
    const url = raw.replace(/[.,;:!?]+$/, '');
    if (seen.has(url)) return;
    seen.add(url); out.push({ url, kind: linkKind(url) });
  });
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind]).slice(0, max);
}
