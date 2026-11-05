package app.dailydriver.personal;

/** The overview widget. Drawing and taps live in Widgets and WidgetProvider. */
public class OverviewWidget extends WidgetProvider {
    @Override int kind() { return Widgets.OVERVIEW; }

    @Override boolean readsCalendar() { return true; }
}
