# Civic Resolve AI --- DESIGN.md

**Document purpose:** Implementation guide for Google Antigravity\
**Project stage:** 24-hour hackathon prototype\
**Status:** Approved discovery decisions consolidated into build-ready
design\
**Product boundary:** Demonstration only; not an official municipal
service or emergency-response channel

## 1. Product and design principles

Civic Resolve AI is a responsive civic-issue reporting and workflow
prototype. Citizens submit a description and location; a deterministic
simulated analyzer suggests a category, department, priority, and
possible duplicates; an Admin reviews and assigns work; assigned
Department Staff update progress and resolve the issue; citizens follow
their reports and receive in-app notifications.

Design principles:

1.  **End-to-end workflow first.** A reliable persisted
    citizen-to-staff-to-citizen journey is more important than advanced
    analytics or animations.
2.  **Explainable, simulated AI.** The prototype must clearly label
    analysis as simulated and never claim a trained or validated
    real-world model.
3.  **Privacy by default.** Use synthetic data only. Do not use real
    citizen PII. Reports and photos are private.
4.  **Server-side authorization.** Frontend visibility is not a security
    boundary. Validate every protected action on the server and in
    Supabase RLS policies.
5.  **Graceful failure.** A report remains saved if AI analysis or a
    photo upload fails.
6.  **Honest demo framing.** No municipal partnership, authorization,
    response-time, or emergency-service claims.

## 2. Technology architecture

### 2.1 Approved stack

-   Frontend: HTML, CSS, JavaScript; use a lightweight client-side
    structure suitable for the prototype.
-   Backend: Node.js API endpoints for privileged operations and
    workflow transitions.
-   Database/auth/storage: Supabase PostgreSQL, Supabase Auth, and
    private Supabase Storage.
-   Hosting: Vercel for the frontend and supported server endpoints.
-   Map: Leaflet with a compliant OpenStreetMap-based tile/geocoding
    provider configured through environment variables.
-   Source control: GitHub repository with `.gitignore`, versioned SQL
    migrations, deterministic seed scripts, and a README.

### 2.2 Logical architecture

``` text
Browser (responsive UI)
   ├── Public landing page and aggregate demo stats
   ├── Citizen / Staff / Admin interfaces
   └── Supabase Auth session
          |
          v
Node.js server/API endpoints
   ├── Authorization and active-account checks
   ├── Report submission / idempotency
   ├── Simulated analysis and priority calculation
   ├── Status transitions / assignments / duplicate review
   ├── Private upload authorization
   ├── Audit events and in-app notifications
   └── Admin analytics aggregation
          |
          v
Supabase
   ├── PostgreSQL + RLS
   ├── Auth
   └── Private Storage bucket for report photos
```

### 2.3 Environment separation

Create a dedicated **demo** Supabase project. Use separate Vercel
environment variables for local development, preview, and demo
deployment where applicable. Do not configure production as part of the
hackathon deliverable.

Example variable names (never commit values):

-   `SUPABASE_URL`
-   `SUPABASE_ANON_KEY`
-   `SUPABASE_SERVICE_ROLE_KEY` --- server only; never exposed to the
    browser
-   `DEMO_CRON_SECRET` --- server only if a scheduled recovery endpoint
    is implemented
-   `MAP_TILE_URL` / `GEOCODING_PROVIDER` --- only if the chosen
    provider requires configuration

Only public, publishable Supabase configuration may appear in the
browser. All privileged keys must remain server-side and absent from
Git, logs, screenshots, and README examples.

## 3. Roles and access control

### 3.1 Roles

-   **Public visitor:** Landing page, prototype disclaimer, and approved
    aggregate synthetic statistics only.
-   **Citizen:** Own reports, permitted primary-report details, own
    timeline, own notifications, own follow-ups,
    correction/reopening/withdrawal requests.
-   **Department Staff:** Only currently assigned reports; private notes
    and permitted status actions for those reports.
-   **Admin:** All operational reports, review queues, assignments,
    category/department mappings, duplicate decisions, staff activation,
    announcements if implemented, and aggregate analytics.
-   **Authorized reviewer:** A narrowly permissioned Admin-like
    capability only if explicitly configured. Do not assume every staff
    member is an authorized reviewer.

