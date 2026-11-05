package android.widget;
import android.content.Intent;
public abstract class RemoteViewsService extends android.app.Service { public abstract RemoteViewsFactory onGetViewFactory(Intent i);
 public interface RemoteViewsFactory { void onCreate(); void onDataSetChanged(); void onDestroy(); int getCount(); RemoteViews getViewAt(int p); RemoteViews getLoadingView(); int getViewTypeCount(); long getItemId(int p); boolean hasStableIds(); } }