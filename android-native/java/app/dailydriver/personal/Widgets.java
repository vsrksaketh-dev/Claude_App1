package app.dailydriver.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.style.ForegroundColorSpan;
import android.util.TypedValue;
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

/**
 * Draws every Daily Driver widget from the last snapshot the app stored, and handles the taps that change a widget in place.
 *
 * How it is built, so it stays quick and predictable on any home screen:
 * - Every widget is one fixed frame (widget_card or widget_calendar). Its buttons, mode switches and the 42 day cells are fixed
 *   views that are given their text, look and tap on every draw, both ways, so a launcher reusing old views keeps nothing stale.
 * - The rows that fit the widget's height are placed straight into the frame; longer lists get page arrows. There is no list
 *   service: what is drawn is always exactly what was just worked out, in the same update.
 * - A tap that changes the widget (a tick, a filter, a mode, a day, a page) is a broadcast to that widget's own provider
 *   (WidgetProvider), which updates only the widgets it affects: a calendar tap redraws that one calendar, nothing else.
 * - A tap that leaves the home screen (open a tab, open a link) starts the app or the browser directly.
 * - If drawing ever fails, the widget shows a plain card that opens the app, and the error goes to the app's problem log.
 */
public class Widgets {
    // Kind numbers are internal. 4 used to be the "Everything" widget, which was removed (Overview covers it).
    static final int OVERVIEW = 0, SCHEDULE = 1, TASKS = 2, NEWS = 3, CALENDAR = 5, HABITS = 6, NEXT = 7, QUICK = 8, PROBLEM = 9, DEADLINES = 10, NOTES = 11;
    static final String TAP = "app.dailydriver.personal.WIDGET_TAP";
    private static final String PREFS = "widgets";
    private static final String[] CATS = { "International", "Indian", "Business", "Tech" };
    private static final String[] CAT_SHORT = { "World", "India", "Business", "Tech" };
    private static final String[] MODES = { "month", "week", "day", "agenda" };
    static final int[] PILLS = { R.id.p0, R.id.p1, R.id.p2, R.id.p3, R.id.p4, R.id.p5 }, FOOT = { R.id.f0, R.id.f1, R.id.f2 }, MODE_BTN = { R.id.m0, R.id.m1, R.id.m2, R.id.m3 }, ROWS = { R.id.cr0, R.id.cr1, R.id.cr2, R.id.cr3, R.id.cr4, R.id.cr5 };
    static final int[] CELL = { R.id.cc0, R.id.cc1, R.id.cc2, R.id.cc3, R.id.cc4, R.id.cc5, R.id.cc6, R.id.cc7, R.id.cc8, R.id.cc9, R.id.cc10, R.id.cc11, R.id.cc12, R.id.cc13, R.id.cc14, R.id.cc15, R.id.cc16, R.id.cc17, R.id.cc18, R.id.cc19, R.id.cc20, R.id.cc21, R.id.cc22, R.id.cc23, R.id.cc24, R.id.cc25, R.id.cc26, R.id.cc27, R.id.cc28, R.id.cc29, R.id.cc30, R.id.cc31, R.id.cc32, R.id.cc33, R.id.cc34, R.id.cc35, R.id.cc36, R.id.cc37, R.id.cc38, R.id.cc39, R.id.cc40, R.id.cc41 };
    static final int[] CELL_NUM = { R.id.cd0, R.id.cd1, R.id.cd2, R.id.cd3, R.id.cd4, R.id.cd5, R.id.cd6, R.id.cd7, R.id.cd8, R.id.cd9, R.id.cd10, R.id.cd11, R.id.cd12, R.id.cd13, R.id.cd14, R.id.cd15, R.id.cd16, R.id.cd17, R.id.cd18, R.id.cd19, R.id.cd20, R.id.cd21, R.id.cd22, R.id.cd23, R.id.cd24, R.id.cd25, R.id.cd26, R.id.cd27, R.id.cd28, R.id.cd29, R.id.cd30, R.id.cd31, R.id.cd32, R.id.cd33, R.id.cd34, R.id.cd35, R.id.cd36, R.id.cd37, R.id.cd38, R.id.cd39, R.id.cd40, R.id.cd41 };
    static final int[] CELL_DOTS = { R.id.ct0, R.id.ct1, R.id.ct2, R.id.ct3, R.id.ct4, R.id.ct5, R.id.ct6, R.id.ct7, R.id.ct8, R.id.ct9, R.id.ct10, R.id.ct11, R.id.ct12, R.id.ct13, R.id.ct14, R.id.ct15, R.id.ct16, R.id.ct17, R.id.ct18, R.id.ct19, R.id.ct20, R.id.ct21, R.id.ct22, R.id.ct23, R.id.ct24, R.id.ct25, R.id.ct26, R.id.ct27, R.id.ct28, R.id.ct29, R.id.ct30, R.id.ct31, R.id.ct32, R.id.ct33, R.id.ct34, R.id.ct35, R.id.ct36, R.id.ct37, R.id.ct38, R.id.ct39, R.id.ct40, R.id.ct41 };

    // ---------- storage ----------
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    private static String cacheRaw = null;
    private static JSONObject cacheObj = new JSONObject();

    static synchronized void save(Context c, String json) { prefs(c).edit().putString("snapshot", json).apply(); cacheRaw = null; }

    /** The snapshot, parsed once and kept until it changes. Callers only read it; handle() works on its own copy. */
    static synchronized JSONObject load(Context c) {
        String raw = prefs(c).getString("snapshot", "{}");
        if (!raw.equals(cacheRaw)) {
            try { cacheObj = new JSONObject(raw); } catch (Exception e) { cacheObj = new JSONObject(); }
            cacheRaw = raw;
        }
        return cacheObj;
    }

