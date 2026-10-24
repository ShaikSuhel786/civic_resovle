# Civic Resolve AI --- PRD.md

**Product:** Civic Resolve AI\
**Stage:** 24-hour hackathon prototype\
**Audience:** Hackathon judges, prototype evaluators, and the
implementation agent\
**Primary goal:** Demonstrate a reliable end-to-end civic issue workflow
using synthetic data and simulated AI.

## 1. Executive summary

Civic Resolve AI is a responsive web prototype that lets authenticated
citizens report civic issues, see transparent simulated analysis, and
follow progress. Administrators review reports and assign them to the
appropriate department. Assigned staff update progress and resolve
reports. Citizens receive persisted in-app notifications and can view a
privacy-safe timeline. Admins see operational queues and aggregate
analytics.

The prototype uses HTML/CSS/JavaScript, Node.js API endpoints, Vercel,
and a dedicated Supabase project for PostgreSQL, Auth, and private photo
storage.

**Important:** This is a demonstration, not an official municipal
service or emergency channel. Use synthetic data only. Do not claim a
municipal partnership, real-world AI accuracy, continuous monitoring, or
a guaranteed response time.

## 2. Goals and non-goals

### Goals

-   Demonstrate the full Citizen → Admin → Staff → Citizen workflow.
-   Persist reports, assignments, events, notifications, and permitted
    photo metadata.
-   Show explainable deterministic simulated analysis and priority
    scoring.
-   Enforce role-based access and report ownership on the
    server/database.
-   Make the UI polished, responsive, accessible, and credible for
    judging.
-   Deploy the prototype to Vercel with a dedicated Supabase demo
    project.
-   Provide clear setup and evaluator instructions.

### Non-goals for the 24-hour prototype

-   Production launch or official municipal integration.
-   Real citizen personal data.
-   A trained/validated AI model or claims of calibrated confidence.
-   Automatic staff assignment or automatic report resolution.
-   Public issue map/list or public report-level details.
-   Native mobile app.
-   Complex forecasting, workload optimization, or advanced analytics.
-   Mandatory photo evidence.
-   Public self-registration or user-selected roles.
-   Full production compliance, operational monitoring, or
    incident-response program.
-   Elaborate announcement-management or rare duplicate-group tooling if
    time is constrained.

## 3. Users and roles

### Public visitor

Can view landing page, prototype disclaimer, and approved aggregate
synthetic demo statistics. Cannot see individual reports.

### Citizen

Can sign in, submit reports, see their own reports and permitted
primary-report information, add follow-ups, see their
timeline/notifications, and request corrections, withdrawal, reopening,
or review where allowed.

### Department Staff

Can see only currently assigned reports. Can add private notes, update
permitted status, submit recommendations, and resolve assigned reports
with a required summary. Cannot see the unassigned queue or former
assignments.

### Admin

Can see all operational reports, review low-confidence analysis, handle
safety alerts, start formal review, assign/reassign staff,
confirm/reverse duplicate relationships, resolve duplicate-group review,
manage staff activation/category/department mappings, and view aggregate
analytics.

### Authorized reviewer

Only exists if explicitly configured with narrowly scoped permission. Do
not assume ordinary staff can perform Admin review actions.

## 4. Primary user journey

1.  Citizen signs in using a preconfigured demo account.
2.  Citizen enters a description (20--2,000 characters), location, and
    optional category/photos. The title is generated from the
    description and remains editable.
3.  Server validates the request and saves the report with a stable
    idempotency key.
4.  Only after successful persistence, the citizen sees the report ID,
    submission time, initial status, location summary, analysis state,
    and links to report details/dashboard.
5.  The deterministic simulated analyzer produces suggested
    category/department, heuristic confidence, priority factors/score,
    possible duplicate candidates, and safety flags.
6.  Analysis state is updated independently from workflow status. The
    report remains `Submitted`; AI does not assign staff or change
    status.
7.  Admin reviews the report. Low-confidence analysis, potential serious
    hazards, unknown department, and other review-required cases are
    clearly flagged.
8.  Admin moves eligible report to `Under Review`, then assigns one
    report at a time to an active staff member in the mapped department.
9.  Assigned staff moves the report to `In Progress`, may block it with
    a required reason, and resolves it with a required summary; photos
    are optional.
10. Citizen receives an in-app notification and sees
    status/timeline/resolution summary.
11. Admin opens Analytics & Insights to view aggregate synthetic
    metrics.

## 5. Functional requirements

### FR-01 Authentication and role access

-   Use Supabase Auth.
-   Seed preconfigured Citizen, Staff, and Admin accounts via a trusted
    process.