### 3.2 Authorization requirements

-   Resolve role from trusted server-side profile/claims, not from
    request body or client state.
-   Enforce active-account checks on each protected API request.
-   Citizens can access only their own report records and permitted,
    privacy-safe primary-report information.
-   Staff can access only reports currently assigned to them.
    Reassignment revokes the former assignee's access immediately.
-   Admin-only operations include assignment, reassignment,
    confirmation/reversal of duplicate relationships, primary-group
    resolution, serious-hazard flag clearing, staff
    activation/deactivation, and review decisions.
-   Apply Supabase RLS to direct database access. Route sensitive
    mutations through server endpoints that validate role, record
    ownership, current state, and request shape.
-   Keep service-role keys exclusively on the server. Do not let the
    browser directly perform privileged mutations.
-   Private staff notes, audit details, exact coordinates, and other
    citizens' private information must never appear in public data or
    citizen-safe timeline payloads.

## 4. Visual system and UI requirements

### 4.1 Visual direction

Premium civic-tech; deep blue and white; clean typography; subtle
gradients; polished product UI mockups; issue cards; visible priority
indicators. Avoid generic city-cleaning stock imagery. Show product UI
and workflow visuals instead.

Suggested design tokens (adjust consistently during implementation):

-   Primary deep blue: `#123A72`
-   Interactive blue: `#2563EB`
-   Pale blue surface: `#EFF6FF`
-   Main background: `#F8FAFC`
-   Main text: `#0F172A`
-   Secondary text: `#475569`
-   Success: `#15803D`
-   Warning: `#B45309`
-   Danger: `#B91C1C`
-   Border: `#D9E2EF`

Use semantic status text and icons in addition to color. Maintain strong
contrast, visible keyboard focus, accessible labels, responsive layouts,
and useful loading/empty/error/success states. Aim for WCAG 2.2 AA where
practical.

### 4.2 Responsive behavior

-   Desktop: persistent sidebar or clear top navigation for signed-in
    dashboards; main content with cards and a readable table/list.
-   Tablet: compact navigation and reduced columns.
-   Mobile: stacked cards, touch-friendly controls, non-map location
    entry, and no horizontally overflowing tables.
-   Map selection must have a keyboard-accessible/manual address
    alternative.
-   English and Telugu are supported for citizen-facing screens. Admin
    screens may be English initially. Preserve original report text; any
    translation is optional and clearly labelled.

## 5. Screen specifications

### Screen 1 --- Landing page

-   Hero explains civic issue reporting, explainable simulated analysis,
    and tracking.
-   Primary CTA: "Report a Civic Issue"; requires sign-in before
    submission.
-   Secondary CTA: "Explore How It Works."
-   Three-step explanation: Report → AI Analysis → Track Progress.
-   Show only approved aggregate synthetic demo statistics.
-   Include a visible disclaimer: prototype only, not an official
    municipal or emergency service; no response or resolution time is
    promised.
-   No public registration or public issue feed.

### Screen 2 --- Report an Issue

Required: - Description, 20--2,000 characters. - Usable address or
selected map pin. Optional: - Category selection from eight
categories. - Photos (up to five per report including follow-ups, max 5
MB each; JPEG/PNG/WebP). - GPS, only after user chooses it. - Editable
title generated from the description. Location: - Address search,
movable map pin, optional GPS. - Allow usable address-only submission
when coordinates cannot be verified; mark as unverified. - Configurable
municipality boundary check. Warn for out-of-area locations but allow
submission for Admin review. - Map/geocoding outage must not block a
usable manual address. Submit: - Server-side validation. - Stable
idempotency key for submission retries. - Persist report before showing
success. - Photo upload is independent; upload failure never blocks
report creation. - Show clear privacy notice and acknowledgement before
first submission; acknowledgement version and timestamp are stored.

### Screen 3 --- AI Analysis Result

Display: - Suggested category and department. - Heuristic confidence
score (0--100; not calibrated probability). - Priority score (0--100),
level, factor breakdown, and reasons. - Possible duplicate candidates
(not confirmed duplicates). - Safety flags and whether Admin review is
required. - Analysis state: `Pending`, `Completed`, or `Failed`. Clearly
label "Simulated AI analysis" and suggestions as unverified until
reviewed where required. Analysis must not change report workflow
status, assign staff, or resolve reports.

