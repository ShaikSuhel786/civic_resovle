# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Citizens:** Residents reporting civic issues (potholes, streetlights, drainage, electrical hazards), tracking real-time status and SLAs, viewing resolution photos, voting on neighborhood priorities, appealing rejections, and giving satisfaction feedback.
- **Department Staff:** Municipal field operators and engineers assigned to specific issues within their department (Roads, Water, Electrical, Sanitation, Traffic). They inspect, update progress, provide blocker reasons, and resolve issues with mandatory after-repair photo verification.
- **Municipal Administrators:** City directors overseeing operational queues, reviewing AI hazard flags and SLA escalations, managing staff assignments, handling duplicate groups, evaluating citizen appeals, and tracking citywide civic analytics and digital twin maps.
- **Public Visitors / Evaluators:** Exploring the municipal portal, viewing the Civic Transparency Scorecard, Predictive Radar, Maintenance Calendar, and AI Knowledge Center.

## Product Purpose

Civic Resolve AI demonstrates a closed-loop, accountable municipal issue resolution lifecycle. It pairs AI-assisted triage (hazard detection, priority scoring, vision inspection, voice reporting) with human-in-the-loop governance to ensure citizen transparency, verified repairs, and rapid civic problem resolution.

## Positioning

Unlike generic complaint forms or unverified ticketing systems, Civic Resolve AI enforces an explainable, deterministic SLA and prioritization engine (0.40 Severity + 0.30 Risk + 0.20 People + 0.10 Duration), automated vision analysis, mandatory proof-of-resolution photos, and bilingual voice accessibility (English & Telugu) without fake claims or unverified automation.

## Operating Context

- Mobile and desktop responsive web application.
- Used in the field by citizens and staff on mobile devices under outdoor sunlight, as well as by administrators on high-density desktop command center displays.
- Synthetic demo data backed by SQLite / Supabase PostgreSQL with role-based access control and strict verification tests.

## Capabilities and Constraints

- **Core Workflows:** Report submission with address/map pin, automated deterministic AI triage, SLA tracking, Admin review & assignment, Staff progress & resolution with photo proof, and Citizen post-resolution appeals and feedback.
- **Advanced Civic Modules:**
  - Citizen Dashboard (`citizen-dashboard.html` / `dashboard.html`)
  - Report Submission (`report.html`) with vision defect inspection and bilingual voice input
  - Report Detail (`report-detail.html`) with SLA countdown, voting, timeline, appeals, and satisfaction rating
  - Admin Command Center (`admin.html` / `admin-dashboard.html`) with escalation radar, duplicate detection, and appeal review
  - Staff Task Queue (`staff.html` / `staff-dashboard.html`) with task cards, blocker updates, and photo resolution upload
  - Civic Transparency Scorecard (`transparency.html`)
  - Civic Digital Twin Map (`digital-twin.html`)
  - Municipal Maintenance Calendar (`maintenance.html`)
  - AI Civic Knowledge Center (`knowledge.html`)
  - Predictive Problem Radar (`radar.html`)
- **Constraints:**
  - Zero PII exposure to public or cross-citizen views.
  - Server-verified roles (Citizen, Staff, Admin).
  - Pure HTML/CSS/JS frontend served by Express with responsive layouts.
  - Must pass all automated end-to-end tests without regression.

## Brand Commitments

- **Tone:** Authoritative, transparent, civic-minded, precise, modern, and accessible.
- **Palette Identity:** Deep Civic Navy (`#0A192F` / `#123A72`), Trust Blue (`#2563EB`), Crisp Clean White/Off-White (`#F8FAFC`), Slate Neutral Grays (`#334155`, `#64748B`), Emerald Success (`#059669`), Amber Warning (`#D97706`), Rose Alert (`#DC2626`).
- **Typography:** Inter / system geometric sans-serif with high tabular clarity and legible measures.

## Evidence on Hand

- Fully functional backend test suite (68 tests passing across workflows, APIs, routing, and vision).
- Complete set of 11 frontend pages in `public/`.
- Consolidated stylesheet `public/css/style.css` and client scripts `auth.js`, `api.js`, `voice-assistant.js`.

## Product Principles

1. **Transparent Accountability:** Every status change, SLA timer, and resolution is backed by an audit trail and photographic proof.
2. **Speed & Scannability:** Crucial civic data (SLA, priority, hazard level, coordinates) must be legible in under 3 seconds.
3. **Inclusive Civic Access:** Seamless responsive experience on any device (320px to 4K), accessible keyboard navigation, and bilingual speech/text.
4. **Restraint & Polish:** No gratuitous animations or chaotic visual noise; interface communicates stability, competence, and public trust.

## Accessibility & Inclusion

- WCAG 2.2 AA target: Minimum 4.5:1 text contrast, visible focus rings, aria labels on interactive elements, touch targets >= 44px, and full keyboard traversability.

