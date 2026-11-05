package app.dailydriver.personal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** Pinned and recent note pages; tap one to open it, or start a page or a jot. */
public class NotesWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { Widgets.update(c, m, ids, Widgets.NOTES); }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) { Widgets.update(c, m, new int[] { id }, Widgets.NOTES); }
}
