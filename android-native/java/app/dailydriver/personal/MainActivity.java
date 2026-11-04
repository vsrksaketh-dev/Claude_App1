package app.dailydriver.personal;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        capture(getIntent());
    }

    // A widget tap while the app is already open arrives here. Remember the tab it asked for and tell the page.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        capture(intent);
        try {
            getBridge().triggerWindowJSEvent("widgetOpen", "{}");
        } catch (Exception ignored) {
            // the page picks the target up on its next resume instead
        }
    }

    private void capture(Intent intent) {
        // Text shared into the app from another app (a link, a message, a note): the page turns it into a task.
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && intent.getStringExtra(Intent.EXTRA_TEXT) != null) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT).trim();
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (!text.isEmpty()) {
                Widgets.enqueue(this, "capture", (subject == null || subject.trim().isEmpty() ? "" : subject.trim() + "\n") + text);
                Widgets.setTarget(this, "plan:tasks");
            }
            intent.setAction(Intent.ACTION_MAIN);
        }
        if (intent != null && intent.hasExtra("target")) {
            Widgets.setTarget(this, intent.getStringExtra("target"));
            intent.removeExtra("target");
        }
    }
}