### Screen 4 --- Duplicate Detection

-   Show possible matches to authorized reviewers with safe summaries
    and similarity rationale.
-   AI similarity is only a candidate signal.
-   Assigned staff may recommend a match for reports they are authorized
    to access.
-   Only Admin or explicitly authorized reviewer confirms or reverses a
    relationship.
-   Confirmed duplicate stays as a separate report record, with its own
    timeline, linked directly to one canonical primary.
-   Citizen sees "Duplicate --- linked to Report #..." and may follow
    permitted primary progress without seeing another citizen's private
    data.
-   Confirmation notifies the reporter with the primary report link.
-   Reversal removes active link, preserves history, returns former
    duplicate to `Under Review`, reassesses priority/routing, and does
    not auto-assign staff.
-   Prevent self-links, cycles, multiple active primary assignments, and
    duplicate chains server-side.
-   If a primary is withdrawn or rejected, mark group `Review Required`,
    freeze group mutations, and require Admin/reviewer to select an
    eligible replacement or separate reports. Eligible replacement
    statuses: `Submitted`, `Under Review`, `Assigned`, `In Progress`,
    `Blocked`. If none qualifies, separate reports for independent
    review. Do not automatically promote or delete.

### Screen 5 --- Priority Ranking

Priority formula:

`Priority = 0.40 × Severity + 0.30 × SafetyRisk + 0.20 × PeopleAffected + 0.10 × IssueDuration`

Each factor is normalized to 0--100. Show factor values and a short
explanation. The server calculates the score deterministically. - AI
confidence is separate from priority. - Potential serious hazards always
require urgent Admin review regardless of score. - Admins may propose
factor corrections; authorized approval recalculates score and creates
an audit record. - No manual numeric priority override. - Safety flag
cannot be silently cleared; only an explicit Admin action with a reason
and audit event can clear it.

### Screen 6 --- Citizen Dashboard

-   Summary counts: Active, In Progress, Resolved, Needs Attention.
-   Report cards show ID, category, location summary, priority, current
    status, last update.
-   Sort by most recently updated.
-   Show duplicate status and primary-report link.
-   Duplicate-linked records remain visible to their reporter but should
    not be double-counted as independent repair work.
-   `Needs Attention` is a separate derived indicator, not a workflow
    status; define it from blocked status, pending citizen action, or
    pending review as appropriate.
-   Only show the signed-in citizen's reports and permitted
    linked-primary information.

### Screen 7 --- Issue Detail & Timeline

-   Chronological citizen-safe events with timestamps, status changes,
    appropriate assignment updates, citizen-visible blocked/rejected
    explanations, duplicate link changes, and resolution summary.
-   Internal audit trail is more complete than the citizen timeline.
-   Never expose private staff notes, internal risk assessments,
    credentials, or another citizen's private information.
-   Citizens may add follow-up text and optional photos to their own
    active reports.
-   Citizens can request correction, challenge category/priority,
    request withdrawal, and request reopening of resolved reports.
    Requests do not silently mutate the underlying report; preserve
    proposed values and review decisions.
-   Approved correction triggers routing review, priority recalculation,
    and duplicate reassessment.
-   Approved withdrawal becomes `Withdrawn`, not deletion.
-   Reopening a resolved report requires review; if duplicate-linked,
    assess against the primary.

### Screen 8 --- Admin Dashboard

Action-first order: 1. Urgent safety alerts and high-priority unassigned
reports. 2. Reports requiring Admin review. 3. Blocked issues. 4. Staff
workload summary. Filters: department, status, priority, category. -
Admin assigns one report at a time to an active staff member in its
mapped department. - Initial assignment does not require a reason;
reassignment requires a reason. - Server validates active account,
department membership, current report state, and permission. -
Reassignment revokes former staff access immediately and notifies
relevant staff. - Other review queues include low-confidence AI results,
citizen challenges, duplicate-group review, rejection review, and
relevant correction/reopening requests.

### Screen 9 --- Analytics & Insights

