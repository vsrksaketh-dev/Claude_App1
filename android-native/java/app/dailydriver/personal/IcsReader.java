package app.dailydriver.personal;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal iCalendar reader, a Java twin of js/ics.js: events, time zones, all-day events and the common recurrence rules.
 * The widgets use it to refresh the calendar on their own, without opening the app. Pure code, no Android classes, so it runs on the JVM in tests.
 * tests/widgets compares its output with the JavaScript reader on the same files; keep the two in step.
 */
final class IcsReader {
    private IcsReader() { }

    static final class Inst {
        String uid = "", title = "", where = "", desc = "";
        boolean allDay;
        long start, end;
    }

    private static final Map<String, String> WIN_TZ = new HashMap<>();
    static {
        WIN_TZ.put("India Standard Time", "Asia/Kolkata"); WIN_TZ.put("UTC", "UTC"); WIN_TZ.put("Greenwich Standard Time", "UTC");
        WIN_TZ.put("Eastern Standard Time", "America/New_York"); WIN_TZ.put("Pacific Standard Time", "America/Los_Angeles"); WIN_TZ.put("GMT Standard Time", "Europe/London");
    }
    private static final String[] DOWS = { "SU", "MO", "TU", "WE", "TH", "FR", "SA" };
    private static final Pattern VALUE = Pattern.compile("^(\\d{4})(\\d{2})(\\d{2})(?:T(\\d{2})(\\d{2})(\\d{2})(Z)?)?$");
    private static final Pattern DURATION = Pattern.compile("^([+-])?P(?:(\\d+)W)?(?:(\\d+)D)?(?:T(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?)?$");
    private static final Pattern BYDAY = Pattern.compile("^([+-]?\\d+)?([A-Z]{2})$");
    private static final Pattern SPLIT_PARAMS = Pattern.compile(";(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");

    // ---------- lines ----------
    static String[] unfold(String text) { return text.replaceAll("\\r?\\n[ \\t]", "").split("\\r?\\n"); }

    private static String unescape(String s) {
        return s.replaceAll("(?i)\\\\n", "\n").replaceAll("\\\\([,;\\\\])", "$1");
    }

    private static final class Line { String name, value; Map<String, String> params = new HashMap<>(); }

    private static Line parseLine(String line) {
        boolean q = false;
        int i = -1;
        for (int k = 0; k < line.length(); k++) {
            char ch = line.charAt(k);
            if (ch == '"') q = !q; else if (ch == ':' && !q) { i = k; break; }
        }
        if (i < 0) return null;
        String[] parts = SPLIT_PARAMS.split(line.substring(0, i), -1);
        Line l = new Line();
        l.name = parts[0].toUpperCase();
        l.value = line.substring(i + 1);
        for (int p = 1; p < parts.length; p++) {
            int eq = parts[p].indexOf('=');
            String k = eq < 0 ? parts[p] : parts[p].substring(0, eq);
            String v = eq < 0 ? "" : parts[p].substring(eq + 1);
            if (!k.isEmpty()) l.params.put(k.toUpperCase(), v.replaceAll("^\"|\"$", ""));
        }
        return l;
    }

    // ---------- time ----------
    private static final class P { boolean allDay; int y, mo, d, h, mi, s; String tz; }

    private static boolean knownZone(String id) {
        for (String z : TimeZone.getAvailableIDs()) if (z.equals(id)) return true;
        return false;
    }

