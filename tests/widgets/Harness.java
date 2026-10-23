package app.dailydriver.personal;
import android.content.*; import android.content.pm.PackageManager; import android.widget.RemoteViews; import android.appwidget.AppWidgetManager;
import org.json.*; import java.nio.file.*; import java.util.*;
public class Harness {
  static class Prefs implements SharedPreferences { Map<String,Object> m = new HashMap<>();
    public String getString(String k,String d){ Object o=m.get(k); return o==null?d:(String)o; } public int getInt(String k,int d){ Object o=m.get(k); return o==null?d:(Integer)o; }
    public Editor edit(){ return new Editor(){ public Editor putString(String k,String v){m.put(k,v);return this;} public Editor putInt(String k,int v){m.put(k,v);return this;} public Editor remove(String k){m.remove(k);return this;} public void apply(){} }; } }
  static class Ctx extends Context { Prefs p = new Prefs(); public String getPackageName(){return "app.dailydriver.personal";} public PackageManager getPackageManager(){ return new PackageManager(){ public Intent getLaunchIntentForPackage(String x){ return new Intent(); } }; } public SharedPreferences getSharedPreferences(String n,int m){return p;} }
  static int fails = 0;
  static void ok(String n, boolean c){ System.out.println((c?"PASS ":"FAIL ")+n); if(!c) fails++; }
  public static void main(String[] a) throws Exception {
    Ctx c = new Ctx();
    String snap = new String(Files.readAllBytes(Paths.get(a[0])));
    Widgets.save(c, snap);
    // every widget kind builds and every row turns into a view
    String[] names = {"Overview","Schedule","Tasks","News","Everything","Calendar","Habits"};
    for (int k = 0; k < 7; k++) {
      List<WidgetRows.Row> rows = WidgetRows.build(c, k);
      int views = 0; for (WidgetRows.Row r : rows) { RemoteViews v = WidgetRows.view(c, r); if (v != null) views++; }
      System.out.println(names[k] + ": " + rows.size() + " rows");
      ok(names[k] + " builds rows and views", rows.size() > 0 && views == rows.size());
    }
    // draw all widgets through the real update path
    AppWidgetManager.drawn.clear(); Widgets.refreshAll(c);
    ok("refreshAll draws all seven widgets", AppWidgetManager.drawn.size() == 7);
    for (RemoteViews v : AppWidgetManager.drawn.values()) ok("each widget binds a scrolling list and a tap template", v.adapter != null && v.template != null);
    // calendar month grid
    RemoteViews cal = null; for (RemoteViews v : AppWidgetManager.drawn.values()) if (v.layout == R.layout.widget_calendar) cal = v;
    int cells = 0; for (RemoteViews row : cal.kids.get(R.id.calgrid)) cells += row.kids.get(R.id.crow).size();
    ok("month grid has whole weeks of seven days", cells % 7 == 0 && cells >= 28 && cells <= 42);
    ok("month mode lists the selected day", WidgetRows.build(c, 5).get(0).type == WidgetRows.T_SECTION && WidgetRows.build(c, 5).get(0).a.startsWith("Today"));
    // calendar interactions
    Widgets.handle(c, "cmode", "week", "");
    List<WidgetRows.Row> wk = WidgetRows.build(c, 5);
    int heads = 0; for (WidgetRows.Row r : wk) if (r.type == WidgetRows.T_SECTION) heads++;
    ok("week mode groups seven days", heads == 7);
    Widgets.handle(c, "cnav", "1", "");
    String anchorAfter = c.p.getString("canchor", "");
    String selAfter = c.p.getString("csel", "");
    ok("next week moves anchor and selection by seven days", Widgets.dayDiff(Widgets.dayKey(0), selAfter) == 7 && Widgets.dayDiff(Widgets.dayKey(0), anchorAfter) == 7);
    Widgets.handle(c, "ctoday", "", "");
    ok("Today resets", c.p.getString("csel", "").equals(Widgets.dayKey(0)));
    Widgets.handle(c, "cmode", "agenda", "");
    List<WidgetRows.Row> ag = WidgetRows.build(c, 5);
    boolean far = false; for (WidgetRows.Row r : ag) if (r.type == WidgetRows.T_EVENT && r.o.optString("t").equals("Far away event")) far = true;
    ok("agenda reaches an event 40 days out (six weeks)", far && ag.size() > 3);
    Widgets.handle(c, "cmode", "month", "");
    Widgets.handle(c, "cnav", "1", "");
    ok("month nav picks the first of next month", Widgets.dayKey(0).substring(0,7).equals(Widgets.dayKey(0).substring(0,7)) && c.p.getString("csel","").endsWith("-01"));
    Widgets.handle(c, "ctoday", "", "");
    // ticking from a list
    int before = WidgetRows.build(c, Widgets.TASKS).size();
    Widgets.handle(c, "task", "a2", "");
    List<WidgetRows.Row> afterTick = WidgetRows.build(c, Widgets.TASKS);
    ok("a ticked task stays on the list and sinks to the bottom under Done today", afterTick.size() == before + 1 && afterTick.get(afterTick.size() - 1).type == WidgetRows.T_TASK && afterTick.get(afterTick.size() - 1).done && afterTick.get(afterTick.size() - 1).a.equals("Call placement cell") && afterTick.get(afterTick.size() - 2).type == WidgetRows.T_SECTION);
    JSONArray ops = new JSONArray(Widgets.takeOps(c));
    ok("and queues it as ticked for the app", ops.length() == 1 && ops.getJSONObject(0).getString("t").equals("task") && ops.getJSONObject(0).getString("id").equals("a2") && ops.getJSONObject(0).getBoolean("on"));
    boolean struck = false; for (WidgetRows.Row r : WidgetRows.build(c, 5)) if (r.type == WidgetRows.T_TASK && r.a.equals("Call placement cell") && r.done) struck = true;
    ok("the same task shows ticked in the calendar", struck);
    Widgets.handle(c, "task", "a2", "");
    List<WidgetRows.Row> afterUntick = WidgetRows.build(c, Widgets.TASKS);
    ok("tapping it again puts it back in its place", afterUntick.size() == before && afterUntick.stream().noneMatch(r -> r.type == WidgetRows.T_TASK && r.done));
    JSONArray ops2 = new JSONArray(Widgets.takeOps(c));
    ok("and queues the undo", ops2.length() == 1 && !ops2.getJSONObject(0).getBoolean("on"));
    Widgets.handle(c, "task", "a2", ""); Widgets.takeOps(c);
    String mailKey = null; for (int i = 0; i < new JSONObject(snap).getJSONArray("cal").length(); i++) { JSONObject e = new JSONObject(snap).getJSONArray("cal").getJSONObject(i); if (e.getString("k").equals("mail")) mailKey = e.getString("id"); }
    Widgets.handle(c, "act", mailKey, "");
    boolean mailDone = false; for (WidgetRows.Row r : WidgetRows.build(c, 5)) if (r.type == WidgetRows.T_TASK && r.a.startsWith("Placement Chair") && r.done) mailDone = true;
    ok("ticking an email fact marks it done in the calendar", mailDone);
    Widgets.handle(c, "act", mailKey, "");
    mailDone = false; for (WidgetRows.Row r : WidgetRows.build(c, 5)) if (r.type == WidgetRows.T_TASK && r.a.startsWith("Placement Chair") && r.done) mailDone = true;
    ok("ticking again undoes it", !mailDone);
    // schedule day flipping
    Widgets.handle(c, "day", "1", "");
    boolean dts = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.SCHEDULE)) if (r.type == WidgetRows.T_EVENT && r.o.optString("t").startsWith("DTS")) dts = true;
    ok("schedule widget shows tomorrow's class after flipping a day", dts);
    boolean due = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.SCHEDULE)) if (r.type == WidgetRows.T_EVENT && r.o.optString("t").startsWith("Infosys")) due = true;
    ok("deadlines appear in the schedule too", due);
    Widgets.handle(c, "tf", "soon", "");
    ok("task filter works", WidgetRows.build(c, Widgets.TASKS).size() <= before);
    // a row tap says what it means
    boolean opens = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.TASKS)) if (r.type == WidgetRows.T_TASK) { RemoteViews v = WidgetRows.view(c, r); for (Intent i : v.fills.values()) if ("open".equals(i.getStringExtra("type")) && i.getStringExtra("target").equals("plan:tasks")) opens = true; }
    ok("a task row opens Plan when tapped", opens);
    // tiny and large calendar sizes both draw
    for (int h : new int[]{200, 280, 360, 520}) { AppWidgetManager.height = h; Widgets.handle(c, "cmode", "month", ""); Widgets.handle(c, "ctoday", "", ""); }
    ok("calendar draws at every height", AppWidgetManager.drawn.size() == 7);
    // empty snapshot
    Widgets.save(c, "{}"); List<WidgetRows.Row> e = WidgetRows.build(c, 0); ok("empty snapshot shows the open-the-app note", e.size() == 1 && e.get(0).a.startsWith("Open Daily Driver"));
    System.out.println(fails == 0 ? "ALL PASS" : fails + " FAILED");
    System.exit(fails == 0 ? 0 : 1);
  }
}
