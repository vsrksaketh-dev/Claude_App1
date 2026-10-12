package app.dailydriver.personal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the snapshot the web app builds and redraws the home-screen widgets from it. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json != null) {
            Widgets.save(getContext(), json);
            Widgets.refreshAll(getContext());
        }
        call.resolve(new JSObject());
    }
}