-   No public self-registration and no role selection by the user.
-   Redirect according to server-verified role.
-   Use server-side active-account checks and explicit logout/session
    expiry.
-   Password reset may use Supabase Auth if configured; test delivery
    and document fallback for demo.
-   Do not expose privileged credentials or service-role key in frontend
    or public pages.

**Acceptance criteria** - Each demo account reaches the correct
role-specific interface. - Editing client-side role state cannot grant
access. - Deactivated users cannot perform protected actions. - Citizen
and Staff access boundaries are verified with negative tests.

### FR-02 Landing page

-   Premium civic-tech design, deep blue/white, clean typography, subtle
    gradients, polished product UI mockups, issue cards, priority
    indicators.
-   Avoid generic city-cleaning stock imagery.
-   Citizen-first hero, "Report a Civic Issue" CTA, "Explore How It
    Works" CTA, three-step workflow, aggregate synthetic demo
    statistics, sign-in link, prototype disclaimer.
-   Public page does not expose report-level data.

**Acceptance criteria** - Responsive on desktop/tablet/mobile. - Demo
statistics are labelled synthetic. -
Prototype/not-official/not-emergency disclaimer is visible.

### FR-03 Report submission

-   Required description 20--2,000 characters.
-   Required usable address or map pin.
-   Optional category, optional photos, optional GPS after explicit
    citizen action.
-   Generated editable title.
-   Address search, movable map pin, optional GPS.
-   If geocoding fails, allow usable manual address and mark location
    unverified.
-   Municipality boundary is configurable; warn for out-of-area reports
    but allow submission for Admin review.
-   Privacy notice in English/Telugu before first submission; store
    notice version and acknowledgement timestamp.
-   Use stable idempotency key; persist before success screen.
-   Photo upload failures never block report creation.

**Acceptance criteria** - Citizen can submit without a photo. - A usable
address can be submitted without verified coordinates. - Repeated
submission request with same idempotency key does not create a
duplicate. - Success screen appears only after database commit. - Failed
analysis or upload does not remove the saved report.

### FR-04 Simulated AI analysis

-   Deterministic, rule-based analyzer behind a replaceable interface.
-   Same input yields consistent output.
-   Suggested category and department use configurable keyword/category
    rules.
-   Confidence is a 0--100 heuristic, not a calibrated probability.
-   Priority uses fixed formula:
    `0.40 × Severity + 0.30 × SafetyRisk + 0.20 × PeopleAffected + 0.10 × IssueDuration`.
-   Each factor normalized to 0--100.
-   Potential serious hazards always trigger urgent Admin review
    regardless of score.
-   Duplicate similarity yields candidates only.
-   Analysis states: `Pending`, `Completed`, `Failed`.
-   Workflow status remains separate; AI never assigns staff or resolves
    reports.
-   Label outputs "Simulated AI analysis."

**Acceptance criteria** - Analysis displays category/department
suggestion, confidence, priority score and factors, possible duplicates,
safety flags, review requirement, and analysis state. - Confidence below
80 requires Admin review. - Confidence \>=80 proceeds to normal Admin
assignment workflow but does not automatically assign. - Failed analysis
leaves report saved and retryable. - Safety flags cannot be silently
cleared.

### FR-05 Categories and departments

Initial categories: 1. Roads and potholes 2. Streetlights 3. Garbage and
sanitation 4. Water supply and leakage 5. Drainage and sewage 6. Public
property damage 7. Traffic signs and road safety 8. Other civic issues

Initial mapping: - Roads & Transport: roads/potholes; traffic signs/road
safety. - Electrical Services: streetlights. - Sanitation:
garbage/sanitation. - Water & Drainage: water supply/leakage;
drainage/sewage. - Public Works: public property damage. - Other civic
issues: Admin review until responsible department selected.

**Acceptance criteria** - Admin can assign only to an active staff
member in the report's mapped department. - Category correction requires
review and triggers routing reassessment, priority recalculation, and
duplicate reassessment. - Keep category management simple; no elaborate
configuration UI required for the demo.

### FR-06 Report status and workflow

Main flow:
`Submitted → Under Review → Assigned → In Progress → Resolved`

Alternative states: - `Blocked`: requires staff reason; can return to
`In Progress`. - `Rejected`: terminal in ordinary workflow, requires
reason/category and citizen notification; only explicit audited Admin
recovery can restore it. - `Withdrawn`: approved citizen withdrawal;
preserves record/history, not deletion. - `Duplicate`: confirmed
duplicate indicator/relationship, not equivalent to Resolved. -
`Review Required`: duplicate group state, not necessarily a report
status.