    private static long zonedToMs(int y, int mo, int d, int h, int mi, int s, String tz) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone(tz));
        c.clear();
        c.set(y, mo - 1, d, h, mi, s);
        return c.getTimeInMillis();
    }

    private static long localMs(int y, int mo, int d, int h, int mi, int s) {
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(y, mo - 1, d, h, mi, s);
        return c.getTimeInMillis();
    }

    private static P parseValue(String value, Map<String, String> params) {
        Matcher m = VALUE.matcher(value);
        if (!m.matches()) return null;
        P p = new P();
        p.y = Integer.parseInt(m.group(1)); p.mo = Integer.parseInt(m.group(2)); p.d = Integer.parseInt(m.group(3));
        if (m.group(4) == null) { p.allDay = true; return p; }
        p.h = Integer.parseInt(m.group(4)); p.mi = Integer.parseInt(m.group(5)); p.s = Integer.parseInt(m.group(6));
        String tz = m.group(7) != null ? "UTC" : (params.containsKey("TZID") ? (WIN_TZ.containsKey(params.get("TZID")) ? WIN_TZ.get(params.get("TZID")) : params.get("TZID")) : null);
        if (tz != null && !knownZone(tz)) tz = null;
        p.tz = tz;
        return p;
    }

    private static long toMs(P p) {
        if (p.allDay) return localMs(p.y, p.mo, p.d, 0, 0, 0);
        if (p.tz != null) return zonedToMs(p.y, p.mo, p.d, p.h, p.mi, p.s, p.tz);
        return localMs(p.y, p.mo, p.d, p.h, p.mi, p.s);
    }

    private static long parseDuration(String v) {
        Matcher m = DURATION.matcher(v);
        if (!m.matches()) return 0;
        long ms = n(m.group(2)) * 7 * 86400000L + n(m.group(3)) * 86400000L + n(m.group(4)) * 3600000L + n(m.group(5)) * 60000L + n(m.group(6)) * 1000L;
        return "-".equals(m.group(1)) ? -ms : ms;
    }

    private static long n(String s) { return s == null ? 0 : Long.parseLong(s); }

    private static long dayNum(int y, int m, int d) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(y, m - 1, d);
        return Math.floorDiv(c.getTimeInMillis(), 86400000L);
    }

    private static final class Civil { int y, m, d, dow; }

    private static Civil civil(long dn) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.setTimeInMillis(dn * 86400000L);
        Civil o = new Civil();
        o.y = c.get(Calendar.YEAR); o.m = c.get(Calendar.MONTH) + 1; o.d = c.get(Calendar.DAY_OF_MONTH); o.dow = c.get(Calendar.DAY_OF_WEEK) - 1;
        return o;
    }

    private static int daysIn(int y, int m) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.clear();
        c.set(y, m - 1, 1);
        return c.getActualMaximum(Calendar.DAY_OF_MONTH);
    }

    // ---------- recurrence ----------
    private static final class By { int n, dow; }

    private static final class Rule {
        String freq = "", until = "";
        int interval = 1, count;
        List<By> byday = new ArrayList<>();
        List<Integer> bymonthday = new ArrayList<>(), bymonth = new ArrayList<>();
    }

    private static Rule parseRule(String v) {
        Map<String, String> r = new HashMap<>();
        for (String kv : v.split(";")) {
            int eq = kv.indexOf('=');
            if (eq > 0) r.put(kv.substring(0, eq).toUpperCase(), kv.substring(eq + 1));
        }
        Rule o = new Rule();
        o.freq = r.containsKey("FREQ") ? r.get("FREQ") : "";
        try { o.interval = Math.max(1, Integer.parseInt(r.get("INTERVAL"))); } catch (Exception e) { o.interval = 1; }
        try { o.count = r.containsKey("COUNT") ? Integer.parseInt(r.get("COUNT")) : 0; } catch (Exception e) { o.count = 0; }
        o.until = r.containsKey("UNTIL") ? r.get("UNTIL") : "";
        if (r.containsKey("BYDAY")) for (String t : r.get("BYDAY").split(",")) {
            Matcher m = BYDAY.matcher(t);
            if (!m.matches()) continue;
            By b = new By();
            b.n = m.group(1) == null ? 0 : Integer.parseInt(m.group(1).replace("+", ""));
            b.dow = java.util.Arrays.asList(DOWS).indexOf(m.group(2));
            o.byday.add(b);
        }
        if (r.containsKey("BYMONTHDAY")) for (String t : r.get("BYMONTHDAY").split(",")) { try { o.bymonthday.add(Integer.parseInt(t.trim())); } catch (Exception ignored) { } }
        if (r.containsKey("BYMONTH")) for (String t : r.get("BYMONTH").split(",")) { try { o.bymonth.add(Integer.parseInt(t.trim())); } catch (Exception ignored) { } }
        return o;
    }

    private static boolean nthMatch(List<By> byday, Civil c) {
        int nth = (int) Math.ceil(c.d / 7.0), fromEnd = (daysIn(c.y, c.m) - c.d) / 7 + 1;
        for (By b : byday) if (b.dow == c.dow && (b.n == 0 || b.n == nth || b.n == -fromEnd)) return true;
        return false;
    }

    private static long weekStartDn(long n) { return n - ((civil(n).dow + 6) % 7); }

    private static boolean ruleMatches(Rule r, long dn, long sdn, Civil sc) {
        Civil c = civil(dn);
        switch (r.freq) {
            case "DAILY": return (dn - sdn) % r.interval == 0;
            case "WEEKLY": {
                if (((weekStartDn(dn) - weekStartDn(sdn)) / 7) % r.interval != 0) return false;
                if (r.byday.isEmpty()) return sc.dow == c.dow;
                for (By b : r.byday) if (b.dow == c.dow) return true;
                return false;
            }
            case "MONTHLY": {
                if (((c.y - sc.y) * 12 + (c.m - sc.m)) % r.interval != 0) return false;
                if (!r.bymonthday.isEmpty()) {
                    for (int x : r.bymonthday) if (x == c.d || (x < 0 && daysIn(c.y, c.m) + x + 1 == c.d)) return true;
                    return false;
                }
                if (!r.byday.isEmpty()) return nthMatch(r.byday, c);
                return c.d == sc.d;
            }
            case "YEARLY": {
                if ((c.y - sc.y) % r.interval != 0) return false;
                boolean monthOk = r.bymonth.isEmpty() ? c.m == sc.m : r.bymonth.contains(c.m);
                if (!monthOk) return false;
                if (!r.bymonthday.isEmpty()) return r.bymonthday.contains(c.d);
                if (!r.byday.isEmpty()) return nthMatch(r.byday, c);
                return c.d == sc.d;
            }
            default: return false;
        }
    }

    // ---------- parsing ----------
    private static final class Ev {
        String uid = "", title, where, desc;
        boolean cancelled;
        P start, end, recId;
        Long dur;
        Rule rule;
        List<Long> ex = new ArrayList<>();
    }

    private static List<Ev> readEvents(String text) {
        List<Ev> out = new ArrayList<>();
        Ev cur = null;
        int alarm = 0;
        for (String raw : unfold(text)) {
            Line l = parseLine(raw);
            if (l == null) continue;
            if (l.name.equals("BEGIN") && l.value.equals("VEVENT")) { cur = new Ev(); continue; }
            if (l.name.equals("BEGIN") && l.value.equals("VALARM")) { alarm++; continue; }
            if (l.name.equals("END") && l.value.equals("VALARM")) { alarm--; continue; }
            if (l.name.equals("END") && l.value.equals("VEVENT")) { if (cur != null && cur.start != null) out.add(cur); cur = null; continue; }
            if (cur == null || alarm != 0) continue;
            switch (l.name) {
                case "UID": cur.uid = l.value; break;
                case "SUMMARY": cur.title = unescape(l.value); break;
                case "LOCATION": cur.where = unescape(l.value); break;
                case "DESCRIPTION": { String d = unescape(l.value); cur.desc = d.length() > 300 ? d.substring(0, 300) : d; break; }
                case "STATUS": cur.cancelled = l.value.equalsIgnoreCase("CANCELLED"); break;
                case "DTSTART": cur.start = parseValue(l.value, l.params); break;
                case "DTEND": cur.end = parseValue(l.value, l.params); break;
                case "DURATION": cur.dur = parseDuration(l.value); break;
                case "RRULE": cur.rule = parseRule(l.value); break;
                case "EXDATE": for (String v : l.value.split(",")) { P p = parseValue(v, l.params); if (p != null) cur.ex.add(toMs(p)); } break;
                case "RECURRENCE-ID": cur.recId = parseValue(l.value, l.params); break;
                default: break;
            }
        }
        return out;
    }

    /** Every event instance that falls in [winStart, winEnd), sorted by start then title. */
    static List<Inst> parse(String text, long winStart, long winEnd) {
        List<Ev> events = readEvents(text);
        List<Inst> out = new ArrayList<>();
        Set<String> overrides = new HashSet<>();
        for (Ev e : events) if (e.recId != null) overrides.add(e.uid + "|" + toMs(e.recId));

        for (Ev e : events) {
            if (e.cancelled) continue;
            long s0 = toMs(e.start), dur;
            if (e.end != null) dur = Math.max(0, toMs(e.end) - s0);
            else if (e.dur != null) dur = e.dur;
            else dur = e.start.allDay ? 86400000L : 0;
            if (e.rule == null || e.recId != null) { push(out, e, s0, s0 + dur, winStart, winEnd); continue; }
            P sc = e.start;
            long dn0 = dayNum(sc.y, sc.mo, sc.d);
            Civil c0 = civil(dn0);
            Calendar we = Calendar.getInstance(), ws = Calendar.getInstance();
            we.setTimeInMillis(winEnd); ws.setTimeInMillis(winStart);
            long limitDn = dayNum(we.get(Calendar.YEAR), we.get(Calendar.MONTH) + 1, we.get(Calendar.DAY_OF_MONTH)) + 2;
            long lowDn = dayNum(ws.get(Calendar.YEAR), ws.get(Calendar.MONTH) + 1, ws.get(Calendar.DAY_OF_MONTH)) - 3;
            P untilP = e.rule.until.isEmpty() ? null : parseValue(e.rule.until, new HashMap<String, String>());
            long untilMs = untilP == null ? 0 : (untilP.allDay ? toMs(untilP) + 86400000L - 1 : toMs(untilP));
            int count = 0;
            for (long dn = dn0; dn <= limitDn; dn++) {
                if (!ruleMatches(e.rule, dn, dn0, c0)) continue;
                count++;
                if (e.rule.count > 0 && count > e.rule.count) break;
                if (dn < lowDn) continue;
                Civil c = civil(dn);
                long startMs = sc.allDay ? localMs(c.y, c.m, c.d, 0, 0, 0)
                    : sc.tz != null ? zonedToMs(c.y, c.m, c.d, sc.h, sc.mi, sc.s, sc.tz) : localMs(c.y, c.m, c.d, sc.h, sc.mi, sc.s);
                if (untilMs != 0 && startMs > untilMs) break;
                if (e.ex.contains(startMs) || overrides.contains(e.uid + "|" + startMs)) continue;
                push(out, e, startMs, startMs + dur, winStart, winEnd);
            }
        }
        Collections.sort(out, new Comparator<Inst>() {
            @Override public int compare(Inst a, Inst b) {
                int d = Long.compare(a.start, b.start);
                return d != 0 ? d : a.title.compareTo(b.title);
            }
        });
        return out;
    }

    private static void push(List<Inst> out, Ev e, long startMs, long endMs, long winStart, long winEnd) {
        if (endMs <= winStart && !(endMs == startMs && startMs >= winStart)) return;
        if (startMs >= winEnd) return;
        Inst i = new Inst();
        i.uid = e.uid == null ? "" : e.uid;
        i.title = e.title == null || e.title.isEmpty() ? "(No title)" : e.title;
        i.where = e.where == null ? "" : e.where;
        i.desc = e.desc == null ? "" : e.desc;
        i.allDay = e.start.allDay;
        i.start = startMs;
        i.end = endMs;
        out.add(i);
    }
}
