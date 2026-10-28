# CIVIC SYNC AI — SCREEN FLOW & INTERACTION DESIGN
**Design file 2 of 2 | Build and test guide for Antigravity**

## Primary user journeys

### Citizen: submit and track a complaint
Landing → Sign in/register → Citizen dashboard → Submit complaint → Validate fields/photos/location → Optional AI suggestions → Submit → Confirmation and tracking ID → Timeline/status → Resolution photo visible → Rating and optional feedback.

Branches:
- Missing details: show friendly inline suggestions; citizen decides whether to edit.
- Offline: save a local draft/queued submission, show sync status, retry idempotently after connectivity returns.
- AI unavailable: continue using rule-based category/deadline workflow; clearly label fallback.
- Suspected duplicate: retain the submission and link it for review rather than silently rejecting it.
- Rejected/resolved and citizen disagrees: request review → review status → decision/outcome.

### Administrator: review and assign
Admin sign-in → Admin dashboard → Unassigned/overdue queue → Report detail → Review AI suggestions/flags → Confirm or change category/department/priority → Assign → Deadline and reminder schedule → Monitor workload, appeals, analytics and public scorecard data.

### Department staff / field worker: complete assigned work
Staff sign-in → Assigned task list → Task detail → Open location/directions → Update progress → Upload after-repair photo → Submit resolution → Citizen notified → Citizen may rate or request review.

### Public visitor: transparency and official information
Landing → Public transparency dashboard → Filter aggregate metrics → Civic knowledge center with official source links → Confirmed maintenance calendar. Public visitor must not be able to open private complaint details.

## State and status model
Suggested lifecycle, adapted to the existing app's current status names:
- Submitted
- Under Review
- Assigned
- In Progress
- Resolved
- Rejected
- Blocked
- Review Requested / Under Appeal / Review Completed (if separate appeal state is preferable, keep it linked to the complaint)

All transitions must be authorized and logged. Define permitted transitions server-side. Staff cannot resolve without after-repair photo. Administrators can correct errors with audit trail. Avoid deleting history to “fix” a status.

## Navigation map
- **Public:** Home, How It Works, Transparency, Maintenance Calendar, Civic Knowledge, Sign In.
- **Citizen:** Dashboard, My Complaints, Submit Complaint, Notifications, Profile/Preferences, Help.
- **Administrator:** Overview, Reports/Queue, Departments & Workload, AI Review Flags, Appeals, Analytics, Deadline Settings, Audit/Access logs as supported.
- **Field worker:** My Tasks, Task History, Notifications, Profile.
Keep links role-specific and verify authorization on the server. Do not reuse the same label for different destinations.

## AI behavior patterns
- AI Vision Inspector: image observations, confidence/limitations, human-review marker; no automatic accusation or penalty.
- Emergency Response Mode: “Potential hazard — urgent review recommended” with reason; not “confirmed emergency.”
- Predictive Problem Radar: show period, signals used, confidence/uncertainty, and estimate disclaimer.
- What-if simulation: inputs and assumptions visible; results labelled estimates, never guarantees.
- Knowledge center: answer + official source reference + last-checked date if available; if sources unavailable, say so.
- AI outage: visible fallback indicator; essential workflows continue with deterministic rules.
- AI suggestions never silently overwrite citizen-entered data.

## Notifications
- In-app and email alerts for complaint status changes, assignment/relevant updates, deadline reminders, review outcomes, and maintenance notices where enabled.
- Avoid sending unnecessary sensitive information in email; link back to authenticated portal.
- Show notification delivery state where possible; provide safe retry without duplicates.

## Data and privacy behavior
- Private reports/photos by default; public scorecard uses anonymized aggregates.
- Citizen sees own complaints only; staff sees assigned complaints; administrators receive privileged access only where necessary.
- Role checks enforced in API and database policies, not only in navigation.
- Do not store secrets in source control. Keep provider keys server-side.
- Minimize offline sensitive data and clear queued local data safely after successful sync where feasible.

## Edge cases to test
- Double-click submit and retry after timeout.
- Lost internet during upload or submit.
- AI provider timeout, quota exceeded, invalid response, or missing credentials.
- Citizen attempts to access another user's report URL.
- Staff attempts to edit an unassigned report.
- Resolution without after-photo.
- Suspicious evidence flag without sufficient confidence.
- Public dashboard request with private identifiers.
- Appeal requested after rejection and after resolution.
- English/Telugu switching mid-form.
- Voice permission denied or microphone unavailable.
- Email delivery failure.
- Deadline timezone and daylight/time formatting.
- Mobile photo upload, large file, unsupported format, and poor connectivity.

## Definition of done
Each journey works end-to-end in the deployed environment, role permissions are tested server-side, errors are understandable, no fake AI output is presented as real, sensitive data remains private, and the README records setup, tests, configuration, limitations, and known gaps.
