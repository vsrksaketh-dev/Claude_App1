package app.dailydriver.personal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class HabitsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Widgets.update(c, m, ids, Widgets.HABITS);
    }

    // Resizing the widget re-lays it out: the calendar grid and list adapt to the new height.
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        Widgets.update(c, m, new int[] { id }, Widgets.HABITS);
    }
}
