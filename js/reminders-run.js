// Applies the reminder list to the device. Safe to call anywhere; does nothing outside the Android app.
import { buildReminders } from './reminders.js';
import { isNative, scheduleAll } from './native.js';

export function refreshReminders() {
  if (!isNative()) return;
  scheduleAll(buildReminders()).catch(() => { /* notifications unavailable or denied */ });
}
