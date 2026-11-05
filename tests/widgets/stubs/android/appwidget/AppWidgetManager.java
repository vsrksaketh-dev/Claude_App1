package android.appwidget;
import android.content.*; import java.util.*;
public class AppWidgetManager { public static final String OPTION_APPWIDGET_MIN_HEIGHT="h", OPTION_APPWIDGET_MIN_WIDTH="w", OPTION_APPWIDGET_MAX_HEIGHT="H", EXTRA_APPWIDGET_ID="appWidgetId";
 public static AppWidgetManager inst = new AppWidgetManager(); public static Map<String,android.widget.RemoteViews> drawn = new TreeMap<>(); public static int height=400, width=320;
 public static AppWidgetManager getInstance(Context c){return inst;}
 public int[] getAppWidgetIds(ComponentName n){return new int[]{ n.k.getSimpleName().hashCode() & 0xffff };}
 public android.os.Bundle getAppWidgetOptions(int id){ android.os.Bundle b = new android.os.Bundle(); b.h=height; b.w=width; return b; }
 public void updateAppWidget(int id, android.widget.RemoteViews v){ drawn.put(""+id, v); } public void notifyAppWidgetViewDataChanged(int[] ids,int v){} }