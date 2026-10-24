# Civic Resolve AI — Municipal Issue Reporting & Workflow Platform

> **Hackathon Prototype Stage:** 24-Hour Prototype  
> **Target Audience:** Hackathon Evaluators, Municipal Partners & Civic Tech Judges  
> **Live Local Development Server:** `http://localhost:3050`  

---

## 1. Executive Summary & Purpose

**Civic Resolve AI** is a responsive web application prototype designed to streamline municipal issue triage and field resolution. It demonstrates an explainable, deterministic civic workflow connecting **Citizens**, **Municipal Administrators**, and **Department Field Staff** with transparent simulated AI analysis, verifiable status timelines, and in-app notifications.

> [!IMPORTANT]
> **Prototype Demonstration Notice:**  
> Civic Resolve AI is an engineering demonstration prototype developed with synthetic demo data. It is **not** an official municipal channel or emergency dispatch system. For immediate life-safety emergencies, citizens must dial **112** or local emergency authorities.

---

## 2. Key Capabilities & Workflow

```text
  Citizen Submits Report               Simulated AI Analyzer             Municipal Admin Triage
┌─────────────────────────┐         ┌─────────────────────────┐        ┌─────────────────────────┐
│ Description (20-2000c)  │ ──────> │ Categorization & Dept   │ ─────> │ Action-First Queues     │
│ Address & Leaflet Pin   │         │ Heuristic Priority (0-100)│        │ Mapped Dept Assignment  │
│ Optional Photo Evidence │         │ Hazard & Duplicate Scan │        │ Duplicate Confirmation  │
└─────────────────────────┘         └─────────────────────────┘        └─────────────────────────┘
                                                                                    │
                                                                                    ▼
  Citizen Timeline & Alerts           Resolution & Milestones            Department Field Staff
┌─────────────────────────┐         ┌─────────────────────────┐        ┌─────────────────────────┐
│ Verified Milestones     │ <────── │ Resolution Summary Req. │ <───── │ Assigned-Only Queue     │
│ In-App Notifications    │         │ Chronological Events    │        │ In Progress / Blocked   │
│ Follow-up Comments      │         │ Optional After-Photos   │        │ Internal Staff Notes    │
└─────────────────────────┘         └─────────────────────────┘        └─────────────────────────┘
```

1. **Citizen Portal (`/` & `/report`):**
   - Submit civic issues with description (20–2,000 chars), interactive Leaflet map pin, manual address fallback, and optional photo upload (max 5MB).
   - Mandatory bilingual Privacy Notice (English / Telugu `తెలుగు`).
   - Stable client idempotency prevents duplicate issue creation upon network retries.
2. **Deterministic Simulated AI Engine (`server/ai/analyzer.js`):**
   - Suggests category and department from an approved 8-category taxonomy.
   - Calculates deterministic priority (0–100) using the exact weighted formula:
     $$\text{Priority} = 0.40 \times \text{Severity} + 0.30 \times \text{SafetyRisk} + 0.20 \times \text{PeopleAffected} + 0.10 \times \text{IssueDuration}$$
   - Detects critical safety hazards (sparking wire, open manhole, gas leak) triggering mandatory Urgent Admin Review.
   - Detects possible duplicate candidates within proximity (<300m) without auto-confirming.
   - Decoupled state: AI analysis state (`Completed`, `Failed`) never changes workflow status (`Submitted`).
3. **Operational Admin Command Center (`/admin`):**
   - Action-first queues: Urgent Safety Hazards & High-Priority Unassigned → Review Queue → Blocked Issues → Department Workloads.
   - Atomic staff assignment restricted strictly to active staff members in the report's mapped department.
   - Reassignment requires an audited reason, immediately revoking former staff access.
   - Duplicate relationship confirmation and reversal.
4. **Department Field Staff Workspace (`/staff`):**
   - Strictly isolated: staff can see **only reports currently assigned to them**.
   - Permitted status transitions: `In Progress`, `Blocked` (requires delay reason), and `Resolved` (requires comprehensive resolution summary).
   - Private internal staff notes with role-restricted visibility.
5. **Citizen Tracking Dashboard & Safe Timeline (`/dashboard` & `/reports/:id`):**
   - Overview metrics: Active, In Progress, Resolved, Needs Attention.
   - Privacy-safe chronological timeline showing only verified milestones and resolution summaries. Internal notes and raw risk assessments are hidden.
   - In-app notification bell with unread count and idempotent durable retry mechanism.
6. **Aggregate Public Analytics (`/analytics`):**
   - Synthetic KPI cards, monthly trends, category distributions, and environmental impact metrics.

---

## 3. Preconfigured Demo Accounts

Evaluators can sign in immediately at `http://localhost:3050/login` using the **1-Click Evaluator Role Switcher** or the credentials below:

| Role | Account Name | Email | Password | Department |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Municipal Admin Officer | `admin@civicsync.demo` | `DemoAdmin123!` | *All Departments* |
| **Citizen** | Priya Sharma | `citizen@civicsync.demo` | `DemoCitizen123!` | *N/A (Citizen)* |
| **Citizen (Telugu)** | Rajesh Kumar | `citizen2@civicsync.demo` | `DemoCitizen123!` | *N/A (Citizen)* |
| **Staff** | Venkatesh Rao | `staff.roads@civicsync.demo` | `DemoStaff123!` | Roads & Transport |
| **Staff** | K. Anitha | `staff.sanitation@civicsync.demo` | `DemoStaff123!` | Sanitation |
| **Staff** | Suresh Babu | `staff.electrical@civicsync.demo` | `DemoStaff123!` | Electrical Services |
| **Staff** | Mohammed Ali | `staff.water@civicsync.demo` | `DemoStaff123!` | Water & Drainage |
| **Staff** | Lakshmi Devi | `staff.publicworks@civicsync.demo` | `DemoStaff123!` | Public Works |

