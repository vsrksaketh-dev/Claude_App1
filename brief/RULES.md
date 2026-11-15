# Mail to calendar: what the app expects

The mail rules themselves (which senders matter, what to skip) live in the owner's own Google Apps Script and in the two Claude sweeps' private prompts. They hold personal sender lists, so they are not in this public repo. This file only records the shape of calendar items the app reads over iCal.

- A deadline becomes `Due: <what>`, a session or appointment becomes `Action: <what>`.
- An important email with no date to act on becomes an all-day `Mail: <short subject>` event on the day it arrived. Its description holds the key facts in one or two lines. The app shows these under "Needs your attention" until ticked or a week passes, and keeps them out of the schedule.
- Meeting links, document links and the Gmail message link go on their own lines in the event description (the app turns them into Join, Open, Form and Mail buttons).
- Never put passcodes, OTPs, applicant IDs, phone numbers or copied email text into an event.