Use synthetic demo data and label it clearly. - Report volume over
time. - Category distribution. - Priority distribution. - Status
breakdown. - Average resolution time. - Duplicate reports linked. -
Department workload. - Aggregate only. No report-level private details,
exact locations, photos, or identifying small cohorts. - Do not present
synthetic metrics as real municipal performance. - Detailed analytics
live here, not at the top of the action-first Admin Dashboard.

### Sign-in and role landing

-   Standard sign-in form.
-   Preconfigured Citizen, Department Staff, and Admin demo accounts.
-   README/evaluator guide provides demo account instructions; never put
    privileged credentials in frontend code or public pages.
-   Redirect according to server-verified role.
-   No public self-registration or user-selected role.
-   Password reset uses Supabase Auth if configured; test email
    delivery. Trusted Admin recovery fallback may be documented for the
    demo.
-   Explicit logout, session expiry, and server-side active-account
    checks.

## 6. Report categories and departments

Initial categories: 1. Roads and potholes 2. Streetlights 3. Garbage and
sanitation 4. Water supply and leakage 5. Drainage and sewage 6. Public
property damage 7. Traffic signs and road safety 8. Other civic issues

Initial demo department mapping: - Roads & Transport: Roads and
potholes; Traffic signs and road safety. - Electrical Services:
Streetlights. - Sanitation: Garbage and sanitation. - Water & Drainage:
Water supply and leakage; Drainage and sewage. - Public Works: Public
property damage. - Other civic issues: Admin review until a responsible
department is selected.

Mappings are configurable data, but do not build an elaborate
category-management system unless time remains.

## 7. Workflow state model

### 7.1 Report status

Primary flow:
`Submitted → Under Review → Assigned → In Progress → Resolved`

Alternative states: - `Blocked`: assigned staff action requiring a
reason; may return to `In Progress`. - `Rejected`: terminal in ordinary
workflow; requires category/reason and citizen notification. Only
explicit audited Admin recovery can restore it. - `Withdrawn`:
citizen-requested withdrawal approved by Admin; preserve record and
history. - `Duplicate`: relationship/status indicator for a confirmed
duplicate; not equivalent to Resolved. - `Review Required`: duplicate
group flag, not necessarily a report status.

`Resolved` and `Rejected` are terminal in ordinary workflow. Reopening a
resolved report requires citizen request and review. Rejected recovery
is an explicit audited Admin decision. All transitions are validated
server-side against current status inside a transaction or equivalent
atomic operation.

### 7.2 AI analysis state (separate)

`Pending`, `Completed`, `Failed`. - New reports are saved as
`Submitted`. - AI completion never changes workflow status. - Failed
analysis leaves the report intact and can be retried safely. -
Confidence \>=80 proceeds to normal Admin assignment workflow; below 80
requires Admin review. - Serious hazards always trigger urgent Admin
review regardless of confidence/score.

### 7.3 Assignment

-   Admin-controlled; no automatic workload assignment.
-   Assign only to active staff in the mapped department.
-   Reassignment requires reason and audit record.
-   Former assignee loses access immediately.

### 7.4 Resolution

-   Assigned staff or authorized Admin can resolve only if current state
    and permissions permit.
-   Required resolution summary; photos optional.
-   Save transition and event atomically.
-   Notify citizen via in-app notification.
-   Show safe summary on citizen timeline.

## 8. Data model

Recommended core tables (exact names may use snake_case): - `profiles`:
`id` references Supabase Auth user, display name, role, active state,
preferred language. - `departments`: name, active state. - `categories`:
name, active state, mapped department, configurable rules. - `reports`:
owner, title, original description, category suggestion/approved
category, location text, optional coordinates, verification/boundary
state, status, priority factors and score, safety flag, analysis state,
primary report reference if duplicate, timestamps, idempotency key. -
`assignments`: report, staff, assigning Admin, assigned/ended
timestamps, reason, active state. - `report_events`: report, actor,
event type, citizen-safe text where applicable, visibility, timestamp,
structured metadata. - `audit_events`: actor, action, record type/ID,
before/after values, reason, timestamp, correlation ID. Ordinary app
roles cannot update/delete. - `duplicate_relationships`: duplicate
report, canonical primary report, state, confirming reviewer,
timestamps, reversal history or event reference. - `private_notes`:
report, author, note, timestamp; visible only to authorized current
staff/Admin. - `photo_metadata`: report, uploader, private object key,
content type, size, upload state, timestamps; never public URL. -
`notifications`: recipient, event/report/announcement reference,
content-safe payload, read state, idempotency key, created/read
timestamps. - `notification_jobs`: durable job state, recipient,
published version/reference, attempt count, next eligible time, lease
token/expiry, status, skip/failure reason, timestamps. - Optional
`announcements` and `announcement_versions` only if announcements are
included in the initial build.

