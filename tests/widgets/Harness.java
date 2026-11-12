package app.dailydriver.personal;
import android.content.*; import android.content.pm.PackageManager; import android.widget.RemoteViews; import android.appwidget.AppWidgetManager;
import org.json.*; import java.nio.file.*; import java.util.*;
public class Harness {
  static class Prefs implements SharedPreferences { Map<String,Object> m = new HashMap<>();
    public String getString(String k,String d){ Object o=m.get(k); return o==null?d:(String)o; } public int getInt(String k,int d){ Object o=m.get(k); return o==null?d:(Integer)o; } public boolean getBoolean(String k,boolean d){ Object o=m.get(k); return o==null?d:(Boolean)o; }
    public Editor edit(){ return new Editor(){ public Editor putString(String k,String v){m.put(k,v);return this;} public Editor putInt(String k,int v){m.put(k,v);return this;} public Editor putBoolean(String k,boolean v){m.put(k,v);return this;} public Editor remove(String k){m.remove(k);return this;} public void apply(){} public boolean commit(){return true;} }; } }
  static class Ctx extends Context { Prefs p = new Prefs(); public String getPackageName(){return "app.dailydriver.personal";} public PackageManager getPackageManager(){ return new PackageManager(){ public Intent getLaunchIntentForPackage(String x){ return new Intent(); } }; } public SharedPreferences getSharedPreferences(String n,int m){return p;} }
  static IcsReader.Inst mk(String t, long s, long e, boolean all, String w, String d) { IcsReader.Inst i = new IcsReader.Inst(); i.title = t; i.start = s; i.end = e; i.allDay = all; i.where = w; i.desc = d; return i; }
  static int fails = 0;
  static Ctx C;
  static WidgetRows.Taps T(int kind) { return Widgets.taps(C, kind, 1); }
  static RemoteViews V(WidgetRows.Row r) { return WidgetRows.view(C, r, T(Widgets.TASKS)); }
  static int vis(RemoteViews v, int id) { Integer x = v.vis.get(id); return x == null ? android.view.View.VISIBLE : x; }
  static Integer bg(RemoteViews v, int id) { return v.ints.get(id + ":setBackgroundResource"); }
  /** The day cells on show: { cell index } for the visible grid rows. */
  static List<Integer> cells(RemoteViews v) { List<Integer> out = new ArrayList<>(); if (vis(v, R.id.cgrid) == android.view.View.GONE) return out; for (int r = 0; r < 6; r++) if (vis(v, Widgets.ROWS[r]) != android.view.View.GONE) for (int d = 0; d < 7; d++) out.add(r * 7 + d); return out; }
  static Intent merged(RemoteViews v, Intent fill) { Intent t = new Intent(); t.extras.putAll(v.template.intent.extras); t.action = v.template.intent.action; t.extras.putAll(fill.extras); return t; }
  static void ok(String n, boolean c){ System.out.println((c?"PASS ":"FAIL ")+n); if(!c) fails++; }
  public static void main(String[] a) throws Exception {
    Ctx c = new Ctx(); C = c;
    Widgets.paged = true;   // most checks below use the page arrows of phones older than Android 12; the scrolling list is checked at the end
    String snap = new String(Files.readAllBytes(Paths.get(a[0])));
    Widgets.save(c, snap);
    // every widget kind builds and every row turns into a view
    String[] names = {"Overview","Schedule","Tasks","News","(removed)","Calendar","Habits","Next up","Quick add","Problem","Deadlines","Notes"};
    for (int k = 0; k < 12; k++) {
      if (k == 4 || k == Widgets.QUICK) continue;
      List<WidgetRows.Row> rows = WidgetRows.build(c, k);
      int views = 0; for (WidgetRows.Row r : rows) { RemoteViews v = V(r); if (v != null) views++; }
      System.out.println(names[k] + ": " + rows.size() + " rows");
      ok(names[k] + " builds rows and views", rows.size() > 0 && views == rows.size());
    }
    // draw all widgets through the real update path
    AppWidgetManager.drawn.clear(); Widgets.refreshAll(c);
    ok("refreshAll draws all eleven widgets", AppWidgetManager.drawn.size() == 11);
    for (RemoteViews v : AppWidgetManager.drawn.values()) if (v.layout != R.layout.widget_quick) ok("each list widget places its rows straight into the widget, no list service", v.adapter == null && v.template == null && v.kids.get(R.id.rows) != null && v.kids.get(R.id.rows).size() > 0);
    // calendar month grid
    RemoteViews cal = null; for (RemoteViews v : AppWidgetManager.drawn.values()) if (v.layout == R.layout.widget_calendar) cal = v;
    int cells = cells(cal).size();
    ok("month grid has whole weeks of seven days", cells % 7 == 0 && cells >= 28 && cells <= 42);
    ok("month mode lists the selected day", WidgetRows.build(c, 5).get(0).type == WidgetRows.T_SECTION && WidgetRows.build(c, 5).get(0).a.startsWith("Today"));
    // calendar interactions
    Widgets.handle(c, "cmode", "week", "");
    List<WidgetRows.Row> wk = WidgetRows.build(c, 5);
    int heads = 0; for (WidgetRows.Row r : wk) if (r.type == WidgetRows.T_SECTION) heads++;
    ok("week mode lists the picked day, like the app", heads == 1);
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
    boolean opens = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.TASKS)) if (r.type == WidgetRows.T_TASK) { RemoteViews v = V(r); android.app.PendingIntent p = v.clicks.get(R.id.rowroot); if (p != null && "activity".equals(p.kind) && String.valueOf(p.intent.getStringExtra("target")).startsWith("tasks:task:")) opens = true; }
    ok("a task row opens that task in the app", opens);
    // tiny and large calendar sizes both draw
    for (int h : new int[]{200, 280, 360, 520}) { AppWidgetManager.height = h; Widgets.handle(c, "cmode", "month", ""); Widgets.handle(c, "ctoday", "", ""); }
    ok("calendar draws at every height", AppWidgetManager.drawn.size() == 11);
    // layout checks for the redesigned widgets
    {
      Widgets.save(c, snap);
      boolean tile = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.DEADLINES)) if (r.type == WidgetRows.T_DEADLINE) { RemoteViews v = V(r); tile = v.layout == R.layout.row_deadline && v.texts.get(R.id.dln) != null && !r.due.isEmpty() && v.texts.get(R.id.dlt).length() > 0; }
      ok("Deadlines rows are countdown tiles with a big number", tile);
      RemoteViews q = Widgets.build(c, Widgets.QUICK, new JSONObject(snap), 100, 300, 1), q2 = Widgets.build(c, Widgets.QUICK, new JSONObject(snap), 200, 300, 1);
      ok("Quick add shows one row of tiles when short and two when tall", q.vis.get(R.id.qrow2) == android.view.View.GONE && q2.vis.get(R.id.qrow2) == android.view.View.VISIBLE);
      RemoteViews tl = Widgets.build(c, Widgets.TASKS, new JSONObject(snap), 300, 300, 1), ts = Widgets.build(c, Widgets.TASKS, new JSONObject(snap), 120, 300, 1);
      ok("Tasks shows a progress bar when roomy and a compact header when short", tl.vis.get(R.id.hprog) != null && ts.vis.get(R.id.sub) == android.view.View.GONE);
      boolean nx = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.NEXT)) if (r.type == WidgetRows.T_NEXT) { RemoteViews v = V(r); nx = v.texts.get(R.id.nn) != null; }
      ok("Next up draws its big card", nx);
    }
    {
      boolean hst = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.HABITS)) if (r.type == WidgetRows.T_HABIT) { RemoteViews v = V(r); if (v.texts.get(R.id.hs) != null) hst = true; }
      ok("Habits rows draw with their status line", hst);
      boolean lead = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.NEWS)) if (r.type == WidgetRows.T_NEWS && r.flag) lead = true;
      ok("the News widget leads with one bigger story", lead);
    }
    // the calendar widget behaves like the app: pick a day, see it highlighted and its list; week and day modes; add button
    {
      Widgets.save(c, snap);
      Widgets.handle(c, "ctoday", "", ""); Widgets.handle(c, "cmode", "week", "");
      String pick = Widgets.dayKey(2); Widgets.handle(c, "csel", pick, "");
      RemoteViews wv = Widgets.build(c, Widgets.CALENDAR, new JSONObject(snap), 420, 300, 1);
      int hi = 0; for (int n : cells(wv)) if (bg(wv, Widgets.CELL[n]) == R.drawable.cell_sel_bg) hi++;
      ok("week strip highlights exactly the picked day", hi == 1 || Widgets.weekStart(pick).compareTo(Widgets.dayKey(0)) > 0 && hi >= 0);
      List<WidgetRows.Row> wl = WidgetRows.build(c, Widgets.CALENDAR);
      int wheads = 0; for (WidgetRows.Row r : wl) if (r.type == WidgetRows.T_SECTION) wheads++;
      ok("week mode shows the picked day list, not all seven days", wheads == 1);
      Widgets.handle(c, "cmode", "day", ""); Widgets.handle(c, "cnav", "1", "");
      ok("day mode moves one day at a time", Widgets.dayDiff(pick, c.p.getString("csel", "")) == 1);
      RemoteViews dv = Widgets.build(c, Widgets.CALENDAR, new JSONObject(snap), 420, 300, 1);
      ok("day mode hides the grid and has an add button", vis(dv, R.id.cgrid) == android.view.View.GONE && dv.texts.get(R.id.ctitle) != null);
      Widgets.handle(c, "ctoday", "", ""); Widgets.handle(c, "cmode", "month", "");
    }
    // widgets that catch up with the app: notes, saved stories, task steps, priority filter, links on tasks
    {
      JSONObject sn = new JSONObject(snap);
      sn.put("notes", new JSONArray().put(new JSONObject().put("id", "n1").put("t", "HCOT questions").put("p", "Why HCOT · Case approach").put("b", "Interview prep").put("pin", 1).put("at", System.currentTimeMillis()).put("ck", "1/2")).put(new JSONObject().put("id", "n2").put("t", "Idea").put("p", "").put("b", "Inbox").put("pin", 0).put("at", 0).put("ck", "")));
      sn.put("notesCount", 2);
      sn.put("saved", new JSONArray().put(new JSONObject().put("cat", "Tech").put("title", "Saved story").put("summary", "S").put("why", "W").put("src", "X").put("url", "https://e.com/s")));
      JSONArray tk = sn.getJSONArray("tasks"); tk.getJSONObject(0).put("st", "1/3").put("imp", 1).put("u", "https://drive.google.com/file/d/1/view").put("uk", "doc");
      Widgets.save(c, sn.toString());
      List<WidgetRows.Row> nr = WidgetRows.build(c, Widgets.NOTES);
      boolean noteOk = false; for (WidgetRows.Row r : nr) if (r.type == WidgetRows.T_NOTE && r.a.equals("HCOT questions") && r.target.equals("notes:page:n1") && r.c.contains("1/2")) noteOk = true;
      ok("Notes widget lists pinned pages first and opens the page", noteOk && nr.get(0).type == WidgetRows.T_SECTION && nr.get(0).a.equals("Pinned"));
      for (WidgetRows.Row r : nr) if (r.type == WidgetRows.T_NOTE) V(r);
      RemoteViews nv = Widgets.build(c, Widgets.NOTES, sn, 300, 300, 1);
      ok("Notes widget has New page and Jot buttons", vis(nv, R.id.pills) == android.view.View.VISIBLE && vis(nv, Widgets.PILLS[2]) == android.view.View.VISIBLE && vis(nv, Widgets.PILLS[3]) == android.view.View.GONE);
      Widgets.handle(c, "ncat", "Saved", "");
      boolean sv = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.NEWS)) if (r.type == WidgetRows.T_NEWS && r.o.optString("title").equals("Saved story")) sv = true;
      ok("News widget shows saved stories", sv);
      Widgets.handle(c, "ncat", "", "");
      boolean steps = false, link = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.TASKS)) if (r.type == WidgetRows.T_TASK && r.b.contains("1/3 steps")) { steps = true; link = r.u.contains("drive.google"); }
      ok("Tasks widget shows steps and a link button", steps && link);
      int allN = 0; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.TASKS)) if (r.type == WidgetRows.T_TASK && !r.done) allN++;
      int impN = 0; for (int i = 0; i < tk.length(); i++) if (tk.getJSONObject(i).optInt("imp") == 1 && tk.getJSONObject(i).optInt("dn") == 0) impN++;
      Widgets.handle(c, "tf", "pri", "");
      int pri = 0; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.TASKS)) if (r.type == WidgetRows.T_TASK && !r.done) pri++;
      ok("Tasks widget can show only priority tasks (" + pri + " of " + allN + ")", pri == impN && pri >= 1);
      Widgets.handle(c, "tf", "all", "");
      Widgets.save(c, snap);
    }
    // after midnight, before the app is opened: yesterday's ticks must not show as today's
    {
      JSONObject old = new JSONObject(snap); old.put("today", Widgets.dayKey(-1));
      JSONArray hl = old.getJSONArray("habitList"); for (int i = 0; i < hl.length(); i++) hl.getJSONObject(i).put("done", true);
      Widgets.save(c, old.toString());
      boolean anyDone = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.HABITS)) if (r.type == WidgetRows.T_HABIT && r.done) anyDone = true;
      boolean doneToday = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.TASKS)) if (r.type == WidgetRows.T_SECTION && r.a.equals("Done today")) doneToday = true;
      ok("a snapshot from yesterday shows habits unticked and no Done today list", !anyDone && !doneToday);
      Widgets.save(c, snap);
    }
    // calendar fuzz: hundreds of random taps (arrows, days, modes, Today) must never break the state or the drawing
    {
      Widgets.save(c, snap);
      Random rnd = new Random(7);
      String[] modes = {"month", "week", "day", "agenda"};
      boolean noThrow = true, oneSel = true, inRange = true, titled = true, agendaFwd = true, wentBack = false; String why = "";
      Widgets.handle(c, "ctoday", "", "");
      for (int step = 0; step < 800; step++) {
        int r = rnd.nextInt(10);
        String[] st0 = Widgets.calState(c, 0);
        if (r < 4) Widgets.handle(c, "cnav", rnd.nextBoolean() ? "1" : "-1", "");
        else if (r < 7) Widgets.handle(c, "csel", Widgets.plusDays(Widgets.weekStart(st0[2]), rnd.nextInt(35) - 3), "");
        else if (r < 9) Widgets.handle(c, "cmode", modes[rnd.nextInt(4)], "");
        else Widgets.handle(c, "ctoday", "", "");
        String[] st = Widgets.calState(c, 0);
        if (Math.abs(Widgets.dayDiff(Widgets.dayKey(0), st[2])) > 900 || Math.abs(Widgets.dayDiff(Widgets.dayKey(0), st[1])) > 900) { inRange = false; why = st[1] + "/" + st[2]; }
        if (st[0].equals("agenda") && Widgets.dayDiff(Widgets.dayKey(0), st[2]) < 0) agendaFwd = false;
        for (int h : new int[]{240, 340, 520}) {
          try {
            RemoteViews v = Widgets.build(c, Widgets.CALENDAR, new JSONObject(snap), h, 300, 1);
            if (v.texts.get(R.id.ctitle) == null || v.texts.get(R.id.ctitle).length() == 0) titled = false;
            List<Integer> gcells = cells(v);
            if (st[0].equals("month") || st[0].equals("week")) {
              int selected = 0, selDay = -1;
              for (int n : gcells) if (bg(v, Widgets.CELL[n]) == R.drawable.cell_sel_bg) { selected++; selDay = Integer.parseInt(v.texts.get(Widgets.CELL_NUM[n]).toString()); }
              if (gcells.isEmpty()) { oneSel = false; why = "no grid in " + st[0]; }
              boolean inGrid = false; { String first = st[0].equals("month") ? st[2].substring(0, 8) + "01" : Widgets.weekStart(st[1]); String start = Widgets.weekStart(first); for (int i = 0; i < gcells.size(); i++) if (Widgets.plusDays(start, i).equals(st[1])) inGrid = true; }
              if (st[0].equals("week") && !inGrid) { oneSel = false; why = "week does not hold the picked day " + st[1]; }
              if (inGrid && (selected != 1 || selDay != Integer.parseInt(st[1].substring(8)))) { oneSel = false; why = st[0] + " sel " + st[1] + " anchor " + st[2] + " highlighted " + selected + " day " + selDay; }
              if (!inGrid && selected != 0) { oneSel = false; why = "highlight outside grid " + st[1]; }
            }
            WidgetRows.build(c, Widgets.CALENDAR);
          } catch (Throwable t) { noThrow = false; why = st[0] + " " + st[1] + " " + st[2] + " " + t; }
        }
      }
      ok("800 random calendar taps never leave an unreadable state", inRange && agendaFwd);
      ok("and the calendar always draws (" + why + ")", noThrow && titled);
      ok("exactly the picked day is highlighted, whichever way it was reached (" + why + ")", oneSel);
      // a garbled saved state heals itself
      c.p.m.put("csel", "garbage"); c.p.m.put("canchor", "2099-99-99"); c.p.m.put("cmode", "weird");
      String[] healed = Widgets.calState(c, 0);
      ok("a garbled saved state resets to today", healed[0].equals("month") && healed[1].equals(Widgets.dayKey(0)));
      Widgets.handle(c, "ctoday", "", "");
    }
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
      got.add(mk("Online DTS class", t0 + 10800000L, t0 + 14400000L, false, "PGP-1 Online", "Join the class: https://teams.microsoft.com/l/meetup-join/abc and read https://drive.google.com/file/d/1/view"));
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
      boolean linked = false; for (int i = 0; i < cal2.length(); i++) { JSONObject e = cal2.getJSONObject(i); if (e.getString("t").equals("Online DTS class") && e.getString("u").contains("teams.microsoft.com") && e.getString("uk").equals("meet")) linked = true; }
      ok("a class with a meeting link carries it, meeting before document", linked);
      ok("link finder ranks meeting, then document, then mail", Links.best("see https://mail.google.com/mail/u/0/#inbox/1 and https://x.org/a.pdf, join https://zoom.us/j/9.")[1].equals("meet") && Links.best("https://mail.google.com/m/1 https://x.org/case.pdf")[1].equals("doc") && Links.best("no link here") == null);
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
      boolean dl = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.DEADLINES)) if (r.type == WidgetRows.T_DEADLINE && r.a.equals("Fresh form") || false) dl = true;
      ok("Deadlines lists the new due item... or it is ticked away", !dl);
      Widgets.save(c, snap);
      boolean dl2 = false; for (WidgetRows.Row r : WidgetRows.build(c, Widgets.DEADLINES)) if (r.type == WidgetRows.T_DEADLINE && (r.a.startsWith("Infosys") || r.a.equals("Marketing case submission"))) dl2 = true;
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
    // taps: in-place changes are broadcasts to the widget's own provider; opening the app or a link is a direct activity
    { c.p.m.clear(); Widgets.save(c, snap); AppWidgetManager.height = 420; AppWidgetManager.drawn.clear(); Widgets.refreshAll(c);
      int toProvider = 0, elsewhere = 0, opensN = 0; String bad = "";
      for (RemoteViews v : AppWidgetManager.drawn.values()) {
        Deque<RemoteViews> q = new ArrayDeque<>(); q.add(v);
        while (!q.isEmpty()) { RemoteViews x = q.poll();
          for (android.app.PendingIntent p : x.clicks.values()) {
            if ("broadcast".equals(p.kind)) { if (String.valueOf(p.intent.extras.get("_cls")).endsWith("Widget") && Widgets.TAP.equals(p.intent.getAction()) && p.intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0) != 0) toProvider++; else { elsewhere++; bad = p.intent.toString(); } }
            else if ("activity".equals(p.kind)) opensN++;
          }
          for (List<RemoteViews> l : x.kids.values()) q.addAll(l); }
      }
      ok("every in-place tap goes to the widget's own provider with its widget id (" + toProvider + ")" + bad, elsewhere == 0 && toProvider > 60);
      ok("opening the app or a link is a direct tap (" + opensN + ")", opensN > 20);
      ok("nothing is routed through an invisible activity", !new java.io.File("android-native/java/app/dailydriver/personal/WidgetRouteActivity.java").exists());
      // the calendar, through the same path the phone uses: the broadcast reaches CalendarWidget.onReceive
      RemoteViews cv = null; String cid = null; for (Map.Entry<String, RemoteViews> en : AppWidgetManager.drawn.entrySet()) if (en.getValue().layout == R.layout.widget_calendar) { cv = en.getValue(); cid = en.getKey(); }
      int wid = Integer.parseInt(cid);
      for (int i = 0; i < 4; i++) {
        android.app.PendingIntent p = cv.clicks.get(Widgets.MODE_BTN[i]);
        AppWidgetManager.drawn.clear();
        new CalendarWidget().onReceive(c, p.intent);
        String want = new String[]{"month", "week", "day", "agenda"}[i];
        RemoteViews after = AppWidgetManager.drawn.get(cid);
        ok("tapping " + want + " switches that calendar and redraws only it", want.equals(Widgets.calState(c, wid)[0]) && AppWidgetManager.drawn.size() == 1 && after != null && bg(after, Widgets.MODE_BTN[i]) == R.drawable.join_bg);
        cv = after;
      }
      // month: tap a day that is not today; it is highlighted, its list shows, today keeps its circle
      new CalendarWidget().onReceive(c, cv.clicks.get(Widgets.MODE_BTN[0]).intent); cv = AppWidgetManager.drawn.get(cid);
      String other = Widgets.plusDays(Widgets.dayKey(0), Widgets.dayKey(0).endsWith("-01") ? 1 : -1);
      int idx = -1; String start = Widgets.weekStart(Widgets.dayKey(0).substring(0, 8) + "01"); for (int n : cells(cv)) if (Widgets.plusDays(start, n).equals(other)) idx = n;
      new CalendarWidget().onReceive(c, cv.clicks.get(Widgets.CELL[idx]).intent); cv = AppWidgetManager.drawn.get(cid);
      int sel = 0, todayCircles = 0; for (int n : cells(cv)) { if (bg(cv, Widgets.CELL[n]) == R.drawable.cell_sel_bg) sel++; if (bg(cv, Widgets.CELL_NUM[n]) == R.drawable.cal_today) todayCircles++; }
      ok("picking another day highlights exactly it, today keeps its circle", sel == 1 && bg(cv, Widgets.CELL[idx]) == R.drawable.cell_sel_bg && todayCircles == 1 && other.equals(Widgets.calState(c, wid)[1]));
      boolean listed = false; for (RemoteViews r : cv.kids.get(R.id.rows)) if (r.layout == R.layout.widget_section && String.valueOf(r.texts.get(R.id.st)).contains(Widgets.fmt("d MMM", Widgets.cal(other).getTimeInMillis()))) listed = true;
      ok("and the rows under the grid are that day's", listed);
      // arrows and Today
      new CalendarWidget().onReceive(c, cv.clicks.get(R.id.cnext).intent); cv = AppWidgetManager.drawn.get(cid);
      ok("the next arrow shows next month", Widgets.calState(c, wid)[2].substring(0, 7).equals(Widgets.plusMonths(Widgets.dayKey(0), 1).substring(0, 7)) && cells(cv).size() >= 28);
      new CalendarWidget().onReceive(c, cv.clicks.get(R.id.ctoday).intent); cv = AppWidgetManager.drawn.get(cid);
      ok("Today comes back", Widgets.calState(c, wid)[1].equals(Widgets.dayKey(0)));
      // two calendar widgets keep their own modes
      Widgets.handle(c, Widgets.CALENDAR, 777, "cmode", "agenda");
      ok("a second calendar widget keeps its own mode", "agenda".equals(Widgets.calState(c, 777)[0]) && "month".equals(Widgets.calState(c, wid)[0]));
      // a short month widget has no room for rows: a picked day opens in Day view instead of vanishing
      AppWidgetManager.height = 240; Widgets.refreshKind(c, Widgets.CALENDAR); cv = AppWidgetManager.drawn.get(cid);
      ok("a short month widget hides the rows", vis(cv, R.id.rows) == android.view.View.GONE);
      new CalendarWidget().onReceive(c, cv.clicks.get(Widgets.CELL[idx]).intent);
      ok("and a picked day opens in Day view", "day".equals(Widgets.calState(c, wid)[0]) && other.equals(Widgets.calState(c, wid)[1]));
      cv = AppWidgetManager.drawn.get(cid);
      ok("which shows that day's rows", vis(cv, R.id.cgrid) == android.view.View.GONE && cv.kids.get(R.id.rows) != null && cv.kids.get(R.id.rows).size() > 0);
      AppWidgetManager.height = 420;
      // a tick redraws the widgets that show tasks, not all eleven, and the ring fills at once
      RemoteViews tv = null; String tid = null; for (Map.Entry<String, RemoteViews> en : AppWidgetManager.drawn.entrySet()) if (en.getValue().layout == R.layout.widget_card && "Tasks".equals(String.valueOf(en.getValue().texts.get(R.id.head)))) { tv = en.getValue(); tid = en.getKey(); }
      if (tv == null) { Widgets.refreshKind(c, Widgets.TASKS); for (Map.Entry<String, RemoteViews> en : AppWidgetManager.drawn.entrySet()) if ("Tasks".equals(String.valueOf(en.getValue().texts.get(R.id.head)))) { tv = en.getValue(); tid = en.getKey(); } }
      RemoteViews firstTask = null; for (RemoteViews r : tv.kids.get(R.id.rows)) if (r.layout == R.layout.row_task) { firstTask = r; break; }
      AppWidgetManager.drawn.clear();
      new TasksWidget().onReceive(c, firstTask.clicks.get(R.id.ring).intent);
      ok("ticking a task redraws only the widgets that show tasks (" + AppWidgetManager.drawn.size() + ")", AppWidgetManager.drawn.size() >= 1 && AppWidgetManager.drawn.size() <= 6 && AppWidgetManager.drawn.containsKey(tid));
      boolean ringDone = false; for (RemoteViews r : AppWidgetManager.drawn.get(tid).kids.get(R.id.rows)) if (r.layout == R.layout.row_task && r.texts.get(R.id.tk).toString().equals(firstTask.texts.get(R.id.tk).toString()) && Integer.valueOf(R.drawable.ring_done).equals(r.imgs.get(R.id.ring))) ringDone = true;
      ok("and the ticked task shows a filled ring straight away", ringDone);
      Widgets.takeOps(c);
      // long lists get page arrows, and every row is reachable
      List<WidgetRows.Row> all = WidgetRows.build(c, Widgets.OVERVIEW, 1);
      List<int[]> pg = Widgets.pages(all, 180);
      int covered = 0; for (int[] r : pg) covered += r[1] - r[0];
      ok("rows split into pages that cover every row (" + pg.size() + " pages)", covered == all.size() && pg.size() > 1);
      boolean orphan = false; for (int[] r : pg) if (r[1] - r[0] > 1 && r[1] < all.size() && all.get(r[1] - 1).type == WidgetRows.T_SECTION) orphan = true;
      ok("a heading is never left alone at the bottom of a page", !orphan);
      AppWidgetManager.height = 200; AppWidgetManager.drawn.clear(); Widgets.refreshKind(c, Widgets.OVERVIEW);
      RemoteViews ov = AppWidgetManager.drawn.values().iterator().next(); String oid = AppWidgetManager.drawn.keySet().iterator().next();
      ok("a short widget shows page arrows", vis(ov, R.id.pgnext) == android.view.View.VISIBLE && String.valueOf(ov.texts.get(R.id.pginfo)).startsWith("1 of"));
      new OverviewWidget().onReceive(c, ov.clicks.get(R.id.pgnext).intent);
      ok("and the next arrow turns the page", String.valueOf(AppWidgetManager.drawn.get(oid).texts.get(R.id.pginfo)).startsWith("2 of"));
      AppWidgetManager.height = 420;
      // the widget fills the height it is really given (upright phones: the maximum height), not the minimum
      ok("size reads the maximum height", Widgets.size(AppWidgetManager.inst, 1)[1] == 420);
      // a widget whose drawing throws is replaced by a plain card that opens the app, and the error is kept for the app's log
      AppWidgetManager.drawn.clear();
      Widgets.save(c, "{not json");
      try { Widgets.refreshAll(c); } catch (Throwable t) { ok("refresh never throws", false); }
      ok("a broken snapshot still draws every widget", AppWidgetManager.drawn.size() == 11);
      Widgets.save(c, snap); AppWidgetManager.drawn.clear(); Widgets.refreshAll(c);
      ok("widgets recover once the snapshot is good", AppWidgetManager.drawn.size() == 11);
      Widgets.takeErrors(c);
      ok("errors are handed to the app once and cleared", Widgets.takeErrors(c).equals("[]"));
      new CalendarWidget().onDeleted(c, new int[] { 777 });
      ok("a removed widget's settings are forgotten", !c.p.m.containsKey("cmode.777"));
    }
    // Android 12 and later: the rows are a list that scrolls, sent inside the update itself
    { Widgets.paged = false; c.p.m.clear(); Widgets.save(c, snap); AppWidgetManager.height = 200; AppWidgetManager.drawn.clear(); Context.started.clear(); Widgets.refreshAll(c);
      int lists = 0, arrows = 0, direct = 0; boolean clean = true, unique = true, tpl = true;
      RemoteViews tv = null, nv = null, notes = null; String tid = null;
      for (Map.Entry<String, RemoteViews> en : AppWidgetManager.drawn.entrySet()) { RemoteViews v = en.getValue();
        String h = String.valueOf(v.texts.get(R.id.head));
        if ("Tasks".equals(h)) { tv = v; tid = en.getKey(); } if ("News".equals(h)) nv = v; if ("Notes".equals(h)) notes = v;
        RemoteViews.RemoteCollectionItems it = v.lists.get(R.id.list); if (it == null) continue;
        lists++; if (vis(v, R.id.pgnext) != android.view.View.GONE || vis(v, R.id.rows) != android.view.View.GONE || v.kids.get(R.id.rows) != null) arrows++;
        if (v.template == null) tpl = false; else if ("activity".equals(v.template.kind)) direct++;
        if (new HashSet<>(it.ids).size() != it.ids.size() || !it.stable) unique = false;
        for (RemoteViews r : it.views) if (!r.clicks.isEmpty() || r.fills.isEmpty()) clean = false; }
      ok("every widget with rows draws them as a scrolling list (" + lists + ")", lists >= 9);
      ok("a short widget needs no page arrows when its list scrolls", arrows == 0);
      ok("list rows fill in the list's one template instead of carrying their own intents", clean && tpl);
      ok("rows have stable, unique ids so the list keeps its place", unique);
      ok("lists that only open the app start it directly (Notes, Problem)", direct == 2 && notes != null && "activity".equals(notes.template.kind));
      List<WidgetRows.Row> want = WidgetRows.build(c, Widgets.TASKS, Integer.parseInt(tid));
      ok("the Tasks list holds every task, not just the ones that fit (" + want.size() + ")", tv.lists.get(R.id.list).views.size() == want.size());
      RemoteViews first = null; for (RemoteViews r : tv.lists.get(R.id.list).views) if (r.layout == R.layout.row_task) { first = r; break; }
      Widgets.takeOps(c); AppWidgetManager.drawn.clear();
      new TasksWidget().onReceive(c, merged(tv, first.fills.get(R.id.ring)));
      boolean done = false; for (RemoteViews r : AppWidgetManager.drawn.get(tid).lists.get(R.id.list).views) if (r.layout == R.layout.row_task && r.texts.get(R.id.tk).toString().equals(first.texts.get(R.id.tk).toString()) && Integer.valueOf(R.drawable.ring_done).equals(r.imgs.get(R.id.ring))) done = true;
      ok("ticking a task in the list fills its ring at once and queues it for the app", done && Widgets.takeOps(c).contains("\"task\""));
      ok("a tick leaves the list where it was scrolled", AppWidgetManager.drawn.get(tid).scroll == -1 && Context.started.isEmpty());
      tv = AppWidgetManager.drawn.get(tid);
      new TasksWidget().onReceive(c, merged(tv, first.fills.get(R.id.rowroot)));
      ok("tapping a row of the list opens the app on its tab", Context.started.size() == 1 && String.valueOf(Context.started.get(0).extras.get("target")).startsWith("tasks:task:"));
      Context.started.clear(); Intent read = null; for (RemoteViews r : nv.lists.get(R.id.list).views) if (r.layout == R.layout.row_news && r.fills.get(R.id.read) != null) { read = r.fills.get(R.id.read); break; }
      if (read != null) new NewsWidget().onReceive(c, merged(nv, read));
      ok("a story's Read button in the list opens its link", read != null && Context.started.size() == 1 && Intent.ACTION_VIEW.equals(Context.started.get(0).action) && String.valueOf(Context.started.get(0).view).startsWith("http"));
      { org.json.JSONObject wn = new org.json.JSONObject(snap); wn.put("notes", new org.json.JSONArray().put(new org.json.JSONObject().put("id", "pg1").put("t", "Case notes").put("p", "First line").put("at", 1794400000000L)).put(new org.json.JSONObject().put("id", "pg2").put("t", "Ideas")));
        Widgets.save(c, wn.toString()); AppWidgetManager.drawn.clear(); Widgets.refreshKind(c, Widgets.NOTES); RemoteViews nw = AppWidgetManager.drawn.values().iterator().next(); String tg = "";
        for (RemoteViews r : nw.lists.get(R.id.list).views) if (r.layout == R.layout.row_note) { tg = r.fills.get(R.id.ntroot).getStringExtra("target"); break; }
        ok("a Notes row carries the page to open (" + tg + ")", tg.startsWith("notes:page:pg"));
        ok("an empty Notes widget opens Notes", "notes".equals(notes.lists.get(R.id.list).views.get(0).fills.values().iterator().next().getStringExtra("target")));
        Widgets.save(c, snap); AppWidgetManager.drawn.clear(); Widgets.refreshAll(c); }
      new TasksWidget().onReceive(c, tv.clicks.get(Widgets.PILLS[2]).intent);
      ok("a new filter starts the list from the top", AppWidgetManager.drawn.get(tid).scroll == 0);
      new TasksWidget().onReceive(c, tv.clicks.get(Widgets.PILLS[0]).intent);
      // a very long list is capped so the update stays light
      org.json.JSONObject big = new org.json.JSONObject(snap); org.json.JSONArray ts = new org.json.JSONArray();
      for (int i = 0; i < 150; i++) ts.put(new org.json.JSONObject().put("id", "b" + i).put("t", "Task " + i).put("i", i).put("dn", 0));
      big.put("tasks", ts); Widgets.save(c, big.toString()); AppWidgetManager.drawn.clear(); Widgets.refreshKind(c, Widgets.TASKS);
      RemoteViews.RemoteCollectionItems it = AppWidgetManager.drawn.get(tid).lists.get(R.id.list);
      ok("a very long list is capped and says how many more there are", it.views.size() == WidgetList.MAX_ROWS && String.valueOf(it.views.get(it.views.size() - 1).texts.get(R.id.rt)).contains("more"));
      Widgets.save(c, snap);
      // the calendar's day list scrolls too, and still follows the picked day
      AppWidgetManager.height = 420; AppWidgetManager.drawn.clear(); Widgets.refreshKind(c, Widgets.CALENDAR);
      RemoteViews cv = AppWidgetManager.drawn.values().iterator().next(); String cid = AppWidgetManager.drawn.keySet().iterator().next();
      ok("the calendar's day rows are a scrolling list", cv.lists.get(R.id.list) != null && vis(cv, R.id.list) == android.view.View.VISIBLE && vis(cv, R.id.pgnext) == android.view.View.GONE);
      Random rnd = new Random(7); boolean bad = false;
      for (int i = 0; i < 300 && !bad; i++) { List<android.app.PendingIntent> ps = new ArrayList<>(); for (android.app.PendingIntent p : cv.clicks.values()) if ("broadcast".equals(p.kind)) ps.add(p);
        new CalendarWidget().onReceive(c, ps.get(rnd.nextInt(ps.size())).intent); cv = AppWidgetManager.drawn.get(cid);
        if (cv == null || cv.layout != R.layout.widget_calendar || (vis(cv, R.id.list) == android.view.View.VISIBLE && cv.lists.get(R.id.list) == null)) bad = true; }
      ok("300 random calendar taps with a scrolling list never break the widget", !bad && Widgets.takeErrors(c).equals("[]"));
      Widgets.paged = true;
    }
    System.out.println(fails == 0 ? "ALL PASS" : fails + " FAILED");
    System.exit(fails == 0 ? 0 : 1);
  }
}
