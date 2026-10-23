package app.dailydriver.personal;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.List;

/**
 * Feeds the scrolling list inside every widget. Android asks for the rows one at a time as the user scrolls,
 * so a long list of events, tasks or headlines costs nothing until it is seen.
 */
public class WidgetListService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent.getIntExtra("kind", 0), intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0));
    }

    private static class Factory implements RemoteViewsService.RemoteViewsFactory {
        private final Context context;
        private final int kind;
        private List<WidgetRows.Row> rows = new ArrayList<>();

        Factory(Context context, int kind, int widgetId) {
            this.context = context;
            this.kind = kind;
        }

        @Override public void onCreate() { rows = WidgetRows.build(context, kind); }

        // Called after the app or a tap changes something: read the latest snapshot again.
        @Override public void onDataSetChanged() { rows = WidgetRows.build(context, kind); }

        @Override public void onDestroy() { rows = new ArrayList<>(); }

        @Override public int getCount() { return rows.size(); }

        @Override public RemoteViews getViewAt(int position) {
            try {
                return WidgetRows.view(context, rows.get(position));
            } catch (Exception e) {
                RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.row_text);
                v.setTextViewText(R.id.rt, "");
                return v;
            }
        }

        @Override public RemoteViews getLoadingView() { return null; }

        @Override public int getViewTypeCount() { return WidgetRows.TYPES; }

        @Override public long getItemId(int position) { return position; }

        @Override public boolean hasStableIds() { return false; }
    }
}
