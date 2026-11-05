package app.dailydriver.personal;

/** The schedule widget. Drawing and taps live in Widgets and WidgetProvider. */
public class ScheduleWidget extends WidgetProvider {
    @Override int kind() { return Widgets.SCHEDULE; }

    @Override boolean readsCalendar() { return true; }
}
