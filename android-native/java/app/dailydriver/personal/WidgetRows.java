package app.dailydriver.personal;

import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The scrolling part of every widget. Each widget kind turns the last snapshot into a flat list of rows, and each row
 * becomes a RemoteViews for the widget's ListView. Taps on a row go through one pending-intent template (see Widgets.template)
 * and the "fill-in" intent built here says what was tapped: open a tab, tick something, flip a day, open a link.
 */
final class WidgetRows {
    static final int T_SECTION = 0, T_EVENT = 1, T_TASK = 2, T_HABIT = 3, T_NEWS = 4, T_NEXT = 5, T_PROGRESS = 6, T_STATS = 7, T_TEXT = 8, TYPES = 9;

    static class Row {
        final int type;
        JSONObject o;
        String a = "", b = "", due = "", style = "", act = "", id = "", target = "";
        boolean flag, done;
        Row(int type) { this.type = type; }
    }

    private WidgetRows() { }

    // ---------- building the list for a widget ----------
    static List<Row> build(Context c, int kind) {
        List<Row> out = new ArrayList<>();
        JSONObject s = Widgets.load(c);
        long now = System.currentTimeMillis();
        try {
            if (s.length() == 0) { text(out, "Open Daily Driver once and I will fill this in."); return out; }
            switch (kind) {
                case Widgets.OVERVIEW: overview(c, out, s, now); break;
                case Widgets.SCHEDULE: schedule(c, out, s, now); break;
                case Widgets.TASKS: tasks(c, out, s); break;
                case Widgets.NEWS: news(c, out, s); break;
                case Widgets.HABITS: habits(c, out, s); break;
                case Widgets.CALENDAR: calendar(c, out, s, now); break;
                default: everything(c, out, s, now);
            }
        } catch (Exception e) {
            out.clear();
            text(out, "Something went wrong drawing this widget. Open Daily Driver to refresh it.");
        }
        return out;
    }

    private static Row add(List<Row> out, int type) { Row r = new Row(type); out.add(r); return r; }

    private static void text(List<Row> out, String msg) { add(out, T_TEXT).a = msg; }

    private static void section(List<Row> out, String title, String target) { Row r = add(out, T_SECTION); r.a = title; r.target = target; }

    static boolean isSchedule(String k) { return "event".equals(k) || "due".equals(k) || "action".equals(k); }

