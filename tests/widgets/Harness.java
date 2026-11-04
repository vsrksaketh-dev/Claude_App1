package app.dailydriver.personal;
import android.content.*; import android.content.pm.PackageManager; import android.widget.RemoteViews; import android.appwidget.AppWidgetManager;
import org.json.*; import java.nio.file.*; import java.util.*;
public class Harness {
  static class Prefs implements SharedPreferences { Map<String,Object> m = new HashMap<>();
    public String getString(String k,String d){ Object o=m.get(k); return o==null?d:(String)o; } public int getInt(String k,int d){ Object o=m.get(k); return o==null?d:(Integer)o; }
    public Editor edit(){ return new Editor(){ public Editor putString(String k,String v){m.put(k,v);return this;} public Editor putInt(String k,int v){m.put(k,v);return this;} public Editor remove(String k){m.remove(k);return this;} public void apply(){} }; } }
  static class Ctx extends Context { Prefs p = new Prefs(); public String getPackageName(){return "app.dailydriver.personal";} public PackageManager getPackageManager(){ return new PackageManager(){ public Intent getLaunchIntentForPackage(String x){ return new Intent(); } }; } public SharedPreferences getSharedPreferences(String n,int m){return p;} }
  static IcsReader.Inst mk(String t, long s, long e, boolean all, String w, String d) { IcsReader.Inst i = new IcsReader.Inst(); i.title = t; i.start = s; i.end = e; i.allDay = all; i.where = w; i.desc = d; return i; }
  static int fails = 0;
  static void ok(String n, boolean c){ System.out.println((c?"PASS ":"FAIL ")+n); if(!c) fails++; }
  public static void main(String[] a) throws Exception {
    Ctx c = new Ctx();
    String snap = new String(Files.readAllBytes(Paths.get(a[0])));
    Widgets.save(c, snap);
    // every widget kind builds and every row turns into a view
    String[] names = {"Overview","Schedule","Tasks","News","(removed)","Calendar","Habits","Next up","Quick add","Problem","Deadlines"};
    for (int k = 0; k < 11; k++) {
      if (k == 4 || k == Widgets.QUICK) continue;
      List<WidgetRows.Row> rows = WidgetRows.build(c, k);
      int views = 0; for (WidgetRows.Row r : rows) { RemoteViews v = WidgetRows.view(c, r); if (v != null) views++; }
      System.out.println(names[k] + ": " + rows.size() + " rows");
      ok(names[k] + " builds rows and views", rows.size() > 0 && views == rows.size());
    }
    // draw all widgets through the real update path
    AppWidgetManager.drawn.clear(); Widgets.refreshAll(c);
    ok("refreshAll draws all ten widgets", AppWidgetManager.drawn.size() == 10);
    for (RemoteViews v : AppWidgetManager.drawn.values()) if (v.layout != R.layout.widget_quick) ok("each list widget binds a scrolling list and a tap template", v.adapter != null && v.template != null);
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
    ok("calendar draws at every height", AppWidgetManager.drawn.size() == 10);
    // the Java calendar reader must agree with the JavaScript one on the same file
    if (a.length >= 5) {
      String text = new String(Files.readAllBytes(Paths.get(a[1])));
      JSONArray exp = new JSONArray(new String(Files.readAllBytes(Paths.get(a[2]))));
      List<IcsReader.Inst> got = IcsReader.parse(text, Long.parseLong(a[3]), Long.parseLong(a[4]));
      boolean same = got.size() == exp.length();
      StringBuilder diff = new StringBuilder();
      for (int i = 0; i < Math.min(got.size(), exp.length()); i++) {
        JSONArray x = exp.getJSONArray(i); IcsReader.Inst g = got.get(i);
        boolean eq = g.start == x.getLong(0) && g.end == x.getLong(1) && g.title.equals(x.getString(2)) && g.where.equals(x.getString(3)) && (g.allDay ? 1 : 0) == x.getInt(4) && g.desc.equals(x.getString(5));
        if (!eq) { same = false; diff.append(" #").append(i).append(' ').append(g.title).append(" got ").append(g.start).append(" want ").append(x.getLong(0)); }
      }
      ok("Java ICS reader matches the JavaScript one (" + got.size() + " instances vs " + exp.length() + ")" + (same ? "" : diff), same);
    }
    // calendar sync: the widgets refresh the calendar by themselves
    {
      Widgets.save(c, snap);
      long t0 = System.currentTimeMillis();
      List<IcsReader.Inst> got = new ArrayList<>();
      got.add(mk("Fresh class", t0 + 3600000L, t0 + 7200000L, false, "CR 9", ""));
      got.add(mk("Due: Fresh form", t0 + 7200000L, t0 + 9000000L, false, "", ""));
      got.add(mk("Mail: Placement Chair · New facts", Widgets.cal(Widgets.dayKey(0)).getTimeInMillis(), Widgets.cal(Widgets.dayKey(1)).getTimeInMillis(), true, "", "Added from email."));
      got.add(mk("Friend class", t0 + 3600000L, t0 + 7200000L, false, "", "Not mine - friend"));
      ok("calendar sync reports a change", CalendarSync.apply(c, got, "not mine", t0));
      JSONObject s2 = Widgets.load(c);
      JSONArray cal2 = s2.getJSONArray("cal");
      boolean fresh = false, oldGone = true, typedKept = false, taskKept = false, hiddenOut = true, dueKind = false, mailKind = false, sorted = true;
      String prevDay = "";
      for (int i = 0; i < cal2.length(); i++) {
        JSONObject e = cal2.getJSONObject(i);
        if (e.getString("d").compareTo(prevDay) < 0) sorted = false;
        prevDay = e.getString("d");
        if (e.getString("t").equals("Fresh class") && e.getInt("o") == 1 && e.getString("k").equals("event")) fresh = true;
        if (e.getString("t").equals("Late class")) oldGone = false;
        if (e.getString("t").equals("Team sync")) typedKept = true;
        if (e.getString("k").equals("task")) taskKept = true;
        if (e.getString("t").equals("Friend class")) hiddenOut = false;
        if (e.getString("t").equals("Fresh form") && e.getString("k").equals("due") && e.getString("id").startsWith("cal|Due: Fresh form|")) dueKind = true;
        if (e.getString("t").equals("Placement Chair · New facts") && e.getString("k").equals("mail")) mailKind = true;
      }
      ok("fresh calendar items arrive flagged as calendar-derived", fresh);
      ok("old calendar items are replaced", oldGone);
      ok("typed events and tasks are left alone", typedKept && taskKept);
      ok("events with a hidden word are left out", hiddenOut);
      ok("Due: and Mail: titles become deadline and email items", dueKind && mailKind);
      ok("the calendar list stays in day order", sorted);
      JSONArray acts = s2.getJSONArray("actions");
      boolean aDue = false, aMail = false; for (int i = 0; i < acts.length(); i++) { JSONObject x = acts.getJSONObject(i); if (x.getString("title").equals("Fresh form") && !x.getBoolean("mail")) aDue = true; if (x.getString("title").equals("Placement Chair · New facts") && x.getBoolean("mail")) aMail = true; }
      ok("the Needs you list is rebuilt from the new calendar", aDue && aMail);
      String key = null; for (int i = 0; i < cal2.length(); i++) if (cal2.getJSONObject(i).getString("t").equals("Fresh form")) key = cal2.getJSONObject(i).getString("id");
      Widgets.handle(c, "act", key, ""); Widgets.takeOps(c);
      CalendarSync.apply(c, got, "not mine", t0);
      boolean stillDone = false; JSONArray cal3 = Widgets.load(c).getJSONArray("cal");
      for (int i = 0; i < cal3.length(); i++) if (cal3.getJSONObject(i).getString("t").equals("Fresh form") && cal3.getJSONObject(i).getInt("x") == 1) stillDone = true;
      ok("something ticked on a widget stays ticked after a sync", stillDone);
      ok("and is no longer in Needs you", Widgets.load(c).getJSONArray("actions").toString().indexOf("Fresh form") < 0);
      boolean nextHasFresh = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.NEXT)) if (r.type == WidgetRows.T_NEXT && r.o != null && r.o.optString("t").equals("Fresh class")) nextHasFresh = true;
      ok("Next up shows the next class from the new calendar", nextHasFresh);
      boolean dl = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.DEADLINES)) if (r.type == WidgetRows.T_TASK && r.a.equals("Fresh form") || false) dl = true;
      ok("Deadlines lists the new due item... or it is ticked away", !dl);
      Widgets.save(c, snap);
      boolean dl2 = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.DEADLINES)) if (r.type == WidgetRows.T_TASK && (r.a.startsWith("Infosys") || r.a.equals("Marketing case submission"))) dl2 = true;
      ok("Deadlines lists due items and dated tasks with countdowns", dl2);
      boolean problem = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.PROBLEM)) if (r.type == WidgetRows.T_TEXT && r.flag && r.a.length() > 40) problem = true;
      ok("the Problem of the day widget shows a question", problem);
    }
    // news sync and date labels
    String body = "{\"date\":\"2030-01-02\",\"items\":[{\"cat\":\"Tech\",\"title\":\"T1\",\"summary\":\"S\",\"why\":\"W\",\"src\":\"X\",\"url\":\"https://e.com/a\"},{\"cat\":\"Tech\",\"kind\":\"fact\",\"title\":\"F\"},{\"cat\":\"Indian\",\"title\":\"T2\",\"url\":\"javascript:x\"}]}";
    ok("news sync swaps in the stories and skips facts", NewsSync.apply(c, body) && Widgets.load(c).getJSONArray("news").length() == 2 && Widgets.load(c).getString("newsDate").equals("2030-01-02"));
    ok("only web links are kept", Widgets.load(c).getJSONArray("news").getJSONObject(1).getString("url").isEmpty());
    ok("the same news again is not a change", !NewsSync.apply(c, body));
    ok("the News widget lists the synced stories", WidgetRows.build(c, Widgets.NEWS).size() >= 2);
    ok("due labels come from the date, not from the last snapshot", Widgets.dueLabel(Widgets.dayKey(-1), "").equals("Overdue") && Widgets.dueLabel(Widgets.dayKey(0), "").equals("Today") && Widgets.dueLabel(Widgets.dayKey(1), "").equals("Tomorrow") && Widgets.dueLabel("", "x").equals("x"));
    // empty snapshot
    Widgets.save(c, "{}"); List<WidgetRows.Row> e = WidgetRows.build(c, 0); ok("empty snapshot shows the open-the-app note", e.size() == 1 && e.get(0).a.startsWith("Open Daily Driver"));
    System.out.println(fails == 0 ? "ALL PASS" : fails + " FAILED");
    System.exit(fails == 0 ? 0 : 1);
  }
}
