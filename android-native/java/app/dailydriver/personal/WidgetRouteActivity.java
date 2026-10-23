package app.dailydriver.personal;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Where every tap on a widget's list lands. It has no screen: it either opens the app on the tab the row asked for,
 * opens a link, or applies a tick or a day flip, and then closes itself at once.
 */
public class WidgetRouteActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Intent in = getIntent();
        String type = in == null ? null : in.getStringExtra("type");
        String id = in == null ? "" : in.getStringExtra("id");
        String target = in == null ? "" : in.getStringExtra("target");
        try {
            if ("open".equals(type)) {
                Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (launch != null) {
                    launch.putExtra("target", target == null ? "" : target);
                    startActivity(launch);
                }
            } else if ("url".equals(type) && id != null && id.startsWith("http")) {
                Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(id));
                view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(view);
            } else if (type != null) {
                Widgets.handle(this, type, id, "");
            }
        } catch (Exception ignored) {
            // a tap that cannot be handled should never crash the home screen
        }
        finish();
        overridePendingTransition(0, 0);
    }
}
