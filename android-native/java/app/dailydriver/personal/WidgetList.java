package app.dailydriver.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The scrolling list inside a widget (Android 12 and later). The rows travel inside the same update as the rest of the widget
 * (RemoteCollectionItems), so there is no list service to fall out of step: what scrolls is exactly what was just worked out.
 *
 * Rows of a list cannot each carry their own pending intent; the list has one template and every tappable part fills in what
 * it wants. Lists whose rows only open the app (Notes, Problem of the day) use an activity template, so a tap starts the app
 * directly. Every other list uses a broadcast to the widget's own provider: ticks are applied there in place, and a row that
 * opens the app or a link is started from the provider (WidgetProvider.onReceive).
 *
 * Kept in its own class so phones older than Android 12 never load it; they keep the page arrows.
 */
final class WidgetList {
    /** More rows than this would make the update too heavy; the last row then says to open the app for the rest. */
    static final int MAX_ROWS = 80;

    private WidgetList() { }

    /** Lists whose rows never tick anything: a tap goes straight to the app. */
    static boolean direct(int kind) { return kind == Widgets.NOTES || kind == Widgets.PROBLEM; }

    static void fill(Context c, RemoteViews v, int kind, int wid, List<WidgetRows.Row> rows, boolean toTop) {
        final boolean direct = direct(kind);
        WidgetRows.Taps taps = new WidgetRows.Taps() {
            @Override public void bind(RemoteViews row, int viewId, String type, String id, String target) {
                Intent f = new Intent();
                if (direct) f.putExtra("target", target == null || target.isEmpty() ? "home" : target);
                else f.putExtra("type", type).putExtra("id", id == null ? "" : id).putExtra("target", target == null ? "" : target);
                row.setOnClickFillInIntent(viewId, f);
            }
        };
        RemoteViews.RemoteCollectionItems.Builder b = new RemoteViews.RemoteCollectionItems.Builder().setHasStableIds(true).setViewTypeCount(WidgetRows.TYPES + 1);
        Set<Long> used = new HashSet<>();
        int n = Math.min(rows.size(), MAX_ROWS);
        for (int i = 0; i < n; i++) {
            WidgetRows.Row r = rows.get(i);
            if (i == MAX_ROWS - 1 && rows.size() > MAX_ROWS) { r = new WidgetRows.Row(WidgetRows.T_TEXT); r.a = (rows.size() - MAX_ROWS + 1) + " more. Open the app to see them all."; }
            try {
                // a row keeps its id while its content stays the same, so the list holds its place when something above it changes
                long id = ((long) r.type << 40) ^ (r.id + "|" + r.a + "|" + r.target).hashCode();
                while (!used.add(id)) id++;
                b.addItem(id, WidgetRows.view(c, r, taps));
            } catch (Exception err) { Widgets.logError(c, "row " + kind, err); }
        }
        v.setRemoteAdapter(R.id.list, b.build());
        v.setPendingIntentTemplate(R.id.list, template(c, kind, wid));
        if (toTop) v.setScrollPosition(R.id.list, 0);
    }

    /** The one pending intent every row of this widget's list fills in. It has to be mutable for the rows to add their part. */
    static PendingIntent template(Context c, int kind, int wid) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE;
        if (direct(kind)) {
            Intent i = Widgets.appIntent(c);     // told apart from other widgets' templates by its request code
            return PendingIntent.getActivity(c, ("list/" + wid).hashCode(), i, flags);
        }
        Class<?> p = Widgets.providerFor(kind);
        Intent i = new Intent(c, p == null ? OverviewWidget.class : p);
        i.setAction(Widgets.TAP);
        i.setData(Uri.parse("dd://list/" + wid));
        i.putExtra("kind", kind);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        return PendingIntent.getBroadcast(c, ("list/" + wid).hashCode(), i, flags);
    }
}