Use foreign keys, check constraints, unique constraints, versioned
migrations, and deterministic seed scripts. Do not place all operational
state in a single JSON column.

## 9. In-app notification reliability

For report events and any included announcement workflow: - Persist
notifications; unread badge/list and mark-as-read are supported. - Core
report/decision notifications are always enabled. - Avoid duplicates
with a stable idempotency key, e.g. recipient + event identity or
recipient + announcement published version. - Durable notification work
is independent from the report/announcement transaction where
necessary. - Automatic transient-failure retries: maximum three attempts
with increasing delays (e.g. 1, 5, 15 minutes), then `Failed`. - Admin
may retry failed jobs, with audit. Batch retry max 50 jobs/request;
report aggregate succeeded/failed/skipped counts, no recipient identity
in failure list. - Recheck eligibility before delivery. Ineligible jobs
become terminal `Skipped` with reason: `OPTED_OUT`, `EXPIRED`,
`WITHDRAWN`, `ALREADY_DELIVERED`; preserve audit history. - Job claim
must be atomic; concurrent processors skip jobs already processing. Use
a 5-minute lease and safe expired-lease recovery. Lease recovery itself
does not consume an attempt. - Recovery ordering: earliest
`next_eligible_retry_at`, then creation time; batch max 50. Skip
ineligible jobs. Recover leases during normal processing/Admin retries
and use the fastest supported scheduled cadence. Do not promise a
one-minute cron if the hosting plan cannot support it. - Scheduled
endpoint must fail closed and require a strong server-side secret in a
header. Never expose secret in frontend, Git, or logs. - If
announcements are implemented: only Admins create/edit/publish/withdraw;
both English and Telugu versions required to publish; public visitors
can read currently published citywide announcements; optional
notification opt-in controls future announcement notifications;
withdrawal/expiry stops future delivery but does not erase
notification/audit history. Keep this secondary to the core report
workflow if time is tight.

## 10. Uploads, locations, and resilience

### Photos

-   Max five photos per report including follow-ups; max 5 MB each;
    JPEG/PNG/WebP.
-   Server validates actual content, size, and authorization.
-   Private bucket; signed URLs only for authorized access.
-   Atomic slot reservation or equivalent concurrency-safe logic.
-   Failed upload does not permanently consume a slot; stable retry must
    not duplicate attachments.
-   Photo metadata remains private; never send images/metadata to the
    analyzer or external AI.

### Location

-   Address search + movable map pin + optional GPS.
-   GPS only after explicit user action.
-   Accept usable address-only submission; mark unverified when
    coordinates are missing/unverified.
-   Configurable municipality boundary; warn on out-of-area location but
    allow submission for Admin review.
-   Respect tile/geocoder provider terms and rate limits.
-   If map/geocoder fails, manual address remains usable.

### Failure behavior

-   AI failure after report save: report remains saved; analysis
    `Failed` or `Pending`, safe retry.
-   Photo failure: report remains saved; per-photo retry; no duplicate
    report.
-   Map outage: usable manual address remains accepted.
-   Notification failure: durable job is retried; do not roll back
    report/status.
-   Database mutation: validate state and authorization atomically;
    return clear, non-sensitive error messages.
-   Add bounded retries and rate limits per
    account/report/photo/endpoint. Rate limits are separate from
    idempotency.

## 11. Privacy, safety, and demo limitations

-   Use synthetic reports and demo accounts only; no real citizen PII.
-   Display a privacy notice before first submission in English/Telugu.
    Record notice version and acknowledgement timestamp. Acknowledgement
    does not authorize real-data use.
