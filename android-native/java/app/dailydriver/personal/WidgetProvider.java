package app.dailydriver.personal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/**
 * The base of every Daily Driver widget. Taps that change a widget in place (a tick, a filter, a mode, a day, a page) are
 * broadcasts addressed to the widget's own provider, which the system always delivers because the launcher already talks to it;
 * they are handled here and only the widgets they touch are redrawn. Opening the app or a link is a direct activity tap instead.
 */
public abstract class WidgetProvider extends AppWidgetProvider {
    abstract int kind();

    /** Whether the system's half-hourly refresh should also re-read the calendars or the news, on a background thread. */
    boolean readsCalendar() { return false; }

    boolean readsNews() { return false; }

    @Override
    public void onReceive(Context c, Intent i) {
        if (i != null && Widgets.TAP.equals(i.getAction())) {
            try { Widgets.tap(c, i); } catch (Throwable t) { Widgets.logError(c, "tap", t); }
            return;
        }
        super.onReceive(c, i);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Widgets.update(c, m, ids, kind());
        if (readsCalendar() || readsNews()) Widgets.backgroundRefresh(c, goAsync(), readsNews(), readsCalendar());
    }

    // Resizing the widget re-lays it out: a bigger widget shows more rows.
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        Widgets.update(c, m, new int[] { id }, kind());
    }

    @Override
    public void onDeleted(Context c, int[] ids) { Widgets.forget(c, ids); }
}
