package app.dailydriver.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Draws every Daily Driver widget from the last snapshot the app stored. */
public class Widgets {
    static final int OVERVIEW = 0, SCHEDULE = 1, TASKS = 2, NEWS = 3, EVERYTHING = 4;
    private static final String PREFS = "widgets", KEY = "snapshot";

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
    }

    private static JSONObject load(Context c) {
        try {
            return new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        Class<?>[] kinds = { OverviewWidget.class, ScheduleWidget.class, TasksWidget.class, NewsWidget.class, EverythingWidget.class };
        for (int k = 0; k < kinds.length; k++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, kinds[k]));
            if (ids.length > 0) update(c, m, ids, k);
        }
    }

    static void update(Context c, AppWidgetManager m, int[] ids, int kind) {
        RemoteViews v = build(c, kind);
        for (int id : ids) m.updateAppWidget(id, v);
    }

    // ---------- small helpers ----------
    private static String pkg(Context c) { return c.getPackageName(); }
    private static int color(Context c, int id) { return ContextCompat.getColor(c, id); }
    private static String fmt(String pattern, long ms) { return new SimpleDateFormat(pattern, Locale.ENGLISH).format(new Date(ms)); }
    private static String todayKey() { return fmt("yyyy-MM-dd", System.currentTimeMillis()); }
    private static String tomorrowKey() { return fmt("yyyy-MM-dd", System.currentTimeMillis() + 86400000L); }

    private static String greeting(String name) {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String g = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Winding down";
        return name.isEmpty() ? g : g + ", " + name;
    }

    private static String relative(long start, long now) {
        long min = Math.max(0, (start - now) / 60000);
        if (min < 1) return "starting now";
        if (min < 60) return "in " + min + " min";
        long h = min / 60, r = min % 60;
        return "in " + h + " h" + (r >= 15 ? " " + r + " min" : "");
    }

    private static void head(RemoteViews v, String title, String sub, String tag) {
        v.setTextViewText(R.id.head, title);
        v.setTextViewText(R.id.sub, sub);
        v.setTextViewText(R.id.tag, tag);
        v.setViewVisibility(R.id.tag, tag.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private static void section(Context c, RemoteViews v, String text) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.widget_section);
        r.setTextViewText(R.id.st, text);
        v.addView(R.id.rows, r);
    }

    private static void note(Context c, RemoteViews v, String text) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_text);
        r.setTextViewText(R.id.rt, text);
        r.setTextColor(R.id.rt, color(c, R.color.dd_muted));
        r.setTextViewText(R.id.rm, "");
        v.addView(R.id.rows, r);
    }

    private static void line(Context c, RemoteViews v, String text, String meta, boolean urgent) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_text);
        r.setTextViewText(R.id.rt, text);
        r.setTextViewText(R.id.rm, meta);
        r.setInt(R.id.rt, "setMaxLines", 1);
        if (urgent) { r.setTextColor(R.id.rm, color(c, R.color.dd_bad)); }
        v.addView(R.id.rows, r);
    }

    private static void eventRow(Context c, RemoteViews v, JSONObject e, long now) {
        long s = e.optLong("s"), en = e.optLong("e");
        boolean all = e.optBoolean("allDay"), live = !all && s <= now && en > now;
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_event);
        if (all) { r.setTextViewText(R.id.tm, "All day"); r.setTextViewText(R.id.tm2, ""); }
        else if (live) { r.setTextViewText(R.id.tm, "Now"); r.setTextViewText(R.id.tm2, "until " + fmt("h:mm", en)); r.setTextColor(R.id.tm, color(c, R.color.dd_accent)); }
        else { r.setTextViewText(R.id.tm, fmt("h:mm", s)); r.setTextViewText(R.id.tm2, fmt("a", s)); }
        r.setTextViewText(R.id.ev, e.optString("title"));
        String where = e.optString("where");
        String meta = all ? "" : (live ? fmt("h:mm a", s) + " to " + fmt("h:mm a", en) : fmt("h:mm", s) + " to " + fmt("h:mm a", en));
        if (!where.isEmpty()) meta = meta.isEmpty() ? where : meta + "  ·  " + where;
        r.setTextViewText(R.id.ev2, meta);
        r.setViewVisibility(R.id.ev2, meta.isEmpty() ? View.GONE : View.VISIBLE);
        if (live) r.setInt(R.id.evroot, "setBackgroundResource", R.drawable.now_bg);
        else if (all) r.setInt(R.id.bar, "setBackgroundResource", R.drawable.bar_muted);
        v.addView(R.id.rows, r);
    }

    // ---------- content ----------
    private static List<JSONObject> upcoming(JSONObject s, long now) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray ev = s.optJSONArray("events");
        for (int i = 0; ev != null && i < ev.length(); i++) {
            JSONObject e = ev.optJSONObject(i);
            if (e != null && e.optLong("e") > now) out.add(e);
        }
        return out;
    }

    private static void nextUp(Context c, RemoteViews v, JSONObject s, long now) {
        JSONObject pick = null;
        for (JSONObject e : upcoming(s, now)) {
            if (e.optBoolean("allDay")) continue;
            pick = e;
            break;
        }
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_next);
        if (pick == null) {
            r.setTextViewText(R.id.nl, "NEXT UP");
            r.setTextViewText(R.id.nn, "Clear for now");
            r.setTextViewText(R.id.nm, "Nothing else on the calendar. Use the gap well.");
        } else {
            boolean live = pick.optLong("s") <= now;
            r.setTextViewText(R.id.nl, live ? "HAPPENING NOW" : "NEXT UP");
            r.setTextViewText(R.id.nn, pick.optString("title"));
            r.setTextViewText(R.id.nm, live ? "until " + fmt("h:mm a", pick.optLong("e")) : fmt("EEE h:mm a", pick.optLong("s")) + "  ·  " + relative(pick.optLong("s"), now));
        }
        v.addView(R.id.rows, r);
    }

    private static void stats(Context c, RemoteViews v, JSONObject s) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_stats);
        r.setTextViewText(R.id.n1, String.valueOf(s.optInt("taskCount")));
        r.setTextViewText(R.id.l1, s.optInt("dueSoon") > 0 ? "tasks, " + s.optInt("dueSoon") + " soon" : "open tasks");
        JSONObject h = s.optJSONObject("habits");
        int total = h == null ? 0 : h.optInt("total"), done = h == null ? 0 : h.optInt("done");
        r.setTextViewText(R.id.n2, total == 0 ? "-" : done + "/" + total);
        r.setTextViewText(R.id.l2, "habits today");
        int streak = h == null ? 0 : h.optInt("streak");
        r.setTextViewText(R.id.n3, String.valueOf(streak));
        r.setTextViewText(R.id.l3, streak == 1 ? "day streak" : "day streak");
        v.addView(R.id.rows, r);
    }

    private static void attention(Context c, RemoteViews v, JSONObject s, int max) {
        JSONArray ac = s.optJSONArray("actions");
        int shown = 0;
        long now = System.currentTimeMillis();
        for (int i = 0; ac != null && i < ac.length() && shown < max; i++) {
            JSONObject m = ac.optJSONObject(i);
            if (m == null) continue;
            if (shown == 0) section(c, v, "Needs you");
            boolean today = fmt("yyyy-MM-dd", m.optLong("s")).equals(todayKey());
            line(c, v, m.optString("title"), today ? fmt("h:mm a", m.optLong("s")) : fmt("EEE", m.optLong("s")), today);
            shown++;
        }
    }

    private static void schedule(Context c, RemoteViews v, JSONObject s, int max) {
        long now = System.currentTimeMillis();
        String today = todayKey(), tomorrow = tomorrowKey(), lastDay = "";
        int shown = 0;
        for (JSONObject e : upcoming(s, now)) {
            if (shown >= max) break;
            String d = e.optString("d", today);
            if (!d.equals(lastDay)) {
                String label = d.equals(today) ? "Today" : d.equals(tomorrow) ? "Tomorrow" : fmt("EEEE d MMM", e.optLong("s"));
                section(c, v, label);
                lastDay = d;
            }
            eventRow(c, v, e, now);
            shown++;
        }
        if (shown == 0) note(c, v, "Nothing coming up. A free stretch is a good time to focus.");
    }

    private static void tasks(Context c, RemoteViews v, JSONObject s, int max) {
        JSONArray t = s.optJSONArray("tasks");
        int n = t == null ? 0 : Math.min(t.length(), max);
        for (int i = 0; i < n; i++) {
            JSONObject x = t.optJSONObject(i);
            if (x == null) continue;
            RemoteViews r = new RemoteViews(pkg(c), R.layout.row_task);
            r.setTextViewText(R.id.tk, x.optString("title"));
            String due = x.optString("due");
            if (due.isEmpty()) r.setViewVisibility(R.id.due, View.GONE);
            else {
                r.setTextViewText(R.id.due, due);
                if (due.equals("Overdue") || due.equals("Today")) { r.setInt(R.id.due, "setBackgroundResource", R.drawable.pill_bad_bg); r.setTextColor(R.id.due, color(c, R.color.dd_bad)); }
                else if (due.equals("Tomorrow")) { r.setInt(R.id.due, "setBackgroundResource", R.drawable.pill_warn_bg); r.setTextColor(R.id.due, color(c, R.color.dd_warn)); }
            }
            v.addView(R.id.rows, r);
        }
        if (n == 0) note(c, v, "Nothing left to do. Enjoy the quiet.");
    }

    private static void news(Context c, RemoteViews v, JSONObject s, int max, int lines) {
        JSONArray t = s.optJSONArray("news");
        int n = t == null ? 0 : Math.min(t.length(), max);
        for (int i = 0; i < n; i++) {
            JSONObject x = t.optJSONObject(i);
            if (x == null) continue;
            RemoteViews r = new RemoteViews(pkg(c), R.layout.row_news);
            r.setTextViewText(R.id.cat, x.optString("cat").toUpperCase(Locale.ENGLISH));
            r.setTextViewText(R.id.nt, x.optString("title"));
            r.setInt(R.id.nt, "setMaxLines", lines);
            v.addView(R.id.rows, r);
        }
        if (n == 0) note(c, v, "No headlines yet. They land every morning.");
    }

    // ---------- the five widgets ----------
    private static RemoteViews build(Context c, int kind) {
        JSONObject s = load(c);
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_card);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(pkg(c));
        if (open != null) v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(c, kind, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        v.removeAllViews(R.id.rows);
        long now = System.currentTimeMillis();
        String name = s.optString("name", "");
        String date = fmt("EEEE d MMMM", now);
        boolean empty = s.length() == 0;
        switch (kind) {
            case OVERVIEW:
                head(v, greeting(name), date, "");
                if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); break; }
                nextUp(c, v, s, now);
                stats(c, v, s);
                attention(c, v, s, 2);
                break;
            case SCHEDULE:
                head(v, "Schedule", fmt("EEE d MMM", now), String.valueOf(upcomingToday(s, now)) + " left today");
                if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); break; }
                schedule(c, v, s, 7);
                break;
            case TASKS:
                head(v, "Tasks", s.optInt("dueSoon") > 0 ? s.optInt("dueSoon") + " due soon" : "Nothing urgent", s.optInt("taskCount") + " open");
                if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); break; }
                tasks(c, v, s, 7);
                break;
            case NEWS:
                head(v, "News", "Worth knowing today", "");
                if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); break; }
                news(c, v, s, 5, 2);
                break;
            default:
                head(v, greeting(name), date, "");
                if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); break; }
                nextUp(c, v, s, now);
                stats(c, v, s);
                attention(c, v, s, 2);
                section(c, v, "Schedule");
                schedule(c, v, s, 3);
                section(c, v, "Tasks");
                tasks(c, v, s, 3);
                section(c, v, "News");
                news(c, v, s, 2, 1);
        }
        return v;
    }

    private static int upcomingToday(JSONObject s, long now) {
        int n = 0;
        String today = todayKey();
        for (JSONObject e : upcoming(s, now)) if (e.optString("d", today).equals(today)) n++;
        return n;
    }
}
