package app.dailydriver.personal;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the snapshot the web app builds, and hands back what the widgets queued (ticks, taps). */
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

    @PluginMethod
    public void take(PluginCall call) {
        JSObject out = new JSObject();
        out.put("ops", Widgets.takeOps(getContext()));
        out.put("target", Widgets.takeTarget(getContext()));
        call.resolve(out);
    }
}
