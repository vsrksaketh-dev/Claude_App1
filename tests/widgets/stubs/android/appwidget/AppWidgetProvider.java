package android.appwidget;
import android.content.*;
public class AppWidgetProvider extends android.content.BroadcastReceiver { public void onUpdate(Context c, AppWidgetManager m, int[] ids){} public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, android.os.Bundle o){} public void onDeleted(Context c, int[] ids){} public void onReceive(Context c, Intent i){} }