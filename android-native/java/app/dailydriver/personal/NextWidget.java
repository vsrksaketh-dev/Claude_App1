package app.dailydriver.personal;

/** The next widget. Drawing and taps live in Widgets and WidgetProvider. */
public class NextWidget extends WidgetProvider {
    @Override int kind() { return Widgets.NEXT; }

    @Override boolean readsCalendar() { return true; }
}
