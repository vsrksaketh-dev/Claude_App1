package app.dailydriver.personal;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class NewsWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(final Context c, AppWidgetManager m, int[] ids) {
        Widgets.update(c, m, ids, Widgets.NEWS);
        // Fetch today's stories in the background (the system calls this about every half hour), then redraw all widgets.
        final PendingResult pending = goAsync();
        final Context app = c.getApplicationContext();
        new Thread(new Runnable() {
            @Override public void run() {
                try { if (NewsSync.refresh(app)) Widgets.refreshAll(app); } finally { pending.finish(); }
            }
        }).start();
    }

    // Resizing the widget re-lays it out: a bigger widget shows more, and more detail.
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
        Widgets.update(c, m, new int[] { id }, Widgets.NEWS);
    }
}