-   The notice explains collected description/location/photos,
    authorized access, demo reset, and that production retention is not
    finalized.
-   Public pages expose aggregate approved statistics only; no public
    issue list or exact locations.
-   Logs include timestamp, correlation ID, operation, outcome, and safe
    error category; exclude passwords, tokens, descriptions, exact
    coordinates, photos, and PII. Target up to seven days of operational
    log retention subject to platform limits. Audit records are
    separate.
-   Daily demo reset may restore seed data and remove designated
    evaluator activity/files only; preserve evaluator accounts/config.
    Guard reset as demo-only, fail closed, idempotent, and audited. It
    is not a backup.
-   Backup plan: versioned migrations and deterministic seed scripts;
    use platform backups only if configured. Do not claim point-in-time
    recovery unless enabled and tested. Consider storage objects
    separately.
-   Immediate-danger notice: tell citizens to contact the appropriate
    local emergency service. Civic Resolve AI is not an emergency service
    and does not promise continuous monitoring or response.
-   Suspicious/spam reports are flagged for Admin review; do not
    auto-reject solely from AI suspicion. Account restrictions, if
    implemented, require Admin review, reason, duration, server-side
    enforcement, and a separately rate-limited urgent-hazard path.
-   Production hardening is future work: authorized pilot, real
    privacy/retention policy, security review, backups/recovery tests,
    Admin MFA, monitoring, incident response, and validated AI.

## 12. Implementation order for Antigravity

1.  Inspect repository and write a concise implementation plan; do not
    overwrite existing work without inspection.
2.  Establish project structure, environment example, and responsive
    design tokens.
3.  Add versioned SQL migrations, RLS policies, seed script, and
    demo-account setup instructions.
4.  Implement authentication, active-account checks, and role-based
    navigation.
5.  Implement report submission, location fallback, stable idempotency,
    and confirmation.
6.  Implement deterministic analyzer, fixed priority formula, safety
    flags, and analysis-state separation.
7.  Implement Admin review and individual assignment.
8.  Implement Staff assigned queue, permitted status transitions,
    private notes, and resolution summary.
9.  Implement citizen dashboard, detail timeline, in-app notifications,
    and optional photo upload/retry.
10. Implement duplicate review/linking at the minimum safe level.
11. Implement aggregate analytics and responsive landing page.
12. Test role isolation, status validation, idempotency, analysis
    failure, upload failure, duplicate relationships, and notification
    retries.
13. Deploy to Vercel with dedicated demo Supabase project and verify the
    live end-to-end demo.
14. Finish README and evaluator guide.

If time becomes constrained, simplify charts, animations, optional
announcements, advanced duplicate-group UI, and rare edge-case screens.
Do not sacrifice server-side authorization, persisted report workflow,
safe status transitions, or clear demo limitations.

## 13. Definition of done

-   [ ] Vercel demo loads on desktop and mobile.
-   [ ] Supabase migrations run from a clean demo project.
-   [ ] Seed script deterministically creates synthetic demo data.
-   [ ] Demo Citizen, Staff, and Admin accounts are documented securely.
-   [ ] Citizen can submit a report with usable location and no photo.
-   [ ] Report ID and confirmation appear only after successful save.
-   [ ] Analysis state and report status are separate; analysis is
    labelled simulated.
-   [ ] Admin can review and assign to eligible active staff.
-   [ ] Staff can update allowed status and resolve with required
    summary.
-   [ ] Citizen receives an in-app notification and sees the timeline
    update.
-   [ ] Citizen cannot access another citizen's private report.
-   [ ] Staff cannot access unassigned/formerly assigned reports.
-   [ ] Invalid status transitions and unauthorized mutations fail
    server-side.
-   [ ] Submission/notification retries do not create duplicates.
-   [ ] Photos remain private and optional; failure does not block
    report creation.
-   [ ] Aggregate analytics are synthetic-labelled and privacy-safe.
-   [ ] Prototype disclaimer is visible.
-   [ ] README covers setup, env variables, migrations, seeding, demo
    access, architecture, limitations, and deployment.
-   [ ] No secrets or real personal data are committed.
