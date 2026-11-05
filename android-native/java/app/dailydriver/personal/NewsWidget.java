package app.dailydriver.personal;

/** The news widget. Drawing and taps live in Widgets and WidgetProvider. */
public class NewsWidget extends WidgetProvider {
    @Override int kind() { return Widgets.NEWS; }

    @Override boolean readsNews() { return true; }
}
