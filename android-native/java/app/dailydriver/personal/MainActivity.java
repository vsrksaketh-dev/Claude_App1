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
        if (intent != null && intent.hasExtra("target")) {
            Widgets.setTarget(this, intent.getStringExtra("target"));
            intent.removeExtra("target");
        }
    }
}
