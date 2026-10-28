# CIVIC SYNC AI — DESIGN SYSTEM & UI SPECIFICATION
**Design file 1 of 2 | For Antigravity**

## Design direction
A modern, trustworthy civic-tech interface: clear blue-led palette, calm surfaces, strong hierarchy, readable typography, and restrained motion. Prioritize clarity and trust over decorative effects. Inspect the existing website first and preserve recognizable patterns unless they conflict with accessibility or role clarity.

## Visual tokens
- Primary: civic blue (use the existing brand blue if already defined; otherwise choose a deep accessible blue).
- Background: soft neutral/off-white; cards white; borders light neutral.
- Text: dark slate for body, muted slate for secondary labels.
- Status colors: distinct semantic tokens for submitted, under review, assigned, in progress, resolved, blocked, rejected, and urgent review. Never use color alone to communicate status; include text/icon.
- Typography: system sans-serif stack; clear page title, section heading, body, helper text. Avoid tiny text.
- Spacing: consistent 4/8-point scale; cards have generous padding; align form labels and inputs.
- Radius/shadows: subtle, consistent; avoid excessive glassmorphism or animations.

## Core layout rules
- Responsive sidebar or top navigation appropriate to the existing layout; mobile uses a compact menu.
- Role-specific navigation must be explicit. Citizens must not see admin/field-worker links; admins must not see citizen-only links unless intentionally shared.
- Each page has one clear title, primary action, and useful empty/loading/error states.
- Forms show inline validation, explain errors, preserve entered data on failure, and identify required fields.
- Loading indicators should not block the entire application unnecessarily.
- Confirm consequential actions; provide success feedback and retry paths.

## Required screen patterns
1. **Public landing page:** concise value proposition, “Report an issue” CTA, process explanation, public transparency preview, accessibility/language control, clear prototype/service disclaimer where relevant.
2. **Citizen dashboard:** own complaint summary, status timeline, deadlines, recent notifications, submit complaint CTA. Do not add neighborhood-following based on the user's decision.
3. **Complaint submission:** category, description, location, photos, optional AI suggestions, missing-detail helper, privacy note, submit state. Provide an offline-queued state if offline.
4. **Complaint detail:** timeline, status, deadline, staff updates visible to citizen, resolution photo, rate/feedback action, appeal/review action for rejected or resolved reports.
5. **Admin dashboard:** operational KPIs, unassigned/overdue queue, department workload, AI flags requiring review, appeals, deadline configuration, and links to protected reports.
6. **Department/field-worker portal:** assigned task list, mobile-friendly task detail, directions link, status update, photo upload, and resolve action disabled until after-repair photo is attached.
7. **AI-assisted analysis:** show recommendation, confidence/limitations, and “needs human review” states. Do not present predictions as facts.
8. **Public transparency:** aggregate resolution rates, average resolution times, department performance, and trends; exclude private report details and identifiers.
9. **Maintenance calendar:** confirmed scheduled work, source/confirmation label, filters and optional notifications.
10. **Civic knowledge center:** answers from verified official sources with source references and “not verified / no source found” behavior.
11. **Appeals/review:** request form, reason, submitted timestamp, status, decision explanation, and outcome tracking.
12. **English/Telugu accessibility controls:** language switch, keyboard/screen-reader support, text scaling, contrast, reduced motion, guided flows, and voice navigation with text alternatives.

## Component rules
- Buttons: one primary per view, secondary for alternatives, destructive styles only for destructive actions.
- Tables: responsive card conversion on mobile; persistent headers only when useful; accessible row/action labels.
- Charts: titles, date range, units, text summary and accessible data alternative.
- Maps: keyboard-accessible list alternative and explicit location permissions.
- Notifications: distinguish in-app and email delivery; show preferences and delivery failures.
- Ratings: 1–5 stars plus optional written feedback; accessible labels such as “4 out of 5”.
- Photo uploads: preview, remove before submit, type/size validation, upload progress, clear retry.

## Accessibility baseline
Aim for WCAG 2.2 AA where practical: semantic landmarks, logical heading order, keyboard access, visible focus, sufficient contrast, screen-reader labels, reduced-motion support, no color-only status, accessible dialogs, and usable zoom. Voice navigation must never be the only way to complete a task.

## Responsive behavior
- Mobile: single-column cards, large tap targets, sticky primary action only where it does not cover content.
- Tablet: compact navigation and two-column dashboard where readable.
- Desktop: wider dashboards with clear grid and consistent max-width.
- Test at narrow mobile width, tablet, and desktop; prevent horizontal overflow.

## Design acceptance checklist
- Consistent brand colors, spacing, typography, cards and form states.
- Role-aware navigation with no duplicate or unauthorized links.
- Every page has loading, empty, error, and success states.
- English and Telugu key flows are fully usable.
- All essential flows work with keyboard and screen reader.
- Public dashboards show aggregates only.
- No fabricated AI data or unverified maintenance announcements.