Rules: - Only Admin/authorized reviewer can move `Submitted` to
`Under Review`. - AI does not change workflow status. - Status changes
are server-validated against current state atomically. - Resolved and
Rejected are terminal in ordinary workflow. - Reopening Resolved
requires citizen request and review. - Rejected recovery requires
explicit audited Admin decision. - Blocked requires reason. - Staff can
act only on current assigned reports. - Staff resolve with required
summary; resolution photos optional. - Save status change and event
atomically; notify citizen after commit.

**Acceptance criteria** - Invalid transitions are rejected. - Concurrent
conflicting updates cannot silently overwrite each other. - Every
significant status change records actor, timestamp, previous/new state,
and reason where applicable. - Citizen sees only citizen-safe timeline
events.

### FR-07 Assignment and staff workflow

-   Admin assigns one report at a time.
-   Eligible staff must be active and in mapped department.
-   Initial assignment does not require a reason.
-   Reassignment requires reason and audit record.
-   Reassignment revokes former assignee's access immediately; notify
    relevant staff.
-   Staff dashboard shows only current assigned reports, sorted by
    priority then last update.
-   Show category, location summary, priority score, safety flag, and
    time since submission.
-   Staff may add private notes and update permitted status.
-   Unassigned reports remain Admin-only.
-   No automatic workload assignment.

**Acceptance criteria** - Staff cannot read or mutate unassigned or
former-assignment reports. - Admin cannot assign to inactive or
wrong-department staff. - Resolution requires summary and valid current
status.

### FR-08 Duplicate detection

-   AI generates candidate matches; similarity alone never confirms a
    duplicate.
-   Assigned staff can recommend matches for reports they can access.
-   Only Admin/authorized reviewer can confirm or reverse.
-   Every report remains its own record and timeline.
-   Confirmed duplicate links directly to one canonical primary; no
    chains, self-links, or cycles.
-   Citizen sees duplicate status and permitted primary link.
-   Notify reporter when duplicate is confirmed and provide primary
    link.
-   Reversal removes active link, preserves history, returns former
    duplicate to `Under Review`, reassesses routing/priority, and does
    not auto-assign.
-   If primary is withdrawn/rejected: group becomes `Review Required`;
    freeze group mutations; reviewer selects eligible replacement
    (`Submitted`, `Under Review`, `Assigned`, `In Progress`, `Blocked`)
    or separates reports. No auto-promotion/deletion.
-   Preserve audit history for confirm, reverse, and group resolution.

**Acceptance criteria** - Duplicate does not create a second repair
workflow. - No private data from another citizen is revealed. - Primary
changes are authorized, audited, and atomic. - Reversal does not alter
the primary report or silently reopen it.

### FR-09 Citizen dashboard and timeline

-   Summary counts: Active, In Progress, Resolved, Needs Attention.
-   Cards: ID, category, location summary, priority, current status,
    last update.
-   Sort by most recently updated.
-   Needs Attention is a derived indicator, not a workflow status.
-   Duplicate report remains visible to its reporter, with primary link.
-   Citizen-safe chronological timeline: status changes, appropriate
    assignment updates, explanations for blocked/rejected, duplicate
    events, resolution summary.
-   Hide private notes, internal risk assessments, and other citizens'
    private data.
-   Citizen may add text follow-up and optional photos to own active
    report.
-   Citizen may request correction, challenge category/priority, request
    withdrawal, or request reopening. Requests do not silently mutate
    report; preserve proposed values and review decisions.
-   Approved withdrawal becomes `Withdrawn`, not deletion.
-   Reopening request for duplicate must be reviewed against primary.

**Acceptance criteria** - Citizen sees only their own reports and
permitted primary information. - Dashboard counts reflect persisted data
and do not count duplicate-linked records as separate repair work. -
Notifications and timeline events do not duplicate on retries.

### FR-10 In-app notifications

-   Persist notification rows; unread badge/list and mark-as-read.
-   Core report/decision notifications always enabled.
-   Notification delivery does not change report status.
-   Stable idempotency keys prevent duplicate notifications.
-   Durable jobs retry transient failure up to three attempts with
    increasing delays, then `Failed`.
-   Admin can retry failures; audit retries. Batch max 50 jobs/request.
-   Recheck eligibility before delivery. Ineligible jobs become terminal
    `Skipped` with reason `OPTED_OUT`, `EXPIRED`, `WITHDRAWN`, or
    `ALREADY_DELIVERED`; preserve audit.
-   Atomic job claims; concurrent processing skips already-processing
    jobs. Five-minute lease; safe lease recovery does not consume an
    attempt.