    static List<JSONObject> itemsOn(JSONObject s, String day) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray a = Widgets.arr(s, "cal");
        for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e != null && day.equals(e.optString("d"))) out.add(e);
        }
        return out;
    }

    static JSONObject nextEvent(JSONObject s, long now) {
        JSONObject best = null;
        JSONArray a = Widgets.arr(s, "cal");
        for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e == null || e.optInt("a") == 1 || !isSchedule(e.optString("k")) || e.optLong("e") <= now) continue;
            if (best == null || e.optLong("s") < best.optLong("s")) best = e;
        }
        return best;
    }

    // ---------- shared pieces ----------
    private static void next(List<Row> out, JSONObject s, long now) {
        Row r = add(out, T_NEXT);
        r.o = nextEvent(s, now);
        r.target = r.o == null ? "calendar:agenda" : "calendar:day:" + r.o.optString("d");
    }

    private static void habitProgress(List<Row> out, JSONObject s) {
        JSONObject h = s.optJSONObject("habits");
        int total = h == null ? 0 : h.optInt("total"), done = h == null ? 0 : h.optInt("done");
        if (total == 0) return;
        Row r = add(out, T_PROGRESS);
        r.a = "Habits today";
        r.b = done + " of " + total;
        r.flag = false;
        r.o = new JSONObject();
        try { r.o.put("pct", done * 100 / total); } catch (Exception ignored) { }
        r.target = "track:trackers";
    }

    private static void stats(List<Row> out, JSONObject s) {
        Row r = add(out, T_STATS);
        r.o = s;
        r.target = "track:mind:focus";
    }

    private static void attention(List<Row> out, JSONObject s, int max) {
        JSONArray ac = Widgets.arr(s, "actions");
        boolean head = false;
        for (int i = 0; i < ac.length() && i < max; i++) {
            JSONObject m = ac.optJSONObject(i);
            if (m == null) continue;
            if (!head) { section(out, "Needs you", "home"); head = true; }
            Row r = add(out, T_TASK);
            r.a = m.optString("title");
            r.act = "act";
            r.id = m.optString("id");
            r.target = "home";
            if (m.optBoolean("mail")) r.due = "Mail";
            else {
                boolean today = Widgets.fmt("yyyy-MM-dd", m.optLong("s")).equals(Widgets.dayKey(0));
                r.due = today ? Widgets.fmt("h:mm a", m.optLong("s")) : Widgets.fmt("EEE", m.optLong("s"));
                r.style = today ? "bad" : "warn";
            }
        }
    }

    private static void habitRows(List<Row> out, JSONObject s, int max) {
        JSONArray hl = Widgets.arr(s, "habitList");
        boolean head = false;
        for (int i = 0; i < hl.length() && i < max; i++) {
            JSONObject h = hl.optJSONObject(i);
            if (h == null) continue;
            if (!head) { section(out, "Tap to tick off", "track:trackers"); head = true; }
            Row r = add(out, T_HABIT);
            r.a = h.optString("name");
            r.done = h.optBoolean("done");
            r.act = "habit";
            r.id = h.optString("id");
            r.target = "track:trackers";
        }
    }

    private static Row taskRow(List<Row> out, JSONObject x, boolean detail) {
        Row r = add(out, T_TASK);
        r.a = x.optString("title");
        String due = x.optString("due");
        r.due = due;
        r.style = due.equals("Overdue") || due.equals("Today") ? "bad" : due.equals("Tomorrow") ? "warn" : "";
        if (detail) {
            String q = x.optString("q"), kind = x.optString("kind");
            String ql = q.equals("UI") ? "Do first" : q.equals("I") ? "Important" : q.equals("U") ? "Quick" : "Later";
            r.b = kind.isEmpty() ? ql : kind + "  ·  " + ql;
        }
        r.act = "task";
        r.id = x.optString("id");
        r.target = "plan:tasks";
        return r;
    }

    private static void eventRow(List<Row> out, JSONObject e, boolean dim) {
        Row r = add(out, T_EVENT);
        r.o = e;
        r.done = dim;
        r.target = "calendar:day:" + e.optString("d");
    }

    private static void newsRows(List<Row> out, JSONObject s, String cat, int max) {
        JSONArray n = Widgets.arr(s, "news");
        int shown = 0;
        for (int i = 0; i < n.length() && shown < max; i++) {
            JSONObject x = n.optJSONObject(i);
            if (x == null || (!cat.isEmpty() && !cat.equals(x.optString("cat")))) continue;
            Row r = add(out, T_NEWS);
            r.o = x;
            r.target = "learn:news";
            shown++;
        }
    }

    // ---------- the widgets ----------
    private static void overview(Context c, List<Row> out, JSONObject s, long now) {
        next(out, s, now);
        habitProgress(out, s);
        stats(out, s);
        attention(out, s, 12);
        // The next few things on the plan
        JSONArray tk = Widgets.arr(s, "tasks");
        boolean head = false;
        for (int i = 0; i < tk.length() && i < 6; i++) {
            JSONObject x = tk.optJSONObject(i);
            if (x == null) continue;
            if (!head) { section(out, "Tasks", "plan:tasks"); head = true; }
            taskRow(out, x, false);
        }
        habitRows(out, s, 14);
    }

    private static void schedule(Context c, List<Row> out, JSONObject s, long now) {
        int day = Widgets.prefs(c).getInt("day", 0);
        String key = Widgets.dayKey(day);
        int shown = 0;
        for (JSONObject e : itemsOn(s, key)) {
            if (!isSchedule(e.optString("k"))) continue;
            if (day == 0 && e.optInt("a") == 0 && e.optLong("e") <= now) continue;
            eventRow(out, e, false);
            shown++;
        }
        if (shown == 0) text(out, day == 0 ? "Nothing left today. A free stretch is a good time to focus." : "Nothing planned. A clear day.");
    }

    private static void tasks(Context c, List<Row> out, JSONObject s) {
        String tf = Widgets.prefs(c).getString("tf", "all");
        JSONArray t = Widgets.arr(s, "tasks");
        String lastQ = null;
        int shown = 0;
        for (int i = 0; i < t.length(); i++) {
            JSONObject x = t.optJSONObject(i);
            if (x == null) continue;
            String due = x.optString("due");
            if (tf.equals("soon") && !(due.equals("Overdue") || due.equals("Today") || due.equals("Tomorrow"))) continue;
            String q = x.optString("q");
            if (!q.equals(lastQ)) {
                section(out, q.equals("UI") ? "Do first" : q.equals("I") ? "Schedule it" : q.equals("U") ? "Quick wins" : "Later", "plan:tasks");
                lastQ = q;
            }
            taskRow(out, x, true);
            shown++;
        }
        if (shown == 0) text(out, tf.equals("soon") ? "Nothing due soon. Nice." : "Nothing left to do. Enjoy the quiet.");
    }

    private static void news(Context c, List<Row> out, JSONObject s) {
        String cat = Widgets.prefs(c).getString("ncat", "");
        int before = out.size();
        newsRows(out, s, cat, 24);
        if (out.size() == before) text(out, "No headlines here yet. They land every morning.");
    }

    private static void habits(Context c, List<Row> out, JSONObject s) {
        habitProgress(out, s);
        JSONArray hl = Widgets.arr(s, "habitList");
        if (hl.length() == 0) { text(out, "No habits scheduled today."); return; }
        for (int i = 0; i < hl.length(); i++) {
            JSONObject h = hl.optJSONObject(i);
            if (h == null) continue;
            Row r = add(out, T_HABIT);
            r.a = h.optString("name");
            r.done = h.optBoolean("done");
            r.act = "habit";
            r.id = h.optString("id");
            r.target = "track:trackers";
        }
        stats(out, s);
    }

    private static void everything(Context c, List<Row> out, JSONObject s, long now) {
        next(out, s, now);
        stats(out, s);
        attention(out, s, 6);
        String today = Widgets.dayKey(0);
        boolean head = false;
        for (JSONObject e : itemsOn(s, today)) {
            if (!isSchedule(e.optString("k"))) continue;
            if (e.optInt("a") == 0 && e.optLong("e") <= now) continue;
            if (!head) { section(out, "Today's schedule", "calendar:day:" + today); head = true; }
            eventRow(out, e, false);
        }
        JSONArray tk = Widgets.arr(s, "tasks");
        head = false;
        for (int i = 0; i < tk.length() && i < 10; i++) {
            JSONObject x = tk.optJSONObject(i);
            if (x == null) continue;
            if (!head) { section(out, "Tasks", "plan:tasks"); head = true; }
            taskRow(out, x, false);
        }
        habitRows(out, s, 14);
        int before = out.size();
        newsRows(out, s, "", 6);
        if (out.size() > before) out.add(before, sectionRow("News", "learn:news"));
    }

    private static Row sectionRow(String title, String target) { Row r = new Row(T_SECTION); r.a = title; r.target = target; return r; }

    // ---------- calendar ----------
    private static String dayHeading(String key) {
        String today = Widgets.dayKey(0);
        long ms = Widgets.cal(key).getTimeInMillis();
        String base = Widgets.fmt("EEE d MMM", ms);
        int d = Widgets.dayDiff(today, key);
        return d == 0 ? "Today  ·  " + base : d == 1 ? "Tomorrow  ·  " + base : base;
    }

    private static void calItem(List<Row> out, JSONObject e) {
        String k = e.optString("k");
        boolean done = e.optInt("x") == 1;
        if ("event".equals(k)) { eventRow(out, e, done); return; }
        Row r = add(out, T_TASK);
        r.a = e.optString("t");
        r.done = done;
        r.act = "task".equals(k) ? "task" : "act";
        r.id = e.optString("id");
        r.target = "calendar:day:" + e.optString("d");
        if (e.optInt("a") == 0) r.b = Widgets.fmt("h:mm a", e.optLong("s")) + (e.optString("w").isEmpty() ? "" : "  ·  " + e.optString("w"));
        else if (!e.optString("w").isEmpty()) r.b = e.optString("w");
        r.due = "due".equals(k) ? "Due" : "action".equals(k) ? "To do" : "mail".equals(k) ? "Email" : "";
        r.style = "due".equals(k) ? "bad" : "action".equals(k) ? "warn" : "";
    }

    private static void calendar(Context c, List<Row> out, JSONObject s, long now) {
        String mode = Widgets.prefs(c).getString("cmode", "month");
        String sel = Widgets.prefs(c).getString("csel", Widgets.dayKey(0));
        String anchor = Widgets.prefs(c).getString("canchor", sel);
        if ("month".equals(mode)) {
            Row h = add(out, T_SECTION);
            h.a = dayHeading(sel);
            h.target = "calendar:day:" + sel;
            List<JSONObject> items = itemsOn(s, sel);
            if (items.isEmpty()) text(out, "Nothing planned.");
            for (JSONObject e : items) calItem(out, e);
        } else if ("week".equals(mode)) {
            String start = Widgets.weekStart(anchor);
            for (int i = 0; i < 7; i++) {
                String k = Widgets.plusDays(start, i);
                Row h = add(out, T_SECTION);
                h.a = dayHeading(k);
                h.id = k;
                h.act = "csel";
                List<JSONObject> items = itemsOn(s, k);
                if (items.isEmpty()) { Row t = add(out, T_TEXT); t.a = "Free"; t.target = "calendar:day:" + k; }
                for (JSONObject e : items) calItem(out, e);
            }
        } else {
            int shown = 0;
            for (int i = 0; i < 42; i++) {
                String k = Widgets.plusDays(anchor, i);
                List<JSONObject> items = itemsOn(s, k);
                if (items.isEmpty()) continue;
                Row h = add(out, T_SECTION);
                h.a = dayHeading(k);
                h.target = "calendar:day:" + k;
                for (JSONObject e : items) { calItem(out, e); shown++; }
            }
            if (shown == 0) text(out, "Nothing planned in the next six weeks.");
        }
    }

    /** The row index of the selected day's heading, so the week list can scroll to it. */
    static int headingIndex(List<Row> rows, String day) {
        for (int i = 0; i < rows.size(); i++) if (rows.get(i).type == T_SECTION && day.equals(rows.get(i).id)) return i;
        return 0;
    }

    // ---------- turning a row into a view ----------
    private static Intent fill(String type, String id, String target) {
        Intent i = new Intent();
        i.putExtra("type", type);
        i.putExtra("id", id == null ? "" : id);
        i.putExtra("target", target == null ? "" : target);
        return i;
    }

    static RemoteViews view(Context c, Row r) {
        switch (r.type) {
            case T_SECTION: return sectionView(c, r);
            case T_EVENT: return eventView(c, r);
            case T_TASK: return taskView(c, r);
            case T_HABIT: return habitView(c, r);
            case T_NEWS: return newsView(c, r);
            case T_NEXT: return nextView(c, r);
            case T_PROGRESS: return progressView(c, r);
            case T_STATS: return statsView(c, r);
            default: return textView(c, r);
        }
    }

    private static RemoteViews sectionView(Context c, Row r) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_section);
        v.setTextViewText(R.id.st, r.a);
        v.setOnClickFillInIntent(R.id.st, r.act.isEmpty() ? fill("open", "", r.target) : fill(r.act, r.id, ""));
        return v;
    }

    private static RemoteViews textView(Context c, Row r) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_text);
        v.setTextViewText(R.id.rt, r.a);
        v.setTextColor(R.id.rt, Widgets.color(c, R.color.dd_muted));
        v.setTextViewText(R.id.rm, "");
        v.setOnClickFillInIntent(R.id.txroot, fill("open", "", r.target.isEmpty() ? "home" : r.target));
        return v;
    }

    private static RemoteViews taskView(Context c, Row r) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_task);
        v.setTextViewText(R.id.tk, r.a);
        v.setTextColor(R.id.tk, Widgets.color(c, r.done ? R.color.dd_muted : R.color.dd_text));
        if (!r.b.isEmpty()) { v.setTextViewText(R.id.tk2, r.b); v.setViewVisibility(R.id.tk2, View.VISIBLE); }
        v.setImageViewResource(R.id.ring, r.done ? R.drawable.ring_done : R.drawable.ring);
        if (r.due.isEmpty()) v.setViewVisibility(R.id.due, View.GONE);
        else {
            v.setTextViewText(R.id.due, r.due);
            if ("bad".equals(r.style)) { v.setInt(R.id.due, "setBackgroundResource", R.drawable.pill_bad_bg); v.setTextColor(R.id.due, Widgets.color(c, R.color.dd_bad)); }
            else if ("warn".equals(r.style)) { v.setInt(R.id.due, "setBackgroundResource", R.drawable.pill_warn_bg); v.setTextColor(R.id.due, Widgets.color(c, R.color.dd_warn)); }
        }
        if (!r.act.isEmpty() && !r.id.isEmpty()) v.setOnClickFillInIntent(R.id.ring, fill(r.act, r.id, ""));
        v.setOnClickFillInIntent(R.id.rowroot, fill("open", "", r.target));
        return v;
    }

    private static RemoteViews habitView(Context c, Row r) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_habit);
        v.setTextViewText(R.id.hb, r.a);
        v.setTextColor(R.id.hb, Widgets.color(c, r.done ? R.color.dd_muted : R.color.dd_text));
        v.setTextViewText(R.id.hs, r.done ? "Done" : "");
        v.setImageViewResource(R.id.ring, r.done ? R.drawable.ring_done : R.drawable.ring);
        v.setOnClickFillInIntent(R.id.ring, fill("habit", r.id, ""));
        v.setOnClickFillInIntent(R.id.rowroot, fill("open", "", r.target));
        return v;
    }

    private static RemoteViews eventView(Context c, Row r) {
        JSONObject e = r.o;
        long now = System.currentTimeMillis();
        long s = e.optLong("s"), en = e.optLong("e");
        boolean all = e.optInt("a") == 1, live = !all && s <= now && en > now;
        String k = e.optString("k");
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_event);
        if (all) { v.setTextViewText(R.id.tm, "All day"); v.setTextViewText(R.id.tm2, ""); }
        else if (live) { v.setTextViewText(R.id.tm, "Now"); v.setTextViewText(R.id.tm2, "until " + Widgets.fmt("h:mm", en)); v.setTextColor(R.id.tm, Widgets.color(c, R.color.dd_accent)); }
        else { v.setTextViewText(R.id.tm, Widgets.fmt("h:mm", s)); v.setTextViewText(R.id.tm2, Widgets.fmt("a", s)); }
        v.setTextViewText(R.id.ev, e.optString("t"));
        v.setTextColor(R.id.ev, Widgets.color(c, r.done ? R.color.dd_muted : R.color.dd_text));
        String where = e.optString("w");
        String meta = all ? "" : Widgets.fmt("h:mm", s) + " to " + Widgets.fmt("h:mm a", en);
        if (!where.isEmpty()) meta = meta.isEmpty() ? where : meta + "  ·  " + where;
        if (meta.isEmpty()) v.setViewVisibility(R.id.ev2, View.GONE); else v.setTextViewText(R.id.ev2, meta);
        if (live) v.setInt(R.id.evroot, "setBackgroundResource", R.drawable.now_bg);
        v.setInt(R.id.bar, "setBackgroundResource", Widgets.barFor(k, all));
        v.setOnClickFillInIntent(R.id.evroot, fill("open", "", r.target));
        return v;
    }

    private static RemoteViews newsView(Context c, Row r) {
        JSONObject n = r.o;
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_news);
        v.setTextViewText(R.id.cat, (n.optString("cat") + (n.optString("src").isEmpty() ? "" : "  ·  " + n.optString("src"))).toUpperCase(Locale.ENGLISH));
        v.setTextViewText(R.id.nt, n.optString("title"));
        if (!n.optString("summary").isEmpty()) { v.setTextViewText(R.id.ns, n.optString("summary")); v.setInt(R.id.ns, "setMaxLines", 3); }
        else v.setViewVisibility(R.id.ns, View.GONE);
        if (!n.optString("why").isEmpty()) v.setTextViewText(R.id.nw, "Why it matters: " + n.optString("why"));
        else v.setViewVisibility(R.id.nw, View.GONE);
        String url = n.optString("url");
        if (url.startsWith("http")) v.setOnClickFillInIntent(R.id.read, fill("url", url, "")); else v.setViewVisibility(R.id.read, View.GONE);
        v.setOnClickFillInIntent(R.id.rowroot, fill("open", "", r.target));
        return v;
    }

    private static RemoteViews nextView(Context c, Row r) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_next);
        long now = System.currentTimeMillis();
        JSONObject e = r.o;
        if (e == null) {
            v.setTextViewText(R.id.nl, "NEXT UP");
            v.setTextViewText(R.id.nn, "Clear for now");
            v.setTextViewText(R.id.nm, "Nothing else on the calendar. Use the gap well.");
        } else {
            boolean live = e.optLong("s") <= now;
            v.setTextViewText(R.id.nl, live ? "HAPPENING NOW" : "NEXT UP");
            v.setTextViewText(R.id.nn, e.optString("t"));
            v.setTextViewText(R.id.nm, live ? "until " + Widgets.fmt("h:mm a", e.optLong("e")) : Widgets.fmt("EEE h:mm a", e.optLong("s")) + "  ·  " + Widgets.relative(e.optLong("s"), now));
        }
        v.setOnClickFillInIntent(R.id.nxroot, fill("open", "", r.target));
        return v;
    }

    private static RemoteViews progressView(Context c, Row r) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_progress);
        v.setTextViewText(R.id.pl, r.a);
        v.setTextViewText(R.id.pv, r.b);
        int pct = r.o == null ? 0 : r.o.optInt("pct");
        v.setProgressBar(R.id.pb, 100, Math.max(0, Math.min(100, pct)), false);
        v.setOnClickFillInIntent(R.id.pgroot, fill("open", "", r.target));
        return v;
    }

    private static RemoteViews statsView(Context c, Row r) {
        JSONObject s = r.o == null ? new JSONObject() : r.o;
        JSONObject h = s.optJSONObject("habits");
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.row_stats);
        v.setTextViewText(R.id.n1, s.optInt("focusMin") + "m");
        v.setTextViewText(R.id.l1, "focus today");
        v.setTextViewText(R.id.n2, s.optInt("learn") + "/5");
        v.setTextViewText(R.id.l2, "learning");
        v.setTextViewText(R.id.n3, String.valueOf(h == null ? 0 : h.optInt("streak")));
        v.setTextViewText(R.id.l3, "day streak");
        v.setOnClickFillInIntent(R.id.strroot, fill("open", "", r.target));
        return v;
    }
}
