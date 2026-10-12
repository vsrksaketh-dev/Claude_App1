package app.dailydriver.personal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Taps on the interactive parts of a widget (tick a task, flip a page, pick a day) land here. */
public class WidgetActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Widgets.handle(c, i.getStringExtra("type"), i.getStringExtra("id"), i.getStringExtra("arg"));
    }
}