---

## 4. Evaluator 6-Step Demonstration Journey

To evaluate the complete end-to-end workflow:

1. **Step 1: Sign in as Citizen**  
   Navigate to `/login` and click **"Priya Sharma (Citizen)"**. You will be redirected to the Citizen Dashboard (`/dashboard`).
2. **Step 2: Submit a Civic Report**  
   Click **"Report New Issue"** (`/report`). Fill in:
   - *Description:* `"Deep dangerous crater pothole on main road causing hazard for bikes"`
   - *Location:* Click the Leaflet map to drop a pin or click **"Use My Location"**.
   - *Optional:* Attach a photo.
   - Click **"Submit Issue"**.
3. **Step 3: Review Deterministic AI Analysis**  
   On `/ai-result`, observe the circular Priority Score dial (85/100 Urgent), the 4-factor breakdown bars, the suggested department (Roads & Transport), and detected duplicate candidates.
4. **Step 4: Admin Review & Assignment**  
   Navigate to `/login` and switch to **"Municipal Admin Officer"**. Go to `/admin`.
   - Locate the report in the **Urgent Safety Alerts** queue.
   - Click **"Assign"**. Notice the system only permits active staff from the mapped department (*Roads & Transport*).
   - Select **Venkatesh Rao** and confirm assignment. Status transitions to `Assigned`.
5. **Step 5: Field Staff Resolution**  
   Switch account to **"Venkatesh Rao (Roads Staff)"** and go to `/staff`.
   - Click **"Start Work (In Progress)"**.
   - Click **"Internal Notes"** to record a private technician note.
   - Click **"Resolve Issue"** and enter a summary: `"Crater filled with hot-mix asphalt and compacted. Surface restored."`
   - Confirm resolution. Status transitions to `Resolved`.
6. **Step 6: Citizen Verification & Notification**  
   Switch back to **"Priya Sharma"**.
   - Click the notification bell to see the unread resolution alert.
   - Open `/reports/[id]` to inspect the complete chronological timeline and verified resolution summary.

---

## 5. Technology Architecture

- **Frontend:** HTML5, Vanilla CSS3 (Custom Design System adhering to `DESIGN.md` tokens), Vanilla JavaScript, Leaflet for OpenStreetMap integration.
- **Backend API:** Node.js (Express), JSON Web Tokens (JWT), bcrypt.js, Multer for private image validation.
- **Dual-Mode Persistence Architecture:**
  - **Supabase Mode:** Connects to Supabase PostgreSQL, Supabase Auth, and Supabase Storage when credentials are provided in `.env`.
  - **Local Zero-Config Mode:** Embedded SQLite database (`server/db/index.js` via `better-sqlite3`) executing the identical 12-table relational schema and check constraints.
- **Hosting / Serverless:** Vercel deployment ready via `vercel.json`.

---

## 6. Local Setup & Testing Instructions

### Prerequisites
- Node.js v18+ (tested on v24)
- npm v9+

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/ShaikSuhel786/civic_resovle.git
cd civic_resovle

# 2. Install dependencies
npm install

# 3. Seed deterministic demo data (populates 24 realistic records across all categories & roles)
npm run seed

# 4. Run automated test suite
npm test

# 5. Start development server
npm start
# Server listens on http://localhost:3050
```

### Running with Supabase
To connect to an active Supabase project:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Apply migrations in Supabase SQL Editor from:
   - `supabase/migrations/20261024000001_initial_schema.sql`
   - `supabase/seed.sql`

---

## 7. Automated Test Suite

Run the automated test suite with:
```bash
npm test
```
The test suite validates:
- ✓ Exact PRD priority formula: `0.40S + 0.30R + 0.20P + 0.10D`
- ✓ Critical safety hazard detection and urgent review triggers
- ✓ Low-confidence heuristic routing threshold (<80)
- ✓ Duplicate candidate similarity matching without auto-confirmation
- ✓ Server-side role check constraints on database profiles
- ✓ Admin department boundary enforcement (rejects assigning staff outside mapped department)
- ✓ Status machine integrity (Blocked requires reason, Resolved requires summary)
- ✓ Idempotency key constraints preventing duplicate reports
- ✓ Complete end-to-end status lifecycle (`Submitted` → `Under Review` → `Assigned` → `In Progress` → `Resolved`)

---

## 8. Known Limitations & Production Hardening Roadmap

As a 24-hour hackathon prototype, certain production features are intentionally stubbed or simplified per PRD Section 2:
1. **Simulated AI vs. Trained ML:** Analysis uses deterministic keyword matching and geographic proximity rather than a trained neural language model.
2. **Municipal Integrations:** Prototype does not integrate with official municipal ERP or dispatch systems.
3. **SMS / Email Gateways:** Notifications are delivered in-app via persisted notification records and durable retry queues.
4. **Production Hardening Next Steps:**
   - Multi-Factor Authentication (MFA) for Administrative accounts.
   - Continuous automated geocoding rate-limiting and reverse address caching.
   - Comprehensive GDPR/DPDP-compliant data retention and automatic purge policies.
