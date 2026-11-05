package app.dailydriver.personal;

/** The deadlines widget. Drawing and taps live in Widgets and WidgetProvider. */
public class DeadlinesWidget extends WidgetProvider {
    @Override int kind() { return Widgets.DEADLINES; }

    @Override boolean readsCalendar() { return true; }
}
