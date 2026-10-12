package app.dailydriver.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
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

    private static RemoteViews build(Context c, int kind) {
        JSONObject s = load(c);
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_card);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open != null) v.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(c, kind, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        v.removeAllViews(R.id.rows);
        boolean empty = s.length() == 0;
        String name = s.optString("name", "");
        switch (kind) {
            case OVERVIEW:
                head(v, greeting(name), new SimpleDateFormat("EEEE d MMMM", Locale.ENGLISH).format(new java.util.Date()));
                if (empty) { row(c, v, "Open Daily Driver once to fill this in.", "", 2, false); break; }
                overview(c, v, s);
                break;
            case SCHEDULE:
                head(v, "Schedule", "");
                if (empty) { row(c, v, "Open Daily Driver once to fill this in.", "", 2, false); break; }
                schedule(c, v, s, 8);
                break;
            case TASKS:
                head(v, "Tasks", s.optInt("taskCount") + " open");
                if (empty) { row(c, v, "Open Daily Driver once to fill this in.", "", 2, false); break; }
                tasks(c, v, s, 8);
                break;
            case NEWS:
                head(v, "News", s.optString("newsDate", ""));
                if (empty) { row(c, v, "Open Daily Driver once to fill this in.", "", 2, false); break; }
                news(c, v, s, 5, 2);
                break;
            default:
                head(v, greeting(name), new SimpleDateFormat("EEEE d MMMM", Locale.ENGLISH).format(new java.util.Date()));
                if (empty) { row(c, v, "Open Daily Driver once to fill this in.", "", 2, false); break; }
                overview(c, v, s);
                section(c, v, "Schedule");
                schedule(c, v, s, 4);
                section(c, v, "Tasks");
                tasks(c, v, s, 4);
                section(c, v, "News");
                news(c, v, s, 3, 1);
        }
        return v;
    }

    private static void head(RemoteViews v, String title, String sub) {
        v.setTextViewText(R.id.head, title);
        v.setTextViewText(R.id.sub, sub);
    }

    private static void row(Context c, RemoteViews v, String text, String meta, int lines, boolean accent) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_row);
        r.setTextViewText(R.id.rt, text);
        r.setTextViewText(R.id.rm, meta);
        r.setInt(R.id.rt, "setMaxLines", lines);
        v.addView(R.id.rows, r);
    }

    private static void section(Context c, RemoteViews v, String text) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_section);
        r.setTextViewText(R.id.st, text);
        v.addView(R.id.rows, r);
    }

    private static String greeting(String name) {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
        return name.isEmpty() ? g : g + ", " + name;
    }

    private static String clock(long ms) {
        return new SimpleDateFormat("h:mm a", Locale.ENGLISH).format(new java.util.Date(ms));
    }

    private static void overview(Context c, RemoteViews v, JSONObject s) {
        JSONArray ev = s.optJSONArray("events");
        long now = System.currentTimeMillis();
        String next = "Nothing else on the calendar";
        String meta = "";
        for (int i = 0; ev != null && i < ev.length(); i++) {
            JSONObject e = ev.optJSONObject(i);
            if (e == null || e.optLong("e") < now) continue;
            next = e.optString("title");
            meta = e.optBoolean("allDay") ? "All day" : clock(e.optLong("s"));
            break;
        }
        row(c, v, next, meta, 1, false);
        int due = s.optInt("dueSoon");
        row(c, v, s.optInt("taskCount") + " open tasks" + (due > 0 ? ", " + due + " due soon" : ""), "", 1, false);
        JSONObject h = s.optJSONObject("habits");
        if (h != null && h.optInt("total") > 0) row(c, v, "Habits " + h.optInt("done") + " of " + h.optInt("total"), h.optInt("streak") > 0 ? h.optInt("streak") + " day streak" : "", 1, false);
        JSONArray ac = s.optJSONArray("actions");
        for (int i = 0, shown = 0; ac != null && i < ac.length() && shown < 3; i++) {
            JSONObject m = ac.optJSONObject(i);
            if (m == null) continue;
            row(c, v, m.optString("title"), clock(m.optLong("s")), 1, false);
            shown++;
        }
    }

    private static void schedule(Context c, RemoteViews v, JSONObject s, int max) {
        JSONArray ev = s.optJSONArray("events");
        long now = System.currentTimeMillis();
        Calendar tmr = Calendar.getInstance();
        tmr.add(Calendar.DAY_OF_YEAR, 1);
        tmr.set(Calendar.HOUR_OF_DAY, 0); tmr.set(Calendar.MINUTE, 0); tmr.set(Calendar.SECOND, 0);
        long tomorrow = tmr.getTimeInMillis();
        int shown = 0;
        boolean marked = false;
        for (int i = 0; ev != null && i < ev.length() && shown < max; i++) {
            JSONObject e = ev.optJSONObject(i);
            if (e == null || e.optLong("e") < now) continue;
            if (!marked && e.optLong("s") >= tomorrow) { section(c, v, "Tomorrow"); marked = true; }
            row(c, v, e.optString("title"), e.optBoolean("allDay") ? "All day" : clock(e.optLong("s")), 1, false);
            shown++;
        }
        if (shown == 0) row(c, v, "Nothing coming up", "", 1, false);
    }

    private static void tasks(Context c, RemoteViews v, JSONObject s, int max) {
        JSONArray t = s.optJSONArray("tasks");
        int n = t == null ? 0 : Math.min(t.length(), max);
        for (int i = 0; i < n; i++) {
            JSONObject x = t.optJSONObject(i);
            if (x != null) row(c, v, x.optString("title"), x.optString("due"), 1, false);
        }
        if (n == 0) row(c, v, "No open tasks", "", 1, false);
    }

    private static void news(Context c, RemoteViews v, JSONObject s, int max, int lines) {
        JSONArray t = s.optJSONArray("news");
        int n = t == null ? 0 : Math.min(t.length(), max);
        for (int i = 0; i < n; i++) {
            JSONObject x = t.optJSONObject(i);
            if (x != null) row(c, v, x.optString("title"), "", lines, false);
        }
        if (n == 0) row(c, v, "No news yet", "", 1, false);
    }
}