-   Oldest eligible retry time first, then creation time; recovery batch
    max 50.
-   Scheduled recovery endpoint uses strong server-side secret and fails
    closed. Use fastest supported hosting cadence; do not promise
    one-minute cron.
-   If announcements are not implemented within time, do not let them
    block core report notifications.

**Acceptance criteria** - Citizen sees notification after
assignment/status/resolution/duplicate decisions as applicable. -
Retrying a job never inserts a duplicate notification. - Read/unread is
independent of delivery status. - Failure list does not expose recipient
identity.

### FR-11 Photos and uploads

-   Optional photos; max five per report including follow-ups, max 5 MB
    each, JPEG/PNG/WebP.
-   Validate actual file content and size on server.
-   Private Storage bucket, signed URLs only for authorized access.
-   Photo metadata separate from objects.
-   Upload failure does not block report submission or permanently
    consume slot.
-   Stable retry avoids duplicate attachments.
-   Do not send photos or metadata to AI.

**Acceptance criteria** - Citizen can submit with no photos. - Failed
photo can be retried. - Unauthorized users cannot retrieve private photo
URLs or metadata.

### FR-12 Admin dashboard and analytics

Admin dashboard order: 1. Urgent safety alerts/high-priority unassigned
reports. 2. Reports requiring review. 3. Blocked issues. 4. Staff
workload summary. Filters: department, status, priority, category.

Analytics: - Report volume over time. - Category distribution. -
Priority distribution. - Status breakdown. - Average resolution time. -
Duplicate reports linked. - Department workload. - Synthetic demo data
clearly labelled. - Aggregate only; no report-level details, exact
locations, photos, or identifying small cohorts.

**Acceptance criteria** - Admin queue supports review and individual
assignment. - Analytics are aggregate-only and synthetic-labelled. -
Operational actions remain more prominent than charts.

### FR-13 Location

-   Address search, movable map pin, optional GPS.
-   Manual address alternative accessible without map.
-   Usable address accepted when coordinates are unverified.
-   Municipality boundary configurable; out-of-area warning but allow
    submission for review.
-   Respect map/geocoder provider policies and limits.
-   Map/geocoder failure does not block a usable manual address.
-   Do not show exact coordinates in public statistics.

### FR-14 Privacy, safety, and demo reset

-   Synthetic data only; no real citizen PII.
-   Privacy notice before first report submission in English/Telugu;
    store version/timestamp.
-   Notice explains description/location/photos, authorized access, demo
    reset, production retention not finalized.
-   Public pages only show approved aggregate statistics.
-   Logs exclude passwords, tokens, descriptions, exact coordinates,
    photos, and PII; include safe correlation/operation/outcome fields.
-   Target operational log retention up to seven days subject to
    platform limits; audit separate.
-   Daily demo reset may restore seed data and remove designated
    evaluator activity/files only; preserve evaluator accounts/config;
    demo-only guarded, fail-closed, idempotent, audited. Reset is not a
    backup.
-   Immediate-danger notice directs users to appropriate local emergency
    service; prototype is not emergency service and promises no
    response/continuous monitoring.
-   Suspicious reports are flagged for Admin review, not auto-rejected
    solely by AI.
-   Production hardening is future work, including authorized pilot,
    validated privacy/retention, security review, backup/recovery tests,
    Admin MFA, monitoring, and incident response.

## 6. Non-functional requirements

### Security

-   RLS and server-side role checks.
-   Active-account validation for every protected request.
-   Service-role key server-only.
-   Atomic workflow transitions and assignment changes.
-   Rate limits separate from idempotency.
-   Safe error messages; no secret or PII leakage in logs.
-   Audit significant privileged actions.

### Reliability

-   Persist report before success.
-   AI and photo failures do not lose report.
-   Idempotent report submission, upload retry, and notification
    delivery.
-   Bounded retry policies.
-   Graceful map/geocoder outage.

### Accessibility and usability

-   Responsive desktop/tablet/mobile.
-   Keyboard-accessible forms and map alternatives.
-   Visible focus, labels, readable contrast, semantic status
    text/icons.
-   English/Telugu citizen-facing support; Admin English initially.
-   Useful loading, empty, error, and success states.

### Maintainability

-   Versioned SQL migrations.
-   Deterministic seed script.
-   Environment example without secrets.
-   Replaceable analysis interface.
-   Clear README and evaluator guide.

## 7. Data model requirements

Core tables: - `profiles` - `departments` - `categories` - `reports` -
`assignments` - `report_events` - `audit_events` -
`duplicate_relationships` - `private_notes` - `photo_metadata` -
`notifications` - `notification_jobs`

