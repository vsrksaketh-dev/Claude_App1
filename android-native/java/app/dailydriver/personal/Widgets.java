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
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Draws every Daily Driver widget from the last snapshot the app stored.
 * Each widget is a header, a row of buttons and a scrolling list (see WidgetRows and WidgetListService). Ticks, day and page
 * flips are handled here without opening the app; anything that changes the user's data is queued, and the app applies it
 * the next time it opens. The calendar widget adds a month grid or week strip above its list.
 */
public class Widgets {
    static final int OVERVIEW = 0, SCHEDULE = 1, TASKS = 2, NEWS = 3, EVERYTHING = 4, CALENDAR = 5, HABITS = 6;
    private static final String PREFS = "widgets";
    private static final String[] CATS = { "International", "Indian", "Business", "Tech" };
    private static final String[] CAT_SHORT = { "World", "India", "Business", "Tech" };
    private static final String[] MODES = { "month", "week", "agenda" };
    private static final String[] MODE_NAMES = { "Month", "Week", "Agenda" };

    // ---------- storage ----------
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void save(Context c, String json) { prefs(c).edit().putString("snapshot", json).apply(); }

    static JSONObject load(Context c) {
        try { return new JSONObject(prefs(c).getString("snapshot", "{}")); } catch (Exception e) { return new JSONObject(); }
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

    private static void queue(Context c, String type, String id) { queue(c, type, id, null); }

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

    static String dayKey(int offset) { return plusDays(key(Calendar.getInstance()), offset); }

    static String relative(long start, long now) {
        long min = Math.max(0, (start - now) / 60000);
        if (min < 1) return "starting now";
        if (min < 60) return "in " + min + " min";
        long h = min / 60, r = min % 60;
        return "in " + h + " h" + (r >= 15 ? " " + r + " min" : "");
    }

    // ---------- taps that do not open the app ----------
    static synchronized void handle(Context c, String type, String id, String arg) {
        if (type == null) return;
        if (id == null) id = "";
        JSONObject s = load(c);
        SharedPreferences.Editor e = prefs(c).edit();
        try {
            switch (type) {
                case "task": {
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
                    break;
                }
                case "act": {
                    s.put("actions", without(s.optJSONArray("actions"), id));
                    mark(s, id, false, false);
                    queue(c, "act", id);
                    break;
                }
                case "habit": {
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
                    queue(c, "habit", id);
                    break;
                }
                case "day": e.putInt("day", Integer.parseInt(id)); break;
                case "ncat": e.putString("ncat", id); break;
                case "tf": e.putString("tf", id); break;
                case "cmode": {
                    String sel = prefs(c).getString("csel", dayKey(0));
                    e.putString("cmode", id).putString("canchor", "agenda".equals(id) ? dayKey(0) : sel);
                    break;
                }
                case "ctoday": e.putString("csel", dayKey(0)).putString("canchor", dayKey(0)); break;
                case "csel": {
                    String anchor = prefs(c).getString("canchor", dayKey(0));
                    e.putString("csel", id);
                    if ("month".equals(prefs(c).getString("cmode", "month")) && !id.substring(0, 7).equals(anchor.substring(0, 7))) e.putString("canchor", id);
                    break;
                }
                case "cnav": {
                    int dir = Integer.parseInt(id);
                    String mode = prefs(c).getString("cmode", "month");
                    String anchor = prefs(c).getString("canchor", dayKey(0));
                    String sel = prefs(c).getString("csel", dayKey(0));
                    if ("month".equals(mode)) {
                        String a = plusMonths(anchor, dir);
                        e.putString("canchor", a).putString("csel", a.substring(0, 7).equals(dayKey(0).substring(0, 7)) ? dayKey(0) : a);
                    } else if ("week".equals(mode)) {
                        e.putString("canchor", plusDays(anchor, 7 * dir)).putString("csel", plusDays(sel, 7 * dir));
                    } else {
                        e.putString("canchor", plusDays(anchor, 14 * dir));
                    }
                    break;
                }
                default: break;
            }
        } catch (Exception ignored) { }
        e.apply();
        save(c, s.toString());
        refreshAll(c);
    }

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
    static void refreshAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        Class<?>[] kinds = { OverviewWidget.class, ScheduleWidget.class, TasksWidget.class, NewsWidget.class, EverythingWidget.class, CalendarWidget.class, HabitsWidget.class };
        for (int k = 0; k < kinds.length; k++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, kinds[k]));
            if (ids.length > 0) update(c, m, ids, k);
        }
    }

    static void update(Context c, AppWidgetManager m, int[] ids, int kind) {
        JSONObject s = load(c);
        for (int id : ids) {
            Bundle o = m.getAppWidgetOptions(id);
            int h = o == null ? 250 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 250);
            int w = o == null ? 250 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            try { m.updateAppWidget(id, build(c, kind, s, h, w, id)); } catch (Exception ignored) { }
        }
        try { m.notifyAppWidgetViewDataChanged(ids, R.id.list); } catch (Exception ignored) { }
    }

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

    private static PendingIntent open(Context c, String target) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(pkg(c));
        if (i == null) i = new Intent();
        i.putExtra("target", target);
        return PendingIntent.getActivity(c, 100 + (target.hashCode() & 0xffff), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent act(Context c, String type, String id) {
        Intent i = new Intent(c, WidgetActionReceiver.class);
        i.setData(Uri.parse("dd://act/" + type + "/" + Uri.encode(id)));
        i.putExtra("type", type);
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** One template per widget: every row in the list "fills in" what it means (open a tab, tick, flip a day, open a link). */
    private static PendingIntent template(Context c, int widgetId) {
        Intent i = new Intent(c, WidgetRouteActivity.class);
        i.setAction("app.dailydriver.personal.ROW");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getActivity(c, 5000 + widgetId, i, flags);
    }

    private static Intent adapter(Context c, int kind, int widgetId) {
        Intent i = new Intent(c, WidgetListService.class);
        i.putExtra("kind", kind);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        i.setData(Uri.parse(i.toUri(Intent.URI_INTENT_SCHEME)));
        return i;
    }

    private static void bindList(Context c, RemoteViews v, int kind, int widgetId) {
        v.setRemoteAdapter(R.id.list, adapter(c, kind, widgetId));
        v.setPendingIntentTemplate(R.id.list, template(c, widgetId));
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
        v.setTextViewText(R.id.tag, tag);
        v.setViewVisibility(R.id.tag, tag.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private static void pill(Context c, RemoteViews v, int box, String text, boolean on, PendingIntent pi) {
        RemoteViews p = new RemoteViews(pkg(c), R.layout.pill);
        p.setTextViewText(R.id.pill, text);
        p.setInt(R.id.pill, "setBackgroundResource", on ? R.drawable.pill_bg : R.drawable.pill_off_bg);
        p.setTextColor(R.id.pill, color(c, on ? R.color.dd_accent : R.color.dd_muted));
        if (pi != null) p.setOnClickPendingIntent(R.id.pill, pi);
        v.addView(box, p);
    }

    private static void showPills(RemoteViews v) { v.setViewVisibility(R.id.pills, View.VISIBLE); }

    private static void showFoot(RemoteViews v) { v.setViewVisibility(R.id.foot, View.VISIBLE); }

    // ---------- the widgets ----------
    private static RemoteViews build(Context c, int kind, JSONObject s, int hDp, int wDp, int widgetId) {
        if (kind == CALENDAR) return buildCalendar(c, s, hDp, wDp, widgetId);
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_card);
        long now = System.currentTimeMillis();
        String name = s.optString("name", ""), date = fmt("EEEE d MMMM", now);
        boolean empty = s.length() == 0;
        String target = kind == TASKS ? "plan:tasks" : kind == NEWS ? "learn:news" : kind == HABITS ? "track:trackers" : "home";
        v.setOnClickPendingIntent(R.id.root, open(c, target));
        v.removeAllViews(R.id.pills);
        v.removeAllViews(R.id.foot);
        v.setViewVisibility(R.id.pills, View.GONE);
        v.setViewVisibility(R.id.foot, View.GONE);
        switch (kind) {
            case OVERVIEW: {
                head(v, greeting(name), date, "");
                if (!empty) {
                    showFoot(v);
                    pill(c, v, R.id.foot, "Capture", true, open(c, "home:capture"));
                    pill(c, v, R.id.foot, "Focus", false, open(c, "track:mind:focus"));
                    pill(c, v, R.id.foot, "Journal", false, open(c, "track:mind:journal"));
                }
                break;
            }
            case SCHEDULE: {
                int day = prefs(c).getInt("day", 0);
                head(v, "Schedule", fmt("EEEE d MMM", now + day * 86400000L), day == 0 ? "Today" : day == 1 ? "Tomorrow" : day == -1 ? "Yesterday" : "");
                if (!empty) {
                    showPills(v);
                    pill(c, v, R.id.pills, "‹", false, act(c, "day", String.valueOf(Math.max(-14, day - 1))));
                    pill(c, v, R.id.pills, "Today", day == 0, act(c, "day", "0"));
                    pill(c, v, R.id.pills, "›", false, act(c, "day", String.valueOf(Math.min(60, day + 1))));
                    pill(c, v, R.id.pills, "Calendar", false, open(c, "calendar:day:" + dayKey(day)));
                }
                break;
            }
            case TASKS: {
                String tf = prefs(c).getString("tf", "all");
                head(v, "Tasks", s.optInt("dueSoon") > 0 ? s.optInt("dueSoon") + " due soon" : "Nothing urgent", empty ? "" : s.optInt("taskCount") + " open");
                if (!empty) {
                    showPills(v);
                    pill(c, v, R.id.pills, "All", tf.equals("all"), act(c, "tf", "all"));
                    pill(c, v, R.id.pills, "Due soon", tf.equals("soon"), act(c, "tf", "soon"));
                    pill(c, v, R.id.pills, "+ Add task", false, open(c, "plan:tasks:add"));
                }
                break;
            }
            case NEWS: {
                String cat = prefs(c).getString("ncat", "");
                head(v, "News", empty ? "" : "Worth knowing today", "");
                if (!empty) {
                    showPills(v);
                    pill(c, v, R.id.pills, "All", cat.isEmpty(), act(c, "ncat", ""));
                    for (int i = 0; i < CATS.length; i++) pill(c, v, R.id.pills, CAT_SHORT[i], cat.equals(CATS[i]), act(c, "ncat", CATS[i]));
                }
                break;
            }
            case HABITS: {
                JSONObject h = s.optJSONObject("habits");
                head(v, "Habits", empty ? "" : (h == null ? 0 : h.optInt("done")) + " of " + (h == null ? 0 : h.optInt("total")) + " done today", empty || h == null ? "" : h.optInt("streak") + " day streak");
                if (!empty) {
                    showFoot(v);
                    pill(c, v, R.id.foot, "Open Track", true, open(c, "track:trackers"));
                    pill(c, v, R.id.foot, "Journal", false, open(c, "track:mind:journal"));
                }
                break;
            }
            default: {
                head(v, greeting(name), date, "");
                if (!empty) {
                    showPills(v);
                    pill(c, v, R.id.pills, "Home", true, open(c, "home"));
                    pill(c, v, R.id.pills, "Plan", false, open(c, "plan:tasks"));
                    pill(c, v, R.id.pills, "Calendar", false, open(c, "calendar:month"));
                    pill(c, v, R.id.pills, "Track", false, open(c, "track:trackers"));
                }
            }
        }
        bindList(c, v, kind, widgetId);
        return v;
    }

    // ---------- the calendar widget ----------
    private static RemoteViews buildCalendar(Context c, JSONObject s, int hDp, int wDp, int widgetId) {
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_calendar);
        String todayKey = dayKey(0);
        String mode = prefs(c).getString("cmode", "month");
        String sel = prefs(c).getString("csel", todayKey);
        String anchor = prefs(c).getString("canchor", sel);
        v.setOnClickPendingIntent(R.id.root, open(c, "calendar:" + mode));
        v.removeAllViews(R.id.cmodes);
        v.removeAllViews(R.id.calgrid);
        v.removeAllViews(R.id.calweek);

        // title and navigation
        String title = "month".equals(mode) ? fmt(wDp >= 300 ? "MMMM yyyy" : "MMM yyyy", cal(anchor).getTimeInMillis())
            : "week".equals(mode) ? fmt("d MMM", cal(weekStart(anchor)).getTimeInMillis()) + " – " + fmt("d MMM", cal(plusDays(weekStart(anchor), 6)).getTimeInMillis())
            : "Agenda";
        v.setTextViewText(R.id.ctitle, title);
        v.setOnClickPendingIntent(R.id.ctitle, open(c, "calendar:" + mode));
        v.setOnClickPendingIntent(R.id.cprev, act(c, "cnav", "-1"));
        v.setOnClickPendingIntent(R.id.cnext, act(c, "cnav", "1"));
        v.setOnClickPendingIntent(R.id.ctoday, act(c, "ctoday", ""));
        for (int i = 0; i < MODES.length; i++) pill(c, v, R.id.cmodes, MODE_NAMES[i], MODES[i].equals(mode), act(c, "cmode", MODES[i]));

        boolean grid = !"agenda".equals(mode);
        v.setViewVisibility(R.id.cwk, grid ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.calgrid, "month".equals(mode) ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.calweek, "week".equals(mode) ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.list, View.VISIBLE);

        int avail = hDp - 106;
        if ("month".equals(mode)) {
            String first = anchor.substring(0, 8) + "01";
            String start = weekStart(first);
            int days = dayDiff(start, plusDays(plusMonths(first, 1), -1)) + 1;
            int weeks = (days + 6) / 7;
            boolean roomy = avail >= weeks * 34 + 90;       // full-size rows and a list under the grid
            boolean listFits = avail >= weeks * 26 + 90;    // compact rows and a list
            boolean showList = roomy || listFits;
            boolean small = !(roomy || (!listFits && avail >= weeks * 34));   // otherwise: full rows, grid alone
            for (int w = 0; w < weeks; w++) {
                RemoteViews row = new RemoteViews(pkg(c), small ? R.layout.cal_row_c : R.layout.cal_row);
                for (int d = 0; d < 7; d++) {
                    String k = plusDays(start, w * 7 + d);
                    row.addView(R.id.crow, cell(c, s, k, todayKey, sel, !k.substring(0, 7).equals(first.substring(0, 7)), small));
                }
                v.addView(R.id.calgrid, row);
            }
            if (!showList) v.setViewVisibility(R.id.list, View.GONE);
        } else if ("week".equals(mode)) {
            String start = weekStart(anchor);
            RemoteViews row = new RemoteViews(pkg(c), R.layout.cal_row_w);
            for (int d = 0; d < 7; d++) row.addView(R.id.crow, cell(c, s, plusDays(start, d), todayKey, sel, false, false));
            v.addView(R.id.calweek, row);
        }
        bindList(c, v, CALENDAR, widgetId);
        if ("week".equals(mode)) {
            List<WidgetRows.Row> rows = WidgetRows.build(c, CALENDAR);
            int at = WidgetRows.headingIndex(rows, sel);
            if (at > 0) v.setScrollPosition(R.id.list, at);
        }
        return v;
    }

    /** One day of the grid: its number, the dots for what it holds, today in a filled circle, the picked day tinted. */
    private static RemoteViews cell(Context c, JSONObject s, String key, String todayKey, String sel, boolean outside, boolean small) {
        RemoteViews v = new RemoteViews(pkg(c), R.layout.cal_cell);
        v.setTextViewText(R.id.dn, String.valueOf(Integer.parseInt(key.substring(8))));
        boolean today = key.equals(todayKey);
        if (today) { v.setInt(R.id.dn, "setBackgroundResource", R.drawable.cal_today); v.setTextColor(R.id.dn, color(c, R.color.dd_on_accent)); }
        else v.setTextColor(R.id.dn, color(c, outside ? R.color.dd_muted : R.color.dd_text));
        if (key.equals(sel)) v.setInt(R.id.cellroot, "setBackgroundResource", R.drawable.cell_sel_bg);
        List<JSONObject> items = WidgetRows.itemsOn(s, key);
        if (small || items.isEmpty()) v.setViewVisibility(R.id.dots, small ? View.GONE : View.INVISIBLE);
        else {
            String[] order = { "event", "due", "action", "task", "mail" };
            SpannableStringBuilder b = new SpannableStringBuilder();
            for (String kind : order) {
                boolean has = false;
                for (JSONObject e : items) if (kind.equals(e.optString("k"))) { has = true; break; }
                if (!has) continue;
                int at = b.length();
                b.append("●");
                b.setSpan(new ForegroundColorSpan(kindColor(c, kind)), at, b.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            v.setTextViewText(R.id.dots, b);
        }
        v.setOnClickPendingIntent(R.id.cellroot, act(c, "csel", key));
        return v;
    }
}