    private static JSONObject fresh(Context c) {
        try { return new JSONObject(prefs(c).getString("snapshot", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    // Each widget keeps its own filter, day, mode and page ("tf.<id>"); the plain key is the old shared value, used as a fallback.
    static String wkey(String k, int wid) { return wid == 0 ? k : k + "." + wid; }

    static String getS(Context c, String k, int wid, String def) {
        SharedPreferences p = prefs(c);
        String v = p.getString(wkey(k, wid), null);
        return v != null ? v : p.getString(k, def);
    }

    static int getI(Context c, String k, int wid, int def) {
        try { return Integer.parseInt(getS(c, k, wid, String.valueOf(def))); } catch (Exception e) { return def; }
    }

    /** A widget was removed: forget its own settings. */
    static void forget(Context c, int[] ids) {
        SharedPreferences.Editor e = prefs(c).edit();
        for (int id : ids) for (String k : new String[] { "tf", "ncat", "day", "cmode", "csel", "canchor", "cnolist", "pg" }) e.remove(wkey(k, id));
        e.apply();
    }

    static void setTarget(Context c, String t) { prefs(c).edit().putString("target", t == null ? "" : t).apply(); }

    static String takeTarget(Context c) {
        String t = prefs(c).getString("target", "");
        prefs(c).edit().remove("target").apply();
        return t;
    }

    static String takeOps(Context c) {
        String o = prefs(c).getString("ops", "[]");
        prefs(c).edit().remove("ops").apply();
        return o;
    }

    /** Lets other native entry points (sharing text into the app) hand something to the page the same way widget ticks do. */
    static synchronized void enqueue(Context c, String type, String id) { queue(c, type, id, null); }

    // on: for a task, whether it was ticked (true) or put back (false); the app applies it in order.
    private static void queue(Context c, String type, String id, Boolean on) {
        try {
            JSONArray ops = new JSONArray(prefs(c).getString("ops", "[]"));
            JSONObject op = new JSONObject().put("t", type).put("id", id);
            if (on != null) op.put("on", on.booleanValue());
            ops.put(op);
            prefs(c).edit().putString("ops", ops.toString()).apply();
        } catch (Exception ignored) { }
    }

    // ---------- dates ----------
    static Calendar cal(String key) {
        String[] p = key.split("-");
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 0, 0, 0);
        return c;
    }

    static String key(Calendar c) {
        return String.format(Locale.ENGLISH, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static String plusDays(String key, int n) { Calendar c = cal(key); c.add(Calendar.DAY_OF_MONTH, n); return key(c); }

    static String plusMonths(String key, int n) { Calendar c = cal(key); c.set(Calendar.DAY_OF_MONTH, 1); c.add(Calendar.MONTH, n); return key(c); }

    /** The Monday of the week holding the day. */
    static String weekStart(String key) {
        Calendar c = cal(key);
        c.add(Calendar.DAY_OF_MONTH, -((c.get(Calendar.DAY_OF_WEEK) + 5) % 7));
        return key(c);
    }

    static int dayDiff(String from, String to) { return (int) Math.round((cal(to).getTimeInMillis() - cal(from).getTimeInMillis()) / 86400000.0); }

    static String fmt(String pattern, long ms) { return new SimpleDateFormat(pattern, Locale.ENGLISH).format(new Date(ms)); }

    /** "Overdue", "Today", "Tomorrow" or a short date, worked out from the due date now so it is right even if the app was last opened yesterday. */
    static String dueLabel(String dd, String fallback) {
        if (dd == null || dd.length() < 10) return fallback == null ? "" : fallback;
        try {
            String k = dd.substring(0, 10);
            int n = dayDiff(dayKey(0), k);
            if (n < 0) return "Overdue";
            if (n == 0) return "Today";
            if (n == 1) return "Tomorrow";
            return fmt("EEE d MMM", cal(k).getTimeInMillis());
        } catch (Exception e) { return fallback == null ? "" : fallback; }
    }

    /** Open tasks due today, tomorrow or already late, counted from the stored list. */
    static int dueSoon(JSONObject s) {
        int n = 0;
        JSONArray ts = arr(s, "tasks");
        for (int i = 0; i < ts.length(); i++) {
            JSONObject x = ts.optJSONObject(i);
            if (x == null || x.optInt("dn") == 1) continue;
            String d = dueLabel(x.optString("dd"), "");
            if (d.equals("Overdue") || d.equals("Today") || d.equals("Tomorrow")) n++;
        }
        return n;
    }

    /** The snapshot was made on an earlier day: yesterday's ticks must not show as today's. */
    static boolean stale(JSONObject s) { String d = s.optString("today", ""); return !d.isEmpty() && !d.equals(dayKey(0)); }

    static String dayKey(int offset) { return plusDays(key(Calendar.getInstance()), offset); }

    private static boolean validDay(String k) {
        if (k == null || !k.matches("\\d{4}-\\d{2}-\\d{2}")) return false;
        try { return Math.abs(dayDiff(dayKey(0), k)) <= 900; } catch (Exception e) { return false; }
    }

    /**
     * The calendar widget's state as { mode, selected day, anchor }. Anything missing, garbled or wandering more than about
     * two years away is reset to today, so one bad value can never leave the widget stuck on a page that cannot be left.
     */
    static String[] calState(Context c, int wid) {
        String mode = getS(c, "cmode", wid, "month");
        if (!"month".equals(mode) && !"week".equals(mode) && !"day".equals(mode) && !"agenda".equals(mode)) mode = "month";
        String sel = getS(c, "csel", wid, null), anchor = getS(c, "canchor", wid, null);
        if (!validDay(sel)) sel = dayKey(0);
        if (!validDay(anchor)) anchor = sel;
        return new String[] { mode, sel, anchor };
    }

    static String relative(long start, long now) {
        long min = Math.max(0, (start - now) / 60000);
        if (min < 1) return "starting now";
        if (min < 60) return "in " + min + " min";
        long h = min / 60, r = min % 60;
        return "in " + h + " h" + (r >= 15 ? " " + r + " min" : "");
    }

    // ---------- taps ----------
    /** A tap broadcast arrived at a widget's provider. */
    static void tap(Context c, Intent i) {
        if (i == null) return;
        handle(c, i.getIntExtra("kind", -1), i.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0), i.getStringExtra("type"), i.getStringExtra("id"));
    }

    /** Old entry point, kept for the tests: a tap with no particular widget. */
    static void handle(Context c, String type, String id, String arg) { handle(c, -1, 0, type, id); }

    /**
     * Applies one tap and redraws what it changed. Ticks change the user's data (queued for the app) and redraw the widgets that
     * show it; everything else (filters, days, modes, pages) belongs to the one widget that was tapped and redraws only that one.
     */
    static synchronized void handle(Context c, int kind, int wid, String type, String id) {
        if (type == null) return;
        if (id == null) id = "";
        int[] redraw = null;
        try {
            SharedPreferences.Editor e = prefs(c).edit();
            switch (type) {
                case "task": case "act": case "habit": {
                    JSONObject s = fresh(c);
                    if ("task".equals(type)) {
                        // A ticked task stays on the list, struck through at the bottom, so it can be put back with another tap.
                        JSONArray ts = s.optJSONArray("tasks");
                        boolean on = true;
                        for (int i = 0; ts != null && i < ts.length(); i++) {
                            JSONObject x = ts.optJSONObject(i);
                            if (x != null && id.equals(x.optString("id"))) { on = x.optInt("dn") == 0; x.put("dn", on ? 1 : 0); }
                        }
                        s.put("tasks", sortTasks(ts));
                        s.put("taskCount", Math.max(0, s.optInt("taskCount") + (on ? -1 : 1)));
                        mark(s, id, true, on);
                        queue(c, "task", id, on);
                        redraw = new int[] { TASKS, OVERVIEW, NEXT, DEADLINES, CALENDAR, SCHEDULE };
                    } else if ("act".equals(type)) {
                        s.put("actions", without(s.optJSONArray("actions"), id));
                        mark(s, id, false, false);
                        queue(c, "act", id, null);
                        redraw = new int[] { OVERVIEW, NEXT, DEADLINES, CALENDAR, SCHEDULE };
                    } else {
                        JSONArray hl = s.optJSONArray("habitList");
                        JSONObject hs = s.optJSONObject("habits");
                        for (int i = 0; hl != null && i < hl.length(); i++) {
                            JSONObject h = hl.optJSONObject(i);
                            if (h != null && id.equals(h.optString("id"))) {
                                boolean now = !h.optBoolean("done");
                                h.put("done", now);
                                if (hs != null) hs.put("done", Math.max(0, hs.optInt("done") + (now ? 1 : -1)));
                            }
                        }
                        queue(c, "habit", id, null);
                        redraw = new int[] { HABITS, OVERVIEW };
                    }
                    save(c, s.toString());
                    break;
                }
                case "pg": e.putString(wkey("pg", wid), String.valueOf(Math.max(0, parse(id)))); break;
                case "day": e.putString(wkey("day", wid), String.valueOf(Math.max(-14, Math.min(60, parse(id))))).remove(wkey("pg", wid)); break;
                case "ncat": e.putString(wkey("ncat", wid), id).remove(wkey("pg", wid)); break;
                case "tf": e.putString(wkey("tf", wid), id).remove(wkey("pg", wid)); break;
                case "cmode": {
                    if (!java.util.Arrays.asList(MODES).contains(id)) break;
                    String[] st = calState(c, wid);
                    e.putString(wkey("cmode", wid), id).putString(wkey("csel", wid), st[1])
                        .putString(wkey("canchor", wid), "agenda".equals(id) ? dayKey(0) : st[1]).remove(wkey("pg", wid));
                    break;
                }
                case "ctoday": {
                    String[] st = calState(c, wid);
                    e.putString(wkey("csel", wid), dayKey(0)).putString(wkey("canchor", wid), dayKey(0)).remove(wkey("pg", wid));
                    if ("agenda".equals(st[0])) e.putString(wkey("canchor", wid), dayKey(0));
                    break;
                }
                case "csel": {
                    if (!validDay(id)) break;
                    String[] st = calState(c, wid);
                    e.putString(wkey("csel", wid), id).remove(wkey("pg", wid));
                    // a month grid with no room for a list under it: show the picked day in Day view, where its items fit
                    if ("month".equals(st[0]) && "1".equals(getS(c, "cnolist", wid, "0"))) { e.putString(wkey("cmode", wid), "day").putString(wkey("canchor", wid), id); break; }
                    // the month or week on show follows the day that was picked, so what is highlighted is always what is drawn
                    if ("month".equals(st[0]) && !id.substring(0, 7).equals(st[2].substring(0, 7))) e.putString(wkey("canchor", wid), id);
                    else if ("week".equals(st[0]) || "day".equals(st[0])) e.putString(wkey("canchor", wid), id);
                    break;
                }
                case "cnav": {
                    int dir = "-1".equals(id) ? -1 : 1;
                    String[] st = calState(c, wid);
                    e.remove(wkey("pg", wid));
                    if ("month".equals(st[0])) {
                        String a = plusMonths(st[2], dir);
                        if (!validDay(a)) break;
                        e.putString(wkey("canchor", wid), a).putString(wkey("csel", wid), a.substring(0, 7).equals(dayKey(0).substring(0, 7)) ? dayKey(0) : a);
                    } else if ("week".equals(st[0])) {
                        String sl = plusDays(st[1], 7 * dir);
                        if (!validDay(sl)) break;
                        e.putString(wkey("canchor", wid), sl).putString(wkey("csel", wid), sl);
                    } else if ("day".equals(st[0])) {
                        String sl = plusDays(st[1], dir);
                        if (!validDay(sl)) break;
                        e.putString(wkey("csel", wid), sl).putString(wkey("canchor", wid), sl);
                    } else {
                        // the agenda starts at today and moves a week at a time, never into the past
                        String a = plusDays(st[2], 7 * dir);
                        if (dayDiff(dayKey(0), a) < 0 || !validDay(a)) a = dayKey(0);
                        e.putString(wkey("canchor", wid), a);
                    }
                    break;
                }
                default: break;
            }
            e.commit();     // written before the redraw reads it back
        } catch (Exception err) { logError(c, "tap " + type, err); }
        if (redraw != null) for (int k : redraw) refreshKind(c, k);
        else if (wid != 0 && kind >= 0) redrawOne(c, kind, wid);
        else if (kind >= 0) refreshKind(c, kind);
        else refreshAll(c);
    }

    private static int parse(String s) { try { return Integer.parseInt(s.trim()); } catch (Exception e) { return 0; } }

    /** Reflect a tick in the calendar entries too, so the widget shows it at once. */
    private static void mark(JSONObject s, String id, boolean isTask, boolean on) {
        if (id.isEmpty()) return;
        JSONArray cal = s.optJSONArray("cal");
        for (int i = 0; cal != null && i < cal.length(); i++) {
            JSONObject x = cal.optJSONObject(i);
            if (x == null || !id.equals(x.optString("id")) || ("task".equals(x.optString("k")) != isTask)) continue;
            try { x.put("x", isTask ? (on ? 1 : 0) : (x.optInt("x") == 1 ? 0 : 1)); } catch (Exception ignored) { }
        }
    }

    /** Undone tasks first in their original priority order, ticked ones after. */
    private static JSONArray sortTasks(JSONArray a) {
        java.util.List<JSONObject> list = new java.util.ArrayList<>();
        for (int i = 0; a != null && i < a.length(); i++) { JSONObject o = a.optJSONObject(i); if (o != null) list.add(o); }
        java.util.Collections.sort(list, new java.util.Comparator<JSONObject>() {
            @Override public int compare(JSONObject x, JSONObject y) {
                int d = x.optInt("dn") - y.optInt("dn");
                return d != 0 ? d : x.optInt("i") - y.optInt("i");
            }
        });
        JSONArray out = new JSONArray();
        for (JSONObject o : list) out.put(o);
        return out;
    }

    private static JSONArray without(JSONArray a, String id) {
        JSONArray out = new JSONArray();
        for (int i = 0; a != null && i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o != null && !id.equals(o.optString("id"))) out.put(o);
        }
        return out;
    }

    // ---------- refreshing ----------
    static Class<?> providerFor(int kind) {
        switch (kind) {
            case OVERVIEW: return OverviewWidget.class;
            case SCHEDULE: return ScheduleWidget.class;
            case TASKS: return TasksWidget.class;
            case NEWS: return NewsWidget.class;
            case CALENDAR: return CalendarWidget.class;
            case HABITS: return HabitsWidget.class;
            case NEXT: return NextWidget.class;
            case QUICK: return QuickWidget.class;
            case PROBLEM: return ProblemWidget.class;
            case DEADLINES: return DeadlinesWidget.class;
            case NOTES: return NotesWidget.class;
            default: return null;
        }
    }

    static final int[] ALL = { OVERVIEW, SCHEDULE, TASKS, NEWS, CALENDAR, HABITS, NEXT, QUICK, PROBLEM, DEADLINES, NOTES };

    static void refreshKind(Context c, int kind) {
        Class<?> p = providerFor(kind);
        if (p == null) return;
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = m.getAppWidgetIds(new ComponentName(c, p));
            if (ids != null && ids.length > 0) update(c, m, ids, kind);
        } catch (Throwable t) { logError(c, "refresh " + kind, t); }
    }

    static void refreshAll(Context c) { for (int k : ALL) refreshKind(c, k); }

    private static void redrawOne(Context c, int kind, int wid) {
        try { update(c, AppWidgetManager.getInstance(c), new int[] { wid }, kind); } catch (Throwable t) { logError(c, "redraw " + kind, t); }
    }

    /**
     * The system asks each widget to refresh about every half hour. Besides redrawing, fetch fresh news and/or the calendars on a
     * background thread (the app need not be open), then redraw everything if anything changed. Never throws.
     */
    static void backgroundRefresh(final Context c, final android.content.BroadcastReceiver.PendingResult pending, final boolean news, final boolean calendar) {
        final Context app = c.getApplicationContext();
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    boolean changed = false;
                    if (calendar && CalendarSync.refresh(app, false)) changed = true;
                    if (news && NewsSync.refresh(app)) changed = true;
                    if (changed) refreshAll(app);
                } catch (Throwable ignored) {
                    // a failed refresh just leaves the last good data on screen
                } finally {
                    if (pending != null) pending.finish();
                }
            }
        }).start();
    }

    /**
     * The widget's size in dp. On a phone held upright a widget is its minimum width by its maximum height, which is what the
     * launcher actually gives it; using the minimum height made tall widgets think they were short and hide their lists.
     */
    static int[] size(AppWidgetManager m, int id) {
        Bundle o = null;
        try { o = m.getAppWidgetOptions(id); } catch (Exception ignored) { }
        if (o == null) return new int[] { 300, 300 };
        int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (h <= 0) h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        return new int[] { w > 0 ? w : 300, h > 0 ? h : 300 };
    }

    static void update(Context c, AppWidgetManager m, int[] ids, int kind) {
        JSONObject s = load(c);
        for (int id : ids) {
            int[] wh = size(m, id);
            try { m.updateAppWidget(id, build(c, kind, s, wh[1], wh[0], id)); }
            catch (Throwable t) {
                // Never leave a widget frozen on an old picture: record what went wrong and draw a plain card that opens the app.
                logError(c, "widget " + kind, t);
                try {
                    forget(c, new int[] { id });     // a widget setting may have caused it: start again from today
                    m.updateAppWidget(id, fallback(c));
                } catch (Throwable ignored) { }
            }
        }
    }

    static RemoteViews fallback(Context c) {
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_card);
        head(v, "Daily Driver", "Tap to open. This widget will redraw itself.", "");
        v.setViewVisibility(R.id.pills, View.GONE);
        v.setViewVisibility(R.id.pager, View.GONE);
        v.setViewVisibility(R.id.hprog, View.GONE);
        v.setViewVisibility(R.id.tag, View.GONE);
        v.removeAllViews(R.id.rows);
        v.setOnClickPendingIntent(R.id.root, open(c, "home"));
        return v;
    }

    /** The last few widget errors, handed to the app (WidgetBridge.take) for its problem log. */
    static synchronized void logError(Context c, String where, Throwable t) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("werr", "[]"));
            a.put(new JSONObject().put("at", System.currentTimeMillis()).put("where", where).put("msg", String.valueOf(t)).put("stack", t.getStackTrace().length > 0 ? String.valueOf(t.getStackTrace()[0]) : ""));
            while (a.length() > 20) a.remove(0);
            prefs(c).edit().putString("werr", a.toString()).apply();
        } catch (Exception ignored) { }
    }

    static synchronized String takeErrors(Context c) { String e = prefs(c).getString("werr", "[]"); prefs(c).edit().remove("werr").apply(); return e; }

    // ---------- helpers ----------
    static String pkg(Context c) { return c.getPackageName(); }

    static int color(Context c, int id) { return ContextCompat.getColor(c, id); }

    static JSONArray arr(JSONObject s, String k) { JSONArray a = s.optJSONArray(k); return a == null ? new JSONArray() : a; }

    static int barFor(String kind, boolean allDay) {
        if ("due".equals(kind)) return R.drawable.bar_bad;
        if ("action".equals(kind)) return R.drawable.bar_warn;
        return allDay ? R.drawable.bar_muted : R.drawable.bar_accent;
    }

    private static int kindColor(Context c, String kind) {
        if ("due".equals(kind)) return color(c, R.color.dd_bad);
        if ("action".equals(kind)) return color(c, R.color.dd_warn);
        if ("mail".equals(kind)) return color(c, R.color.dd_muted);
        if ("task".equals(kind)) return color(c, R.color.dd_text);
        return color(c, R.color.dd_accent);
    }

    /** Opens the app on a tab. Each target is its own pending intent (its own request code), so one never overwrites another. */
    static PendingIntent open(Context c, String target) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(pkg(c));
        if (i == null) i = new Intent().setClassName(c, pkg(c) + ".MainActivity");
        i.putExtra("target", target);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, ("open/" + target).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Opens a link (a meeting, a document, a story) straight in the browser or the app that owns it. */
    static PendingIntent link(Context c, String url) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, ("url/" + url).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** A tap that changes the widget in place: a broadcast to this widget's own provider, carrying the widget's id. */
    static PendingIntent act(Context c, int kind, int wid, String type, String id) {
        Class<?> p = providerFor(kind);
        Intent i = new Intent(c, p == null ? OverviewWidget.class : p);
        i.setAction(TAP);
        i.setData(Uri.parse("dd://tap/" + wid + "/" + type + "/" + Uri.encode(id)));
        i.putExtra("kind", kind);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        i.putExtra("type", type);
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(c, (wid + "/" + type + "/" + id).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** What each part of a row does when tapped, for one widget. */
    static WidgetRows.Taps taps(final Context c, final int kind, final int wid) {
        return new WidgetRows.Taps() {
            @Override public void bind(RemoteViews v, int viewId, String type, String id, String target) {
                if ("open".equals(type)) v.setOnClickPendingIntent(viewId, open(c, target == null || target.isEmpty() ? "home" : target));
                else if ("url".equals(type)) { if (id != null && id.startsWith("http")) v.setOnClickPendingIntent(viewId, link(c, id)); }
                else v.setOnClickPendingIntent(viewId, act(c, kind, wid, type, id));
            }
        };
    }

    private static String greeting(String name) {
        int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
        String g = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Winding down";
        return name.isEmpty() ? g : g + ", " + name;
    }

    // ---------- building blocks ----------
    private static void head(RemoteViews v, String title, String sub, String tag) {
        v.setTextViewText(R.id.head, title);
        v.setTextViewText(R.id.sub, sub);
        v.setViewVisibility(R.id.sub, sub.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.tag, tag);
        v.setViewVisibility(R.id.tag, tag.isEmpty() ? View.GONE : View.VISIBLE);
    }

    /** One button of a fixed row of buttons. */
    static final class Btn {
        final String text; final boolean on; final PendingIntent pi;
        Btn(String text, boolean on, PendingIntent pi) { this.text = text; this.on = on; this.pi = pi; }
    }

    /** Fills a fixed row of button slots; every slot is set, shown or hidden, on every draw. */
    private static void buttons(Context c, RemoteViews v, int[] slots, List<Btn> bs) {
        for (int i = 0; i < slots.length; i++) {
            if (i >= bs.size()) { v.setViewVisibility(slots[i], View.GONE); continue; }
            Btn b = bs.get(i);
            v.setViewVisibility(slots[i], View.VISIBLE);
            v.setTextViewText(slots[i], b.text);
            v.setInt(slots[i], "setBackgroundResource", b.on ? R.drawable.pill_bg : R.drawable.pill_off_bg);
            v.setTextColor(slots[i], color(c, b.on ? R.color.dd_accent : R.color.dd_muted));
            if (b.pi != null) v.setOnClickPendingIntent(slots[i], b.pi);
        }
    }

    /**
     * Splits rows into pages that fit the space (in dp). A heading is never left alone at the bottom of a page, and every page
     * holds at least one row, so even a tiny widget can page through everything.
     */
    static List<int[]> pages(List<WidgetRows.Row> rows, int avail) {
        List<int[]> out = new ArrayList<>();
        int i = 0;
        while (i < rows.size()) {
            int start = i, used = 0;
            while (i < rows.size() && (i == start || used + WidgetRows.height(rows.get(i)) <= avail)) { used += WidgetRows.height(rows.get(i)); i++; }
            if (i - start > 1 && i < rows.size() && rows.get(i - 1).type == WidgetRows.T_SECTION) i--;
            out.add(new int[] { start, i });
        }
        if (out.isEmpty()) out.add(new int[] { 0, 0 });
        return out;
    }

    /** Places the rows of the current page and sets the page arrows. Returns the page shown. */
    private static int placeRows(Context c, RemoteViews v, int kind, int wid, List<WidgetRows.Row> rows, int avail, boolean footButtons) {
        v.removeAllViews(R.id.rows);
        List<int[]> pg = pages(rows, Math.max(40, avail));
        int page = Math.max(0, Math.min(pg.size() - 1, getI(c, "pg", wid, 0)));
        WidgetRows.Taps t = taps(c, kind, wid);
        int[] r = pg.get(page);
        for (int i = r[0]; i < r[1]; i++) {
            try { v.addView(R.id.rows, WidgetRows.view(c, rows.get(i), t)); }
            catch (Exception err) { logError(c, "row " + kind, err); }
        }
        boolean paged = pg.size() > 1;
        v.setViewVisibility(R.id.pgprev, paged ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.pginfo, paged ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.pgnext, paged ? View.VISIBLE : View.GONE);
        if (paged) {
            v.setTextViewText(R.id.pginfo, (page + 1) + " of " + pg.size());
            v.setTextColor(R.id.pgprev, color(c, page > 0 ? R.color.dd_text : R.color.dd_muted));
            v.setTextColor(R.id.pgnext, color(c, page < pg.size() - 1 ? R.color.dd_text : R.color.dd_muted));
            v.setOnClickPendingIntent(R.id.pgprev, act(c, kind, wid, "pg", String.valueOf(Math.max(0, page - 1))));
            v.setOnClickPendingIntent(R.id.pgnext, act(c, kind, wid, "pg", String.valueOf(Math.min(pg.size() - 1, page + 1))));
        }
        v.setViewVisibility(R.id.pager, paged || footButtons ? View.VISIBLE : View.GONE);
        return page;
    }

    // ---------- the widgets ----------
    static RemoteViews build(Context c, int kind, JSONObject s, int hDp, int wDp, int wid) {
        if (kind == CALENDAR) return buildCalendar(c, s, hDp, wDp, wid);
        if (kind == QUICK) return buildQuick(c, hDp);
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_card);
        long now = System.currentTimeMillis();
        String name = s.optString("name", ""), date = fmt("EEEE d MMMM", now);
        boolean empty = s.length() == 0;
        String target = kind == TASKS ? "plan:tasks" : kind == NEWS ? "learn:news" : kind == NOTES ? "notes" : kind == PROBLEM ? "learn:cases" : kind == SCHEDULE ? "calendar:day:" + dayKey(0) : "home";
        v.setOnClickPendingIntent(R.id.root, open(c, target));
        v.setOnClickPendingIntent(R.id.headbox, open(c, target));
        List<Btn> pills = new ArrayList<>(), foot = new ArrayList<>();
        String tagTarget = "";
        switch (kind) {
            case OVERVIEW: {
                head(v, greeting(name), date, "");
                if (!empty) {
                    foot.add(new Btn("Capture", true, open(c, "home:capture")));
                    foot.add(new Btn("Calendar", false, open(c, "calendar:month")));
                }
                break;
            }
            case SCHEDULE: {
                int day = getI(c, "day", wid, 0);
                head(v, "Schedule", fmt("EEEE d MMM", cal(dayKey(day)).getTimeInMillis()), day == 0 ? "Today" : day == 1 ? "Tomorrow" : day == -1 ? "Yesterday" : "");
                if (!empty) {
                    pills.add(new Btn("‹", false, act(c, kind, wid, "day", String.valueOf(day - 1))));
                    pills.add(new Btn("Today", day == 0, act(c, kind, wid, "day", "0")));
                    pills.add(new Btn("›", false, act(c, kind, wid, "day", String.valueOf(day + 1))));
                    pills.add(new Btn("Calendar", false, open(c, "calendar:day:" + dayKey(day))));
                }
                break;
            }
            case TASKS: {
                String tf = getS(c, "tf", wid, "all");
                int soon = dueSoon(s);
                head(v, "Tasks", (soon > 0 ? soon + " due soon" : "Nothing urgent") + (empty ? "" : "  ·  " + s.optInt("taskCount") + " open"), empty ? "" : "+ Add");
                tagTarget = "plan:tasks:add";
                if (!empty) {
                    pills.add(new Btn("All", tf.equals("all"), act(c, kind, wid, "tf", "all")));
                    pills.add(new Btn("Due soon", tf.equals("soon"), act(c, kind, wid, "tf", "soon")));
                    pills.add(new Btn("Priority", tf.equals("pri"), act(c, kind, wid, "tf", "pri")));
                }
                break;
            }
            case NEWS: {
                String cat = getS(c, "ncat", wid, "");
                head(v, "News", empty ? "" : "Worth knowing today", "");
                if (!empty) {
                    pills.add(new Btn("All", cat.isEmpty(), act(c, kind, wid, "ncat", "")));
                    int room = wDp >= 330 ? 4 : wDp >= 270 ? 3 : 2;      // as many sections as fit on one line
                    for (int i = 0; i < CATS.length && i < room; i++) pills.add(new Btn(CAT_SHORT[i], cat.equals(CATS[i]), act(c, kind, wid, "ncat", CATS[i])));
                    if (arr(s, "saved").length() > 0) pills.add(new Btn("Saved", cat.equals("Saved"), act(c, kind, wid, "ncat", "Saved")));
                }
                break;
            }
            case HABITS: {
                JSONObject h = s.optJSONObject("habits");
                boolean st = stale(s);
                head(v, "Habits", empty ? "" : (st || h == null ? 0 : h.optInt("done")) + " of " + (h == null ? 0 : h.optInt("total")) + " done today", empty || h == null ? "" : h.optInt("streak") + " day streak");
                tagTarget = "home";
                if (!empty) foot.add(new Btn("Routine", true, open(c, "routine")));
                break;
            }
            case NEXT: {
                JSONObject ne = WidgetRows.nextEvent(s, now);
                head(v, "Next up", date, ne == null ? "" : relative(ne.optLong("s"), now).replace("in ", ""));
                tagTarget = "calendar:day:" + dayKey(0);
                break;
            }
            case PROBLEM: {
                head(v, "Problem of the day", "Think like a consultant", "");
                if (!empty) foot.add(new Btn("Try it", true, open(c, "learn:cases")));
                break;
            }
            case NOTES: {
                int n = s.optInt("notesCount", arr(s, "notes").length());
                head(v, "Notes", empty ? "" : n == 0 ? "Nothing saved yet" : n + " page" + (n == 1 ? "" : "s"), "");
                if (!empty) {
                    pills.add(new Btn("+ New page", true, open(c, "notes:new")));
                    pills.add(new Btn("Jot", false, open(c, "notes:add")));
                    pills.add(new Btn("All notes", false, open(c, "notes")));
                }
                break;
            }
            case DEADLINES: {
                int n = WidgetRows.deadlineCount(s, now);
                head(v, "Deadlines", empty ? "" : n == 0 ? "Nothing coming up" : n + " coming up", "");
                break;
            }
            default: head(v, greeting(name), date, "");
        }
        v.setOnClickPendingIntent(R.id.tag, open(c, tagTarget.isEmpty() ? target : tagTarget));
        // Short widgets drop the subtitle and the buttons so the rows keep their room.
        boolean compact = hDp < 160;
        if (compact) { v.setViewVisibility(R.id.sub, View.GONE); pills.clear(); foot.clear(); }
        int[] pr = progressFor(kind, s);
        boolean bar = pr != null && !empty && !compact;
        v.setViewVisibility(R.id.hprog, bar ? View.VISIBLE : View.GONE);
        if (bar) v.setProgressBar(R.id.hprog, 100, pr[0], false);
        v.setViewVisibility(R.id.pills, pills.isEmpty() ? View.GONE : View.VISIBLE);
        buttons(c, v, PILLS, pills);
        buttons(c, v, FOOT, foot);
        v.setViewVisibility(R.id.foot, foot.isEmpty() ? View.GONE : View.VISIBLE);
        // the room left for rows: the frame's padding, the header, the buttons, the bar and the footer
        int used = 28 + (compact ? 30 : 48) + (pills.isEmpty() ? 0 : 46) + (bar ? 16 : 0) + 8;
        List<WidgetRows.Row> rows = WidgetRows.build(c, kind, wid);
        int avail = hDp - used;
        boolean needPager = !foot.isEmpty() || pages(rows, avail).size() > 1;
        if (needPager) avail -= 46;
        placeRows(c, v, kind, wid, rows, avail, !foot.isEmpty());
        return v;
    }

    /** { percent done } for the widgets that show a bar under the title, or null. */
    static int[] progressFor(int kind, JSONObject s) {
        if (kind == TASKS) {
            JSONArray ts = arr(s, "tasks");
            int done = 0;
            for (int i = 0; i < ts.length(); i++) { JSONObject x = ts.optJSONObject(i); if (x != null && x.optInt("dn") == 1) done++; }
            return ts.length() == 0 ? null : new int[] { done * 100 / ts.length() };
        }
        if (kind == HABITS) {
            if (stale(s)) return new int[] { 0 };
            JSONObject h = s.optJSONObject("habits");
            return h == null || h.optInt("total") == 0 ? null : new int[] { h.optInt("done") * 100 / h.optInt("total") };
        }
        return null;
    }

    // ---------- the quick-add widget ----------
    private static RemoteViews buildQuick(Context c, int hDp) {
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_quick);
        v.setOnClickPendingIntent(R.id.root, open(c, "plan:tasks:add"));
        v.setOnClickPendingIntent(R.id.qtask, open(c, "plan:tasks:add"));
        v.setOnClickPendingIntent(R.id.qnote, open(c, "notes:add"));
        v.setOnClickPendingIntent(R.id.qcal, open(c, "calendar:add:" + dayKey(0)));
        v.setOnClickPendingIntent(R.id.qprac, open(c, "learn:cases"));
        // one row of two tiles when the widget is short, two rows when it is tall enough
        v.setViewVisibility(R.id.qrow2, hDp >= 120 ? View.VISIBLE : View.GONE);
        return v;
    }

    // ---------- the calendar widget ----------
    private static RemoteViews buildCalendar(Context c, JSONObject s, int hDp, int wDp, int wid) {
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_calendar);
        String todayKey = dayKey(0);
        String[] st = calState(c, wid);
        String mode = st[0], sel = st[1], anchor = st[2];
        v.setOnClickPendingIntent(R.id.root, open(c, "calendar:" + mode));

        // title and navigation
        String title = "month".equals(mode) ? fmt(wDp >= 300 ? "MMMM yyyy" : "MMM yyyy", cal(anchor).getTimeInMillis())
            : "week".equals(mode) ? fmt("d MMM", cal(weekStart(sel)).getTimeInMillis()) + " – " + fmt("d MMM", cal(plusDays(weekStart(sel), 6)).getTimeInMillis())
            : "day".equals(mode) ? fmt(wDp >= 300 ? "EEEE d MMMM" : "EEE d MMM", cal(sel).getTimeInMillis())
            : "From " + fmt("d MMM", cal(anchor).getTimeInMillis());
        v.setTextViewText(R.id.ctitle, title);
        v.setOnClickPendingIntent(R.id.ctitle, open(c, "calendar:" + mode));
        v.setOnClickPendingIntent(R.id.cadd, open(c, "calendar:add:" + sel));
        v.setOnClickPendingIntent(R.id.cprev, act(c, CALENDAR, wid, "cnav", "-1"));
        v.setOnClickPendingIntent(R.id.cnext, act(c, CALENDAR, wid, "cnav", "1"));
        v.setOnClickPendingIntent(R.id.ctoday, act(c, CALENDAR, wid, "ctoday", ""));
        boolean onToday = "agenda".equals(mode) ? anchor.equals(todayKey) : sel.equals(todayKey);
        v.setInt(R.id.ctoday, "setBackgroundResource", onToday ? R.drawable.pill_off_bg : R.drawable.pill_bg);
        v.setTextColor(R.id.ctoday, color(c, onToday ? R.color.dd_muted : R.color.dd_accent));
        for (int i = 0; i < MODES.length; i++) {
            boolean on = MODES[i].equals(mode);
            v.setInt(MODE_BTN[i], "setBackgroundResource", on ? R.drawable.join_bg : R.drawable.pill_off_bg);
            v.setTextColor(MODE_BTN[i], color(c, on ? R.color.dd_on_accent : R.color.dd_text));
            v.setOnClickPendingIntent(MODE_BTN[i], act(c, CALENDAR, wid, "cmode", MODES[i]));
        }

        // the grid: six weeks of a month, or one week, or nothing for Day and Agenda
        int top = 24 + 38 + 40;                        // padding, title row, mode buttons
        int weeks = 0;
        String start = null, month = anchor.substring(0, 7);
        if ("month".equals(mode)) {
            String first = month + "-01";
            start = weekStart(first);
            weeks = (dayDiff(start, plusDays(plusMonths(first, 1), -1)) + 7) / 7;
        } else if ("week".equals(mode)) {
            start = weekStart(sel);
            weeks = 1;
        }
        boolean grid = weeks > 0;
        v.setViewVisibility(R.id.cgrid, grid ? View.VISIBLE : View.GONE);
        // row height: roomy when the list still fits under the grid, tighter when space is short
        int rowH = "week".equals(mode) ? 46 : 36;
        if ("month".equals(mode)) {
            int left = hDp - top - 22 - 46;
            if (left - weeks * 36 < 120) rowH = left - weeks * 30 >= 100 ? 30 : 26;
        }
        boolean dots = rowH >= 30;
        for (int r = 0; r < 6; r++) {
            v.setViewVisibility(ROWS[r], r < weeks ? View.VISIBLE : View.GONE);
            if (Build.VERSION.SDK_INT >= 31) v.setViewLayoutHeight(ROWS[r], rowH, TypedValue.COMPLEX_UNIT_DIP);
        }
        for (int n = 0; n < 42; n++) {
            int r = n / 7;
            if (!grid || r >= weeks) { v.setOnClickPendingIntent(CELL[n], act(c, CALENDAR, wid, "csel", todayKey)); continue; }
            String k = plusDays(start, n);
            boolean outside = "month".equals(mode) && !k.startsWith(month);
            cell(c, s, v, n, k, todayKey, sel, outside, dots, wid);
        }
        int gridH = grid ? 22 + weeks * rowH : 0;

        // the picked day's rows (or the agenda's days), as many as fit, with page arrows for the rest
        int avail = hDp - top - gridH - 14;
        boolean noList = "month".equals(mode) && avail < 90;
        prefs(c).edit().putString(wkey("cnolist", wid), noList ? "1" : "0").apply();
        List<WidgetRows.Row> rows = WidgetRows.build(c, CALENDAR, wid);
        if (noList) {
            v.removeAllViews(R.id.rows);
            v.setViewVisibility(R.id.rows, View.GONE);
            v.setViewVisibility(R.id.pager, View.GONE);
        } else {
            v.setViewVisibility(R.id.rows, View.VISIBLE);
            if (pages(rows, avail).size() > 1) avail -= 46;
            placeRows(c, v, CALENDAR, wid, rows, avail, false);
        }
        v.setViewVisibility(R.id.foot, View.GONE);
        return v;
    }

    /** One day of the grid: its number, the dots for what it holds, today in a filled circle, the picked day in a bordered tile. */
    private static void cell(Context c, JSONObject s, RemoteViews v, int n, String key, String todayKey, String sel, boolean outside, boolean dots, int wid) {
        boolean today = key.equals(todayKey), picked = key.equals(sel);
        v.setTextViewText(CELL_NUM[n], String.valueOf(Integer.parseInt(key.substring(8))));
        // every cell states its look both ways, so a launcher that reuses the old views can never keep a stale highlight
        v.setInt(CELL_NUM[n], "setBackgroundResource", today ? R.drawable.cal_today : 0);
        v.setTextColor(CELL_NUM[n], today ? color(c, R.color.dd_on_accent) : color(c, outside ? R.color.dd_muted : R.color.dd_text));
        v.setInt(CELL[n], "setBackgroundResource", picked ? R.drawable.cell_sel_bg : 0);
        SpannableStringBuilder b = new SpannableStringBuilder();
        if (dots) {
            List<JSONObject> items = WidgetRows.itemsOn(s, key);
            for (String kind : new String[] { "event", "due", "action", "task", "mail" }) {
                boolean has = false;
                for (JSONObject e : items) if (kind.equals(e.optString("k"))) { has = true; break; }
                if (!has) continue;
                int at = b.length();
                b.append("●");
                b.setSpan(new ForegroundColorSpan(kindColor(c, kind)), at, b.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
        }
        v.setTextViewText(CELL_DOTS[n], b);
        v.setViewVisibility(CELL_DOTS[n], dots ? View.VISIBLE : View.GONE);
        v.setOnClickPendingIntent(CELL[n], act(c, CALENDAR, wid, "csel", key));
    }
}