Use foreign keys, check/unique constraints, RLS, and versioned
migrations. Add specialized tables only when needed. Use private object
storage for photo bytes. Avoid a single-table or JSON-only design for
operational data.

## 8. Demo data

-   Seed 20--30 synthetic reports across categories, departments,
    statuses, priority levels, and duplicate cases.
-   Include at least one serious-hazard flagged report, one
    low-confidence analysis, one confirmed duplicate pair, one blocked
    report, and one resolved report.
-   Provide preconfigured Citizen, Staff, and Admin accounts via trusted
    setup.
-   No real names, addresses, phone numbers, or citizen PII. Use clearly
    synthetic labels and safe example locations.
-   Seed scripts must be deterministic and safe to rerun or provide an
    explicit reset mode.

## 9. Acceptance test plan

### Core workflow

-   [ ] Citizen can sign in and submit description + usable location
    without photo.
-   [ ] Report is persisted and receives unique reference ID.
-   [ ] Confirmation appears only after successful save.
-   [ ] Simulated analysis completes and shows category, confidence,
    priority factors, duplicate candidates, and safety state.
-   [ ] AI analysis state is separate from workflow status.
-   [ ] Admin starts review and assigns active staff in mapped
    department.
-   [ ] Staff sees only assigned report and updates status.
-   [ ] Staff resolves with summary.
-   [ ] Citizen receives notification and sees timeline/resolution
    summary.
-   [ ] Admin analytics shows aggregate synthetic metrics.

### Security and integrity

-   [ ] Citizen cannot access another citizen's report.
-   [ ] Staff cannot access unassigned or former-assignment report.
-   [ ] Client cannot grant itself Admin role.
-   [ ] Unauthorized or invalid status transitions are rejected.
-   [ ] Wrong-department/inactive staff cannot be assigned.
-   [ ] Duplicate self-links/cycles are rejected.
-   [ ] Retries do not create duplicate reports, photos, or
    notifications.
-   [ ] Private photos and internal notes remain protected.
-   [ ] Privileged keys are absent from frontend bundle and Git.

### Failure cases

-   [ ] AI failure after report save leaves report intact.
-   [ ] Photo upload failure leaves report intact and supports retry.
-   [ ] Map/geocoder failure permits usable manual address.
-   [ ] Notification failure is retryable and does not roll back report
    status.
-   [ ] Clear error/loading/empty states are shown.

### Demo honesty

-   [ ] Simulated AI label is visible.
-   [ ] Analytics labelled synthetic demo data.
-   [ ] Prototype disclaimer visible.
-   [ ] No claim of official municipal authorization or guaranteed
    response.
-   [ ] README explains prototype limitations.

## 10. Suggested 24-hour execution plan

Prioritize by dependency, not by screen count:

1.  **Hours 0--2:** Inspect repository, create project structure, env
    example, design tokens, README outline.
2.  **Hours 2--5:** Supabase schema/migrations/RLS/seed accounts and
    synthetic reports.
3.  **Hours 5--8:** Auth, active-account checks, role-based navigation.
4.  **Hours 8--11:** Report form, location fallback, idempotent
    persistence, confirmation.
5.  **Hours 11--13:** Deterministic analyzer, priority formula, safety
    flags, analysis state.
6.  **Hours 13--16:** Admin review/assignment; Staff
    queue/status/resolution.
7.  **Hours 16--18:** Citizen dashboard, timeline, in-app notifications.
8.  **Hours 18--20:** Private optional photo upload and retry; basic
    duplicate linking.
9.  **Hours 20--21:** Admin analytics and visual polish.
10. **Hours 21--23:** Security and end-to-end tests; fix blockers.
11. **Hours 23--24:** Vercel deployment, live smoke test,
    README/evaluator guide.

If schedule slips, simplify charts, animations, optional announcements,
advanced duplicate group management, and secondary workflows. Do not
sacrifice report persistence, role isolation, server-side authorization,
safe status transitions, or the end-to-end judge demo.

## 11. Deliverables

-   Responsive deployed Vercel demo.
-   Dedicated Supabase demo project configuration.
-   Versioned SQL migrations and deterministic synthetic seed script.
-   `.env.example` with names only, no secrets.
-   README with local setup, Supabase setup, migrations, seed
    instructions, demo account access, deployment, architecture, and
    limitations.
-   Evaluator guide describing the six-step demo journey.
-   `DESIGN.md` and `PRD.md`.
-   Short list of known limitations and future production hardening
    items.
