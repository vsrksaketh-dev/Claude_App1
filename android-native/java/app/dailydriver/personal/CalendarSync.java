package app.dailydriver.personal;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps the calendar in the widgets fresh without opening the app. The app hands over the private iCal addresses (they stay in
 * this app's own private storage on the phone); each time the system refreshes a widget this downloads them, reads them with
 * IcsReader, and swaps the calendar part of the stored snapshot. Items that are not from a calendar (typed events, tasks) are untouched.
 * Mirrors js/calendar.js and js/agenda.js (kinds, hidden words, "needs you" list); keep them in step.
 */
final class CalendarSync {
    private CalendarSync() { }

    static final int BACK = 14, FWD = 75, MAX = 900;
    private static final String DOT = "·";
    private static final Pattern ACTION = Pattern.compile("^(action|due|deadline)\\s*[:" + DOT + "-]\\s*", Pattern.CASE_INSENSITIVE);
    private static final Pattern DUE = Pattern.compile("^(due|deadline)\\s*[:" + DOT + "-]", Pattern.CASE_INSENSITIVE);
    private static final Pattern ACT = Pattern.compile("^action\\s*[:" + DOT + "-]", Pattern.CASE_INSENSITIVE);
    private static final Pattern MAIL = Pattern.compile("^mail\\s*[:" + DOT + "-]\\s*", Pattern.CASE_INSENSITIVE);
    private static final Pattern ANY = Pattern.compile("^(action|due|deadline|mail)\\s*[:" + DOT + "-]\\s*", Pattern.CASE_INSENSITIVE);

    static String kindOf(String title) {
        if (DUE.matcher(title).find()) return "due";
        if (ACT.matcher(title).find()) return "action";
        if (MAIL.matcher(title).find()) return "mail";
        return "event";
    }

    static String stripKind(String title) { return ANY.matcher(title).replaceFirst(""); }

    static String actionKey(String title, long start) { return "cal|" + title + "|" + start; }

    /** Downloads every calendar and rebuilds the calendar part of the snapshot. True when something changed. Call off the main thread. */
    static boolean refresh(Context c, boolean force) {
        SharedPreferences p = Widgets.prefs(c);
        String raw = p.getString("ics", "");
        if (raw.isEmpty()) return false;
        long now = System.currentTimeMillis();
        long last;
        try { last = Long.parseLong(p.getString("icsAt", "0")); } catch (Exception e) { last = 0; }
        if (!force && now - last < 8 * 60000L) return false;       // several widgets update at once: one download is enough
        p.edit().putString("icsAt", String.valueOf(now)).apply();
        try {
            JSONObject cfg = new JSONObject(raw);
            JSONArray sources = cfg.optJSONArray("sources");
            if (sources == null || sources.length() == 0) return false;
            long winStart = Widgets.cal(Widgets.dayKey(-BACK)).getTimeInMillis();
            long winEnd = Widgets.cal(Widgets.plusDays(Widgets.dayKey(0), FWD + 1)).getTimeInMillis();
            List<IcsReader.Inst> all = new ArrayList<>();
            for (int i = 0; i < sources.length(); i++) {
                JSONObject src = sources.optJSONObject(i);
                String text = src == null ? null : download(src.optString("url"));
                if (text == null || !text.contains("BEGIN:VCALENDAR")) return false;   // keep what we have rather than show a half calendar
                all.addAll(IcsReader.parse(text, winStart, winEnd));
            }
            return apply(c, all, cfg.optString("hidden", ""), now);
        } catch (Exception e) {
            return false;
        }
    }

    private static String download(String url) {
        if (url == null || !url.startsWith("https://")) return null;
        HttpURLConnection h = null;
        try {
            h = (HttpURLConnection) new URL(url).openConnection();
            h.setConnectTimeout(6000);
            h.setReadTimeout(8000);
            h.setRequestProperty("Accept", "text/calendar, text/plain, */*");
            if (h.getResponseCode() != 200) return null;
            InputStream in = h.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > 6000000) return null;
            }
            return new String(buf.toByteArray(), "UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (h != null) h.disconnect();
        }
    }

    private static boolean visible(IcsReader.Inst e, List<String> words) {
        if (words.isEmpty()) return true;
        String hay = (e.title + " " + e.desc + " " + e.where).toLowerCase(Locale.ENGLISH);
        for (String w : words) if (hay.contains(w)) return false;
        return true;
    }

    /** Swaps the calendar-derived entries and the "needs you" list in the stored snapshot. Separate from refresh() so tests need no network. */
    static boolean apply(Context c, List<IcsReader.Inst> parsed, String hidden, long now) throws Exception {
        List<String> words = new ArrayList<>();
        for (String w : hidden.split(",")) { String t = w.trim().toLowerCase(Locale.ENGLISH); if (!t.isEmpty()) words.add(t); }
        List<IcsReader.Inst> list = new ArrayList<>();
        for (IcsReader.Inst e : parsed) if (visible(e, words)) list.add(e);

        synchronized (Widgets.class) {
            JSONObject s = Widgets.load(c);
            if (s.length() == 0) return false;
            JSONArray old = Widgets.arr(s, "cal");
            Set<String> doneKeys = new HashSet<>();
            List<JSONObject> keep = new ArrayList<>();
            for (int i = 0; i < old.length(); i++) {
                JSONObject x = old.optJSONObject(i);
                if (x == null) continue;
                if (x.optInt("o") == 1) { if (x.optInt("x") == 1 && !x.optString("id").isEmpty()) doneKeys.add(x.optString("id")); }
                else keep.add(x);
            }
            int days = BACK + FWD + 1;
            String[] keys = new String[days];
            long[] from = new long[days], to = new long[days];
            for (int i = 0; i < days; i++) {
                keys[i] = Widgets.dayKey(i - BACK);
                from[i] = Widgets.cal(keys[i]).getTimeInMillis();
                to[i] = Widgets.cal(Widgets.plusDays(keys[i], 1)).getTimeInMillis();
            }
            List<JSONObject> fresh = new ArrayList<>();
            for (IcsReader.Inst e : list) {
                String kind = kindOf(e.title);
                String id = "event".equals(kind) ? "" : actionKey(e.title, e.start);
                for (int i = 0; i < days; i++) {
                    boolean on = (e.end > from[i] && e.start < to[i]) || (e.end == e.start && e.start >= from[i] && e.start < to[i]);
                    if (!on) continue;
                    fresh.add(new JSONObject().put("d", keys[i]).put("s", e.start).put("e", e.end)
                        .put("t", "event".equals(kind) ? e.title : stripKind(e.title)).put("w", e.where).put("a", e.allDay ? 1 : 0)
                        .put("k", kind).put("id", id).put("x", doneKeys.contains(id) ? 1 : 0).put("dv", 0).put("o", 1));
                }
            }
            List<JSONObject> merged = new ArrayList<>(fresh);
            merged.addAll(keep);
            Collections.sort(merged, new Comparator<JSONObject>() {
                @Override public int compare(JSONObject a, JSONObject b) {
                    int d = a.optString("d").compareTo(b.optString("d"));
                    if (d != 0) return d;
                    d = b.optInt("a") - a.optInt("a");
                    return d != 0 ? d : Long.compare(a.optLong("s"), b.optLong("s"));
                }
            });
            JSONArray cal = new JSONArray();
            for (int i = 0; i < merged.size() && i < MAX; i++) cal.put(merged.get(i));

            JSONArray actions = needsYou(list, doneKeys, now);
            boolean changed = !cal.toString().equals(old.toString()) || !actions.toString().equals(Widgets.arr(s, "actions").toString());
            s.put("cal", cal);
            s.put("actions", actions);
            s.put("calAt", now);
            Widgets.save(c, s.toString());
            return changed;
        }
    }

    /** The "Needs you" list: deadlines and to-dos in the next week, then email facts from the last week. Same rules as pendingActions() in js/schedule.js. */
    private static JSONArray needsYou(List<IcsReader.Inst> list, Set<String> doneKeys, long now) throws Exception {
        long lim = now + 7 * 86400000L;
        List<IcsReader.Inst> dated = new ArrayList<>(), mail = new ArrayList<>();
        for (IcsReader.Inst e : list) {
            if (ACTION.matcher(e.title).find() && e.end >= now && e.start < lim) dated.add(e);
            else if (MAIL.matcher(e.title).find() && e.start >= now - 7 * 86400000L && e.start < now + 86400000L) mail.add(e);
        }
        Collections.sort(dated, new Comparator<IcsReader.Inst>() { @Override public int compare(IcsReader.Inst a, IcsReader.Inst b) { return Long.compare(a.start, b.start); } });
        Collections.sort(mail, new Comparator<IcsReader.Inst>() { @Override public int compare(IcsReader.Inst a, IcsReader.Inst b) { return Long.compare(b.start, a.start); } });
        JSONArray out = new JSONArray();
        for (IcsReader.Inst e : dated) {
            String key = actionKey(e.title, e.start);
            boolean alive = e.allDay ? e.end > now : now < e.start + 15 * 60000L;
            if (doneKeys.contains(key) || !alive || out.length() >= 12) continue;
            out.put(new JSONObject().put("id", key).put("title", ACTION.matcher(e.title).replaceFirst("")).put("s", e.start).put("mail", false));
        }
        for (IcsReader.Inst e : mail) {
            String key = actionKey(e.title, e.start);
            if (doneKeys.contains(key) || out.length() >= 12) continue;
            out.put(new JSONObject().put("id", key).put("title", MAIL.matcher(e.title).replaceFirst("")).put("s", e.start).put("mail", true));
        }
        return out;
    }
}
