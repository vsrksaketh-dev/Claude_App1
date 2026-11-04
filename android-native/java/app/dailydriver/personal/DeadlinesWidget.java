package app.dailydriver.personal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class DeadlinesWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Widgets.update(c, m, ids, Widgets.DEADLINES);
        Widgets.backgroundRefresh(c, goAsync(), false, true);
    }

    // Resizing the widget re-lays it out: a bigger widget shows more.
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        Widgets.update(c, m, new int[] { id }, Widgets.DEADLINES);
    }
}
