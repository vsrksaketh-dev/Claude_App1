package app.dailydriver.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
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
 * Draws every Daily Driver widget from the last snapshot the app stored.
 * Widgets are interactive: ticks and page flips are handled here without opening the app, and anything that changes
 * the user's data is queued so the app can apply it the next time it opens. A bigger widget shows more, and more detail.
 */
public class Widgets {
    static final int OVERVIEW = 0, SCHEDULE = 1, TASKS = 2, NEWS = 3, EVERYTHING = 4;
    private static final String PREFS = "widgets";
    private static final String[] CATS = { "International", "Indian", "Business", "Tech" };
    private static final String[] CAT_SHORT = { "World", "India", "Business", "Tech" };

    // ---------- storage ----------
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void save(Context c, String json) { prefs(c).edit().putString("snapshot", json).apply(); }

    private static JSONObject load(Context c) {
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

    private static void queue(Context c, String type, String id) {
        try {
            JSONArray ops = new JSONArray(prefs(c).getString("ops", "[]"));
            ops.put(new JSONObject().put("t", type).put("id", id));
            prefs(c).edit().putString("ops", ops.toString()).apply();
        } catch (Exception ignored) { }
    }

    // ---------- taps that do not open the app ----------
    static synchronized void handle(Context c, String type, String id, String arg) {
        if (type == null) return;
        JSONObject s = load(c);
        SharedPreferences.Editor e = prefs(c).edit();
        try {
            switch (type) {
                case "task": {
                    s.put("tasks", without(s.optJSONArray("tasks"), id));
                    s.put("taskCount", Math.max(0, s.optInt("taskCount") - 1));
                    queue(c, "task", id);
                    break;
                }
                case "act": {
                    s.put("actions", without(s.optJSONArray("actions"), id));
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
                case "ncat": e.putString("ncat", id).putInt("npage", 0); break;
                case "npage": e.putInt("npage", Math.max(0, prefs(c).getInt("npage", 0) + Integer.parseInt(id))); break;
                case "tf": e.putString("tf", id); break;
                default: break;
            }
        } catch (Exception ignored) { }
        e.apply();
        save(c, s.toString());
        refreshAll(c);
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
        Class<?>[] kinds = { OverviewWidget.class, ScheduleWidget.class, TasksWidget.class, NewsWidget.class, EverythingWidget.class };
        for (int k = 0; k < kinds.length; k++) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, kinds[k]));
            if (ids.length > 0) update(c, m, ids, k);
        }
    }

    static void update(Context c, AppWidgetManager m, int[] ids, int kind) {
        JSONObject s = load(c);
        for (int id : ids) {
            Bundle o = m.getAppWidgetOptions(id);
            int h = o == null ? 200 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200);
            m.updateAppWidget(id, build(c, kind, s, h));
        }
    }

    // ---------- helpers ----------
    private static String pkg(Context c) { return c.getPackageName(); }
    private static int color(Context c, int id) { return ContextCompat.getColor(c, id); }
    private static String fmt(String pattern, long ms) { return new SimpleDateFormat(pattern, Locale.ENGLISH).format(new Date(ms)); }
    private static String dayKey(int offset) { return fmt("yyyy-MM-dd", System.currentTimeMillis() + offset * 86400000L); }

    private static class Budget {
        int left;
        Budget(int dp) { left = dp; }
        boolean take(int cost) { if (cost <= left) { left -= cost; return true; } return false; }
        boolean fits(int cost) { return cost <= left; }
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

    private static PendingIntent view(Context c, String url) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

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

    private static JSONArray arr(JSONObject s, String k) { JSONArray a = s.optJSONArray(k); return a == null ? new JSONArray() : a; }

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

    private static void progress(Context c, RemoteViews v, String label, String value, int pct) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_progress);
        r.setTextViewText(R.id.pl, label);
        r.setTextViewText(R.id.pv, value);
        r.setProgressBar(R.id.pb, 100, Math.max(0, Math.min(100, pct)), false);
        v.addView(R.id.rows, r);
    }

    private static void ringRow(Context c, RemoteViews v, String title, String sub, String due, String dueStyle, boolean done, PendingIntent ring, PendingIntent body) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_task);
        r.setTextViewText(R.id.tk, title);
        r.setTextColor(R.id.tk, color(c, done ? R.color.dd_muted : R.color.dd_text));
        if (sub != null && !sub.isEmpty()) { r.setTextViewText(R.id.tk2, sub); r.setViewVisibility(R.id.tk2, View.VISIBLE); }
        if (done) r.setImageViewResource(R.id.ring, R.drawable.ring_done);
        if (due == null || due.isEmpty()) r.setViewVisibility(R.id.due, View.GONE);
        else {
            r.setTextViewText(R.id.due, due);
            if ("bad".equals(dueStyle)) { r.setInt(R.id.due, "setBackgroundResource", R.drawable.pill_bad_bg); r.setTextColor(R.id.due, color(c, R.color.dd_bad)); }
            else if ("warn".equals(dueStyle)) { r.setInt(R.id.due, "setBackgroundResource", R.drawable.pill_warn_bg); r.setTextColor(R.id.due, color(c, R.color.dd_warn)); }
        }
        if (ring != null) r.setOnClickPendingIntent(R.id.ring, ring);
        if (body != null) r.setOnClickPendingIntent(R.id.rowroot, body);
        v.addView(R.id.rows, r);
    }

    private static void taskRow(Context c, RemoteViews v, JSONObject x, boolean detail) {
        String due = x.optString("due");
        String style = due.equals("Overdue") || due.equals("Today") ? "bad" : due.equals("Tomorrow") ? "warn" : "";
        String sub = "";
        if (detail) {
            String q = x.optString("q"), kind = x.optString("kind");
            String ql = q.equals("UI") ? "Do first" : q.equals("I") ? "Important" : q.equals("U") ? "Quick" : "Later";
            sub = kind.isEmpty() ? ql : kind + "  ·  " + ql;
        }
        ringRow(c, v, x.optString("title"), sub, due, style, false, act(c, "task", x.optString("id")), open(c, "plan:tasks"));
    }

    private static void attentionRow(Context c, RemoteViews v, JSONObject m) {
        if (m.optBoolean("mail")) { ringRow(c, v, m.optString("title"), "", "Mail", "", false, act(c, "act", m.optString("id")), open(c, "home")); return; }
        boolean today = fmt("yyyy-MM-dd", m.optLong("s")).equals(dayKey(0));
        ringRow(c, v, m.optString("title"), "", today ? fmt("h:mm a", m.optLong("s")) : fmt("EEE", m.optLong("s")), today ? "bad" : "warn", false, act(c, "act", m.optString("id")), open(c, "home"));
    }

    private static void habitRow(Context c, RemoteViews v, JSONObject h) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_habit);
        boolean done = h.optBoolean("done");
        r.setTextViewText(R.id.hb, h.optString("name"));
        r.setTextColor(R.id.hb, color(c, done ? R.color.dd_muted : R.color.dd_text));
        r.setTextViewText(R.id.hs, done ? "Done" : "");
        if (done) r.setImageViewResource(R.id.ring, R.drawable.ring_done);
        r.setOnClickPendingIntent(R.id.ring, act(c, "habit", h.optString("id")));
        r.setOnClickPendingIntent(R.id.rowroot, open(c, "track:trackers"));
        v.addView(R.id.rows, r);
    }

    private static void eventRow(Context c, RemoteViews v, JSONObject e, long now, boolean detail) {
        long s = e.optLong("s"), en = e.optLong("e");
        boolean all = e.optBoolean("allDay"), live = !all && s <= now && en > now;
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_event);
        if (all) { r.setTextViewText(R.id.tm, "All day"); r.setTextViewText(R.id.tm2, ""); }
        else if (live) { r.setTextViewText(R.id.tm, "Now"); r.setTextViewText(R.id.tm2, "until " + fmt("h:mm", en)); r.setTextColor(R.id.tm, color(c, R.color.dd_accent)); }
        else { r.setTextViewText(R.id.tm, fmt("h:mm", s)); r.setTextViewText(R.id.tm2, fmt("a", s)); }
        r.setTextViewText(R.id.ev, e.optString("title"));
        String where = e.optString("where");
        String meta = all ? "" : fmt("h:mm", s) + " to " + fmt("h:mm a", en);
        if (!where.isEmpty()) meta = meta.isEmpty() ? where : meta + "  ·  " + where;
        r.setTextViewText(R.id.ev2, meta);
        r.setViewVisibility(R.id.ev2, detail && !meta.isEmpty() ? View.VISIBLE : View.GONE);
        if (live) r.setInt(R.id.evroot, "setBackgroundResource", R.drawable.now_bg);
        else if (all) r.setInt(R.id.bar, "setBackgroundResource", R.drawable.bar_muted);
        r.setOnClickPendingIntent(R.id.evroot, open(c, "home"));
        v.addView(R.id.rows, r);
    }

    private static void newsRow(Context c, RemoteViews v, JSONObject n, int level) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_news);
        r.setTextViewText(R.id.cat, (n.optString("cat") + (n.optString("src").isEmpty() ? "" : "  ·  " + n.optString("src"))).toUpperCase(Locale.ENGLISH));
        r.setTextViewText(R.id.nt, n.optString("title"));
        if (level >= 1 && !n.optString("summary").isEmpty()) { r.setTextViewText(R.id.ns, n.optString("summary")); r.setInt(R.id.ns, "setMaxLines", level >= 2 ? 3 : 2); }
        else r.setViewVisibility(R.id.ns, View.GONE);
        if (level >= 2 && !n.optString("why").isEmpty()) r.setTextViewText(R.id.nw, "Why it matters: " + n.optString("why"));
        else r.setViewVisibility(R.id.nw, View.GONE);
        String url = n.optString("url");
        if (url.startsWith("http")) r.setOnClickPendingIntent(R.id.read, view(c, url)); else r.setViewVisibility(R.id.read, View.GONE);
        r.setOnClickPendingIntent(R.id.rowroot, open(c, "learn:news"));
        v.addView(R.id.rows, r);
    }

    private static List<JSONObject> upcoming(JSONObject s, long now, String day) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray ev = arr(s, "events");
        for (int i = 0; i < ev.length(); i++) {
            JSONObject e = ev.optJSONObject(i);
            if (e == null || e.optLong("e") <= now) continue;
            if (day != null && !day.equals(e.optString("d", dayKey(0)))) continue;
            out.add(e);
        }
        return out;
    }

    private static void nextUp(Context c, RemoteViews v, JSONObject s, long now) {
        JSONObject pick = null;
        for (JSONObject e : upcoming(s, now, null)) { if (!e.optBoolean("allDay")) { pick = e; break; } }
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

    private static void tiles(Context c, RemoteViews v, JSONObject s) {
        RemoteViews r = new RemoteViews(pkg(c), R.layout.row_stats);
        JSONObject h = s.optJSONObject("habits");
        r.setTextViewText(R.id.n1, s.optInt("focusMin") + "m");
        r.setTextViewText(R.id.l1, "focus today");
        r.setTextViewText(R.id.n2, s.optInt("learn") + "/5");
        r.setTextViewText(R.id.l2, "learning");
        r.setTextViewText(R.id.n3, String.valueOf(h == null ? 0 : h.optInt("streak")));
        r.setTextViewText(R.id.l3, "day streak");
        v.addView(R.id.rows, r);
    }

    private static void habitProgress(Context c, RemoteViews v, JSONObject s) {
        JSONObject h = s.optJSONObject("habits");
        int total = h == null ? 0 : h.optInt("total"), done = h == null ? 0 : h.optInt("done");
        progress(c, v, "Habits today", done + " of " + total, total == 0 ? 0 : done * 100 / total);
    }

    // ---------- the five widgets ----------
    private static RemoteViews build(Context c, int kind, JSONObject s, int hDp) {
        RemoteViews v = new RemoteViews(pkg(c), R.layout.widget_card);
        long now = System.currentTimeMillis();
        String name = s.optString("name", ""), date = fmt("EEEE d MMMM", now);
        boolean empty = s.length() == 0;
        String target = kind == TASKS ? "plan:tasks" : kind == NEWS ? "learn:news" : "home";
        v.setOnClickPendingIntent(R.id.root, open(c, target));
        v.removeAllViews(R.id.rows);
        v.removeAllViews(R.id.pills);
        v.removeAllViews(R.id.foot);
        v.setViewVisibility(R.id.pills, View.GONE);
        v.setViewVisibility(R.id.foot, View.GONE);
        int body = hDp - 32 - 44;
        switch (kind) {
            case OVERVIEW: overview(c, v, s, now, name, date, body, empty); break;
            case SCHEDULE: scheduleWidget(c, v, s, now, body, empty); break;
            case TASKS: tasksWidget(c, v, s, body, empty); break;
            case NEWS: newsWidget(c, v, s, body, empty); break;
            default: everything(c, v, s, now, name, date, body, empty);
        }
        return v;
    }

    private static void showPills(RemoteViews v) { v.setViewVisibility(R.id.pills, View.VISIBLE); }
    private static void showFoot(RemoteViews v) { v.setViewVisibility(R.id.foot, View.VISIBLE); }

    private static void overview(Context c, RemoteViews v, JSONObject s, long now, String name, String date, int body, boolean empty) {
        head(v, greeting(name), date, "");
        if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); return; }
        showFoot(v);
        pill(c, v, R.id.foot, "Capture", true, open(c, "home:capture"));
        pill(c, v, R.id.foot, "Focus", false, open(c, "track:mind:focus"));
        pill(c, v, R.id.foot, "Journal", false, open(c, "track:mind:journal"));
        Budget b = new Budget(body - 44);
        if (b.take(92)) nextUp(c, v, s, now);
        JSONObject h = s.optJSONObject("habits");
        if (h != null && h.optInt("total") > 0 && b.take(38)) habitProgress(c, v, s);
        if (b.take(72)) tiles(c, v, s);
        JSONArray ac = arr(s, "actions");
        boolean sec = false;
        for (int i = 0; i < ac.length() && i < 3; i++) {
            if (!sec) { if (!b.take(26 + 38)) break; section(c, v, "Needs you"); sec = true; } else if (!b.take(38)) break;
            attentionRow(c, v, ac.optJSONObject(i));
        }
        JSONArray hl = arr(s, "habitList");
        sec = false;
        for (int i = 0; i < hl.length() && i < 5; i++) {
            if (!sec) { if (!b.take(26 + 38)) break; section(c, v, "Tap to tick off"); sec = true; } else if (!b.take(38)) break;
            habitRow(c, v, hl.optJSONObject(i));
        }
    }

    private static void scheduleWidget(Context c, RemoteViews v, JSONObject s, long now, int body, boolean empty) {
        int day = prefs(c).getInt("day", 0);
        String key = dayKey(day);
        List<JSONObject> list = upcoming(s, now, key);
        head(v, "Schedule", fmt("EEEE d MMM", now + day * 86400000L), empty ? "" : list.size() + (day == 0 ? " left" : " planned"));
        if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); return; }
        showPills(v);
        pill(c, v, R.id.pills, "Today", day == 0, act(c, "day", "0"));
        pill(c, v, R.id.pills, "Tomorrow", day == 1, act(c, "day", "1"));
        pill(c, v, R.id.pills, fmt("EEE", now + 2 * 86400000L), day == 2, act(c, "day", "2"));
        boolean detail = body > 230;
        int cost = detail ? 50 : 42;
        Budget b = new Budget(body - 40);
        int shown = 0;
        for (JSONObject e : list) {
            if (!b.take(cost)) break;
            eventRow(c, v, e, now, detail);
            shown++;
        }
        if (list.size() > shown) {
            showFoot(v);
            pill(c, v, R.id.foot, "+" + (list.size() - shown) + " more", false, open(c, "home"));
        }
        if (list.isEmpty()) note(c, v, day == 0 ? "Nothing left today. A free stretch is a good time to focus." : "Nothing planned. A clear day.");
    }

    private static void tasksWidget(Context c, RemoteViews v, JSONObject s, int body, boolean empty) {
        String tf = prefs(c).getString("tf", "all");
        head(v, "Tasks", s.optInt("dueSoon") > 0 ? s.optInt("dueSoon") + " due soon" : "Nothing urgent", empty ? "" : s.optInt("taskCount") + " open");
        if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); return; }
        showPills(v);
        pill(c, v, R.id.pills, "All", tf.equals("all"), act(c, "tf", "all"));
        pill(c, v, R.id.pills, "Due soon", tf.equals("soon"), act(c, "tf", "soon"));
        pill(c, v, R.id.pills, "+ Add task", false, open(c, "plan:tasks:add"));
        boolean detail = body > 240, grouped = body > 330;
        List<JSONObject> list = new ArrayList<>();
        JSONArray t = arr(s, "tasks");
        for (int i = 0; i < t.length(); i++) {
            JSONObject x = t.optJSONObject(i);
            if (x == null) continue;
            String due = x.optString("due");
            if (tf.equals("soon") && !(due.equals("Overdue") || due.equals("Today") || due.equals("Tomorrow"))) continue;
            list.add(x);
        }
        Budget b = new Budget(body - 40);
        String lastQ = null;
        int shown = 0;
        for (JSONObject x : list) {
            String q = x.optString("q");
            boolean head = grouped && !q.equals(lastQ);
            int cost = (detail ? 48 : 38) + (head ? 26 : 0);
            if (!b.take(cost)) break;
            if (head) { section(c, v, q.equals("UI") ? "Do first" : q.equals("I") ? "Schedule it" : q.equals("U") ? "Quick wins" : "Later"); lastQ = q; }
            taskRow(c, v, x, detail);
            shown++;
        }
        if (list.isEmpty()) note(c, v, tf.equals("soon") ? "Nothing due soon. Nice." : "Nothing left to do. Enjoy the quiet.");
        else if (list.size() > shown) { showFoot(v); pill(c, v, R.id.foot, "+" + (list.size() - shown) + " more in Plan", false, open(c, "plan:tasks")); }
    }

    private static void newsWidget(Context c, RemoteViews v, JSONObject s, int body, boolean empty) {
        String cat = prefs(c).getString("ncat", "");
        head(v, "News", empty ? "" : "Worth knowing today", "");
        if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); return; }
        showPills(v);
        pill(c, v, R.id.pills, "All", cat.isEmpty(), act(c, "ncat", ""));
        for (int i = 0; i < CATS.length; i++) pill(c, v, R.id.pills, CAT_SHORT[i], cat.equals(CATS[i]), act(c, "ncat", CATS[i]));
        List<JSONObject> list = new ArrayList<>();
        JSONArray n = arr(s, "news");
        for (int i = 0; i < n.length(); i++) {
            JSONObject x = n.optJSONObject(i);
            if (x != null && (cat.isEmpty() || cat.equals(x.optString("cat")))) list.add(x);
        }
        int avail = body - 40 - 44;
        int level = avail >= 330 ? 2 : avail >= 200 ? 1 : 0;
        int per = level == 2 ? 135 : level == 1 ? 104 : 74;
        int count = Math.max(1, avail / per);
        int pages = Math.max(1, (list.size() + count - 1) / count);
        int page = Math.min(prefs(c).getInt("npage", 0), pages - 1);
        for (int i = page * count; i < Math.min(list.size(), page * count + count); i++) newsRow(c, v, list.get(i), level);
        if (list.isEmpty()) note(c, v, "No headlines here yet. They land every morning.");
        else {
            showFoot(v);
            pill(c, v, R.id.foot, "Prev", false, page > 0 ? act(c, "npage", "-1") : null);
            pill(c, v, R.id.foot, (page + 1) + " of " + pages, true, null);
            pill(c, v, R.id.foot, "Next", false, page < pages - 1 ? act(c, "npage", "1") : null);
        }
    }

    private static void everything(Context c, RemoteViews v, JSONObject s, long now, String name, String date, int body, boolean empty) {
        head(v, greeting(name), date, "");
        if (empty) { note(c, v, "Open Daily Driver once and I will fill this in."); return; }
        showPills(v);
        pill(c, v, R.id.pills, "Home", true, open(c, "home"));
        pill(c, v, R.id.pills, "Learn", false, open(c, "learn:daily"));
        pill(c, v, R.id.pills, "Plan", false, open(c, "plan:tasks"));
        pill(c, v, R.id.pills, "Track", false, open(c, "track:trackers"));
        Budget b = new Budget(body - 40);
        if (b.take(92)) nextUp(c, v, s, now);
        if (b.take(72)) tiles(c, v, s);
        JSONArray ac = arr(s, "actions"), hl = arr(s, "habitList"), tk = arr(s, "tasks"), nw = arr(s, "news");
        List<JSONObject> ev = upcoming(s, now, dayKey(0));
        if (ev.isEmpty()) ev = upcoming(s, now, null);
        int[] max = { Math.min(2, ac.length()), Math.min(4, ev.size()), Math.min(4, tk.length()), Math.min(3, hl.length()), Math.min(3, nw.length()) };
        int[] cost = { 38, 44, 38, 38, 62 };
        int[] got = new int[5];
        boolean progressed = true;
        while (progressed) {
            progressed = false;
            for (int k = 0; k < 5; k++) {
                if (got[k] >= max[k]) continue;
                int need = cost[k] + (got[k] == 0 ? 26 : 0);
                if (b.take(need)) { got[k]++; progressed = true; }
            }
        }
        if (got[0] > 0) { section(c, v, "Needs you"); for (int i = 0; i < got[0]; i++) attentionRow(c, v, ac.optJSONObject(i)); }
        if (got[1] > 0) { section(c, v, "Schedule"); for (int i = 0; i < got[1]; i++) eventRow(c, v, ev.get(i), now, false); }
        if (got[2] > 0) { section(c, v, "Tasks"); for (int i = 0; i < got[2]; i++) taskRow(c, v, tk.optJSONObject(i), false); }
        if (got[3] > 0) { section(c, v, "Habits"); for (int i = 0; i < got[3]; i++) habitRow(c, v, hl.optJSONObject(i)); }
        if (got[4] > 0) { section(c, v, "News"); for (int i = 0; i < got[4]; i++) newsRow(c, v, nw.optJSONObject(i), 0); }
    }
}
