package app.dailydriver.personal;

/** The calendar widget. Drawing and taps live in Widgets and WidgetProvider. */
public class CalendarWidget extends WidgetProvider {
    @Override int kind() { return Widgets.CALENDAR; }

    @Override boolean readsCalendar() { return true; }
}
