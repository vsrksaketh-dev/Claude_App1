# Daily brief rules

The morning routine reads this file each run. Edit it to change what gets surfaced; no code changes needed.

## Accounts
1. **GIM / college (most important):** the secondary Gmail connected through Composio (alias "GIM").
2. **Main Gmail:** the primary Gmail connector. Lower volume, mostly banks and promos.

## INCLUDE (surface in `inbox`, ranked by deadline)
- Placement Office (`placement@gim.ac.in`): pre-placement talks, "Finals at <company>" application windows, GBMs, shortlists, interview schedules.
- PGP Office (`pgpoffice@gim.ac.in`): feedback windows, registrations, exam and timetable notices, circulars.
- Examination Control Office (`examcontroloffice@gim.ac.in`): exam schedules, seating and instructions. Only the exams whose seating sheet lists the student's roll number belong in the brief.
- Professors and faculty (individual `@gim.ac.in` staff addresses): case studies, assignments, schedule changes. Student addresses (names with batch tags such as "BDA 25-27", or local parts with `25`) are NOT faculty.
- Recruiters and company mail about the user's applications: next steps, assessments, interview invites, offers (e.g. TopHire, company careers portals, Superset status changes).
- Class schedule reminders from `camugim@gim.ac.in`: turn into today's `events`, do not list as inbox items.
- Genuine account-security alerts (new sign-in, password change) only when unread and under 48 hours old.

## EXCLUDE (never surface)
- **All club and committee mail** (`*@gim.ac.in` club senders such as Prayas, Prabhaav, HRiday, Brainvista, Cultural Club, Nritya, Aarambh, Invicta, SCOPES, Cognition, Agora Lokniti, I3, Hult Prize, Health Club, SAC surveys, and anything similar). Thank-you notes, registrations, festival greetings, quizzes, competitions.
- Counsellor, wellness and mental-health mailers.
- Mess and menu mailers.
- Student-to-student mail and chain/forward mail.
- Newsletters, promotions, bank alerts and statements, OTPs, application acknowledgements that need no action, tool onboarding mail (Composio, GitHub etc.).
- Anything in Spam or Promotions.

When unsure whether a sender is a club: if the sender name is not the Placement Office, PGP Office, a named faculty member or a recruiter, treat it as excluded.

## Output
Write the brief JSON in the shape documented in the README. Per inbox item include: `id`, `from`, `subject`, `action` (one concrete sentence), `tag` (Placement, Academic, Recruiter, Security), `due` (ISO local time if there is a deadline), `account` ("GIM" or "Main"), `link` (the Gmail thread URL). Sort by due time, soonest first. Never copy meeting passcodes, OTPs, applicant IDs or Zoom links into the brief. Keep summaries to one line.

## News
News is public, so it is not kept on the private page. Each morning the routine writes `data/news.json` to the repo (shape `{date, generated, items:[{cat,title,summary,why,src,url,kind?}]; `url` is the link to the article itself (from the search result, https only), so a tap on the card in the app opens it}`) and the app reads it from GitHub.

How to search: use WebSearch in **extended** mode, one query per category (International, Indian, Business, Tech), with today's full date and specific topic words in the query. Do not use `allowed_domains`, because most major outlets block the crawler and the call fails. Quick (standard) mode returns stale pages. Use only results dated today (or clearly dated within the last 3 days, and say so in the summary). Report only what sources say, name the source, and mark early or conflicting figures as provisional. If nothing credible is found for a category, leave it out. Never write stories from memory.

## Email to calendar (what reaches the app)
The app cannot read email. A routine turns important mail into private calendar items, which the app reads through the secret iCal address:
- A deadline becomes `Due: <what>`, a session or appointment becomes `Action: <what>`.
- An important email with no date to act on (placement results, shortlists, company or recruiter updates, faculty instructions, circulars) becomes an all-day `Mail: <short subject>` event on the day it arrived. Its description holds the key facts in one or two lines. The app shows these under "Needs your attention" until ticked or a week passes, and keeps them out of the schedule.
- Never put links, passcodes, OTPs, applicant IDs, phone numbers or copied email text into an event.
