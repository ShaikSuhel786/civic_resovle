# Civic Resolve AI — API Documentation

This document describes all operational API endpoints for Civic Resolve AI. All protected endpoints strictly require cryptographic JWT authentication via `Authorization: Bearer <token>` or token query parameters for media tags.

---

## 1. Authentication & Identity

### GET /api/auth/demo-accounts
Description: List active demo accounts for 1-click evaluation (disabled in production unless explicitly permitted).

```bash
curl -X GET http://localhost:3050/api/auth/demo-accounts \
  -H "Accept: application/json"
```

Sample Response (200):
```json
{
  "demoAccounts": [
    {
      "id": "usr-admin-01",
      "email": "admin@civicsync.demo",
      "display_name": "Municipal Admin Officer",
      "role": "admin",
      "department_id": null,
      "department_name": null
    }
  ]
}
```

Error Codes: 403 (production restriction), 500 (server)

---

### POST /api/auth/register
Description: Self-registration for real citizens with bcrypt password hashing.

```bash
curl -X POST http://localhost:3050/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Priya Sharma",
    "email": "priya.citizen@example.com",
    "password": "SecurePassword123!",
    "phone": "+91 98765 43210",
    "preferredLanguage": "en"
  }'
```

Sample Response (201):
```json
{
  "message": "Account registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr-cz-example123",
    "email": "priya.citizen@example.com",
    "displayName": "Priya Sharma",
    "role": "citizen",
    "phone": "+91 98765 43210",
    "preferredLanguage": "en"
  }
}
```

Error Codes: 400 (validation), 409 (conflict), 500 (server)

---

### POST /api/auth/login
Description: Authenticates user credentials via bcrypt verification. Passwordless demo login is strictly restricted to non-production environments.

```bash
curl -X POST http://localhost:3050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "citizen@civicsync.demo",
    "password": "DemoCitizen123!"
  }'
```

Sample Response (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr-citizen-01",
    "email": "citizen@civicsync.demo",
    "displayName": "Priya Sharma (Citizen)",
    "role": "citizen",
    "departmentId": null,
    "phone": null,
    "preferredLanguage": "en"
  }
}
```

Error Codes: 400 (missing fields), 401 (invalid credentials), 403 (demo login forbidden in production), 500 (server)

---

### GET /api/auth/profile
Description: Retrieves verified current user profile and civic report metrics.

```bash
curl -X GET http://localhost:3050/api/auth/profile \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "user": {
    "id": "usr-citizen-01",
    "email": "citizen@civicsync.demo",
    "displayName": "Priya Sharma (Citizen)",
    "role": "citizen",
    "phone": null,
    "preferredLanguage": "en",
    "createdAt": "2026-10-24 10:00:00"
  },
  "stats": {
    "totalReports": 5,
    "resolvedReports": 2,
    "activeReports": 3
  }
}
```

Error Codes: 401 (auth), 404 (not found), 500 (server)

---

### PUT /api/auth/profile
Description: Updates display name, phone, and preferred language for current user.

```bash
curl -X PUT http://localhost:3050/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "displayName": "Priya Sharma",
    "phone": "+91 99887 76655",
    "preferredLanguage": "te"
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "user": {
    "id": "usr-citizen-01",
    "email": "citizen@civicsync.demo",
    "displayName": "Priya Sharma",
    "role": "citizen",
    "phone": "+91 99887 76655",
    "preferredLanguage": "te"
  }
}
```

Error Codes: 400 (validation), 401 (auth), 404 (not found), 500 (server)

---

### PUT /api/auth/change-password
Description: Changes authenticated user password with current password bcrypt verification.

```bash
curl -X PUT http://localhost:3050/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "currentPassword": "DemoCitizen123!",
    "newPassword": "NewSecurePassword456!"
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "message": "Password updated successfully."
}
```

Error Codes: 400 (validation / password mismatch), 401 (auth), 404 (not found), 500 (server)

---

## 2. Civic Reports & Triage Lifecycle

### GET /api/reports/categories
Description: Retrieves active municipal report categories with mapped departments.

```bash
curl -X GET http://localhost:3050/api/reports/categories
```

Sample Response (200):
```json
{
  "categories": [
    {
      "id": "cat-roads",
      "name": "Roads and potholes",
      "department_id": "dept-roads",
      "department_name": "Roads & Transport"
    }
  ]
}
```

Error Codes: 500 (server)

---

### POST /api/reports
Description: Submits a new citizen civic report with deterministic AI triage, SLA calculation, and duplicate scan.

```bash
curl -X POST http://localhost:3050/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "description": "Deep dangerous crater pothole on main road causing hazard for two-wheelers.",
    "locationText": "Road No 1, Banjara Hills, Hyderabad",
    "latitude": 17.4200,
    "longitude": 78.4480,
    "categoryId": "cat-roads",
    "idempotencyKey": "unique-client-guid-12345"
  }'
```

Sample Response (201):
```json
{
  "success": true,
  "report": {
    "id": "rep-abc123xyz",
    "referenceNumber": "REP-2026-987",
    "status": "Submitted",
    "priorityScore": 76,
    "priorityLevel": "High",
    "suggestedDepartment": "Roads & Transport",
    "slaDeadline": "2026-11-01T20:54:00.000Z"
  }
}
```

Error Codes: 400 (validation), 401 (auth), 409 (conflict), 500 (server)

---

### GET /api/reports
Description: Lists reports filtered by user role (citizens see own, admins see all).

```bash
curl -X GET "http://localhost:3050/api/reports?status=active" \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "reports": [
    {
      "id": "rep-001",
      "reference_number": "REP-2026-001",
      "title": "Dangerous exposed live wire sparking near school gate",
      "status": "Resolved",
      "priority_level": "Urgent",
      "priority_score": 94,
      "community_votes": 3
    }
  ]
}
```

Error Codes: 401 (auth), 500 (server)

---

### GET /api/reports/:id
Description: Retrieves comprehensive report details, chronological events, SLA status, and evidence.

```bash
curl -X GET http://localhost:3050/api/reports/rep-001 \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "report": {
    "id": "rep-001",
    "reference_number": "REP-2026-001",
    "status": "Resolved",
    "resolution_summary": "Replaced burnt aluminum feeder junction box and verified safe.",
    "timeline": []
  }
}
```

Error Codes: 401 (auth), 403 (forbidden), 404 (not found), 500 (server)

---

### POST /api/reports/:id/vote
Description: Allows eligible citizens to cast a community impact upvote on a civic issue.

```bash
curl -X POST http://localhost:3050/api/reports/rep-002/vote \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "success": true,
  "communityVotes": 4,
  "message": "Your community impact vote was recorded."
}
```

Error Codes: 400 (own report), 401 (auth), 403 (role), 409 (duplicate vote), 500 (server)

---

### DELETE /api/reports/:id/vote
Description: Removes a previously recorded community impact upvote.

```bash
curl -X DELETE http://localhost:3050/api/reports/rep-002/vote \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "success": true,
  "communityVotes": 3,
  "message": "Your vote has been removed."
}
```

Error Codes: 401 (auth), 404 (vote not found), 500 (server)

---

### GET /api/reports/:id/sla
Description: Returns SLA deadline countdown, warning flags, and overdue metrics.

```bash
curl -X GET http://localhost:3050/api/reports/rep-002/sla
```

Sample Response (200):
```json
{
  "success": true,
  "sla": {
    "deadline": "2026-11-01T10:00:00.000Z",
    "isBreached": false,
    "isWarning": false,
    "displayText": "3d remaining"
  }
}
```

Error Codes: 404 (not found), 500 (server)

---

### POST /api/reports/:id/appeal
Description: Submits a citizen administrative appeal on a rejected or resolved issue.

```bash
curl -X POST http://localhost:3050/api/reports/rep-004/appeal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "reason": "The pothole was only partially patched and road is still dangerous for bikes.",
    "appealType": "resolution"
  }'
```

Sample Response (201):
```json
{
  "success": true,
  "message": "Appeal submitted successfully for administrative review.",
  "appealId": "app-xyz789"
}
```

Error Codes: 400 (validation/status), 401 (auth), 403 (forbidden), 409 (conflict), 500 (server)

---

### POST /api/reports/:id/feedback
Description: Collects post-resolution citizen satisfaction rating (1-5 stars) and optional feedback.

```bash
curl -X POST http://localhost:3050/api/reports/rep-001/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "rating": 5,
    "comment": "Quick and thorough electrical repair! Very grateful."
  }'
```

Sample Response (201):
```json
{
  "success": true,
  "message": "Thank you! Your feedback has been recorded."
}
```

Error Codes: 400 (validation), 401 (auth), 403 (forbidden), 409 (conflict), 500 (server)

---

## 3. Municipal Admin Command Center

### GET /api/admin/queues
Description: Operational action-first queues (Urgent Safety, High-Priority Unassigned, Blocked, Workloads).

```bash
curl -X GET http://localhost:3050/api/admin/queues \
  -H "Authorization: Bearer <admin_token>"
```

Sample Response (200):
```json
{
  "urgentSafety": [],
  "unassigned": [],
  "blocked": [],
  "workloads": []
}
```

Error Codes: 401 (auth), 403 (forbidden), 500 (server)

---

### POST /api/admin/reports/:id/assign
Description: Atomically assigns or reassigns an issue strictly to active staff within mapped department.

```bash
curl -X POST http://localhost:3050/api/admin/reports/rep-002/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "staffId": "usr-staff-roads",
    "reason": "Arterial road repair assignment"
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "message": "Staff member assigned successfully."
}
```

Error Codes: 400 (mismatched department), 401 (auth), 403 (forbidden), 404 (not found), 500 (server)

---

### GET /api/admin/appeals
Description: Lists citizen appeals awaiting administrative decision.

```bash
curl -X GET http://localhost:3050/api/admin/appeals \
  -H "Authorization: Bearer <admin_token>"
```

Sample Response (200):
```json
{
  "appeals": [
    {
      "id": "app-01",
      "report_id": "rep-004",
      "reason": "Road still hazardous",
      "status": "Pending"
    }
  ]
}
```

Error Codes: 401 (auth), 403 (forbidden), 500 (server)

---

### POST /api/admin/appeals/:id/decide
Description: Adjudicates a citizen appeal (Approve to reopen report, Reject to uphold decision).

```bash
curl -X POST http://localhost:3050/api/admin/appeals/app-01/decide \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "decision": "Approved",
    "adminNotes": "Inspection confirmed road surface requires secondary compaction."
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "message": "Appeal approved. Report reopened to Under Review."
}
```

Error Codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 500 (server)

---

## 4. Department Field Staff Workspace

### GET /api/staff/reports
Description: Returns task queue strictly restricted to reports assigned to the authenticated staff member.

```bash
curl -X GET http://localhost:3050/api/staff/reports \
  -H "Authorization: Bearer <staff_token>"
```

Sample Response (200):
```json
{
  "reports": [
    {
      "id": "rep-002",
      "title": "Large pothole on main road",
      "status": "Assigned"
    }
  ]
}
```

Error Codes: 401 (auth), 403 (forbidden), 500 (server)

---

### POST /api/staff/reports/:id/status
Description: Transitions task status (In Progress, Blocked with reason, or Resolved with summary and after-photo).

```bash
curl -X POST http://localhost:3050/api/staff/reports/rep-002/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff_token>" \
  -d '{
    "status": "Resolved",
    "resolutionSummary": "Crater filled with cold bituminous mix and compacted with vibratory roller. Surface flush."
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "report": {
    "id": "rep-002",
    "status": "Resolved"
  }
}
```

Error Codes: 400 (missing proof photo or summary), 401 (auth), 403 (forbidden / cross-staff boundary), 404 (not found), 500 (server)

---

### POST /api/staff/reports/:id/notes
Description: Records private internal staff note visible only to staff and administrators.

```bash
curl -X POST http://localhost:3050/api/staff/reports/rep-002/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff_token>" \
  -d '{
    "note": "Sub-base asphalt requires 24 hours curing before heavy vehicle traffic."
  }'
```

Sample Response (201):
```json
{
  "success": true,
  "note": {
    "id": "not-123",
    "note": "Sub-base asphalt requires 24 hours curing before heavy vehicle traffic."
  }
}
```

Error Codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 500 (server)

---

## 5. Maintenance Calendar (Privileged Mutations)

### GET /api/maintenance
Description: Lists confirmed municipal maintenance schedules (Public read).

```bash
curl -X GET "http://localhost:3050/api/maintenance?status=in_progress"
```

Sample Response (200):
```json
{
  "success": true,
  "schedules": [
    {
      "id": "maint-01",
      "title": "Main Water Pipeline Replacement & Pressure Valve Overhaul",
      "department_name": "Water & Drainage",
      "status": "In Progress"
    }
  ],
  "stats": {
    "total": 5,
    "inProgress": 1,
    "upcoming": 2,
    "overdue": 0,
    "completed": 1
  }
}
```

Error Codes: 500 (server)

---

### POST /api/maintenance
Description: Schedules a new municipal public maintenance activity (Admin only).

```bash
curl -X POST http://localhost:3050/api/maintenance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "title": "Overhead Cable Bundling and Streetlight Upgrades",
    "departmentName": "Electrical Services",
    "area": "Gachibowli Outer Ring Road",
    "startDate": "2026-11-05",
    "endDate": "2026-11-15",
    "officialSource": "MW-2026-ELE-912",
    "description": "Routine replacement of feeder cables and installation of automated energy meters."
  }'
```

Sample Response (201):
```json
{
  "success": true,
  "message": "Maintenance activity scheduled successfully.",
  "schedule": {
    "id": "maint-999",
    "title": "Overhead Cable Bundling and Streetlight Upgrades"
  }
}
```

Error Codes: 400 (validation), 401 (unauthenticated), 403 (forbidden non-admin), 500 (server)

---

### DELETE /api/maintenance/:id
Description: Deletes or cancels a municipal maintenance schedule (Admin only).

```bash
curl -X DELETE http://localhost:3050/api/maintenance/maint-999 \
  -H "Authorization: Bearer <admin_token>"
```

Sample Response (200):
```json
{
  "success": true,
  "message": "Maintenance activity successfully removed."
}
```

Error Codes: 401 (unauthenticated), 403 (forbidden non-admin), 404 (not found), 500 (server)

---

## 6. Photo Evidence & Protected Media

### POST /api/reports/:id/photos
Description: Uploads photo evidence for a report with binary magic-byte inspection (max 5MB, JPEG/PNG/WebP).

```bash
curl -X POST http://localhost:3050/api/reports/rep-001/photos \
  -H "Authorization: Bearer <token>" \
  -F "photo=@/path/to/pothole.jpg"
```

Sample Response (201):
```json
{
  "success": true,
  "photo": {
    "id": "pho-abc123",
    "storagePath": "/uploads/1730000000000-abcd.jpg",
    "fileName": "pothole.jpg",
    "sizeBytes": 102400,
    "isResolutionPhoto": false,
    "confidenceScore": 88
  }
}
```

Error Codes: 400 (invalid signature or file size), 401 (auth), 403 (not report owner or assigned staff), 404 (not found), 500 (server)

---

### GET /uploads/:filename
Description: Authenticated and role-authorized photo evidence delivery. Direct unauthenticated access is strictly blocked.

```bash
curl -X GET http://localhost:3050/uploads/1730000000000-abcd.jpg \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
Binary image file with `Content-Type: image/jpeg`

Error Codes: 401 (unauthenticated), 403 (access denied to private evidence), 404 (not found)

---

## 7. Public Telemetry & Analytics

### GET /api/analytics/scorecard
Description: Genuine database aggregate scorecard for municipal resolution rates and SLA adherence (0 PII).

```bash
curl -X GET "http://localhost:3050/api/analytics/scorecard?period=30d"
```

Sample Response (200):
```json
{
  "period": "30d",
  "totalReports": 24,
  "resolvedReports": 8,
  "resolutionRate": "33%",
  "avgResolutionDays": 2.4,
  "slaAdherenceRate": "88%",
  "categoryBreakdown": [],
  "departmentPerformance": []
}
```

Error Codes: 500 (server)

---

### GET /api/reports/public/digital-twin
Description: Privacy-sanitized geospatial telemetry for interactive 2D/3D digital twin map.

```bash
curl -X GET http://localhost:3050/api/reports/public/digital-twin
```

Sample Response (200):
```json
{
  "success": true,
  "totalCount": 20,
  "reports": [
    {
      "id": "rep-001",
      "referenceNumber": "REP-2026-001",
      "title": "Dangerous exposed live wire sparking near school gate",
      "category": "Streetlights",
      "department": "Electrical Services",
      "status": "Resolved",
      "priorityLevel": "Urgent",
      "latitude": 17.4158,
      "longitude": 78.4354,
      "locationText": "Road No 12, Banjara Hills"
    }
  ]
}
```

Error Codes: 500 (server)

---

### GET /api/analytics/radar
Description: Predictive problem radar hotspot clustering and risk forecasting.

```bash
curl -X GET http://localhost:3050/api/analytics/radar
```

Sample Response (200):
```json
{
  "success": true,
  "hotspots": [
    {
      "id": "spot-roads-banjara",
      "area": "Banjara Hills",
      "riskScore": 85,
      "status": "Emerging Hotspot"
    }
  ]
}
```

Error Codes: 500 (server)

---

## 8. Knowledge & AI Vision

### GET /api/knowledge
Description: Returns official municipal statutory bylaws and service level standards.

```bash
curl -X GET http://localhost:3050/api/knowledge
```

Sample Response (200):
```json
{
  "success": true,
  "articles": [
    {
      "id": "know-01",
      "title": "How Road & Pothole Repair Deadlines Work",
      "category": "Roads & Transport",
      "content": "Reported potholes are categorized into three response tiers...",
      "official_source": "Municipal Works Bylaw 2024, Sec 14"
    }
  ]
}
```

Error Codes: 500 (server)

---

### POST /api/knowledge/ask
Description: Grounded civic Q&A returning verified municipal citations without hallucination.

```bash
curl -X POST http://localhost:3050/api/knowledge/ask \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the repair deadline for a dangerous pothole?"
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "grounded": true,
  "answer": "Reported potholes are categorized into three response tiers: Critical arterial hazards are evaluated within 24 hours...",
  "officialSource": "Municipal Works Bylaw 2024, Sec 14",
  "articleId": "know-01"
}
```

Error Codes: 400 (validation), 500 (server)

---

### POST /api/ai/vision-inspect
Description: Analyzes defect photos for category recommendation and critical safety hazards.

```bash
curl -X POST http://localhost:3050/api/ai/vision-inspect \
  -H "Content-Type: application/json" \
  -d '{
    "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "fileName": "pothole_evidence.jpg"
  }'
```

Sample Response (200):
```json
{
  "success": true,
  "provider": "heuristic_rule_engine",
  "disclaimer": "Simulated AI analysis for prototype demonstration. Subject to human verification.",
  "defectType": "Pothole / Road Surface Damage",
  "suggestedCategoryId": "cat-roads",
  "suggestedCategoryName": "Roads and potholes",
  "suggestedDepartmentId": "dept-roads",
  "suggestedDepartmentName": "Roads & Transport",
  "hazard": false,
  "hazardReason": null,
  "clues": [
    "Pothole detected",
    "Asphalt degradation",
    "Road surface defect"
  ],
  "confidenceScore": 88
}
```

Error Codes: 400 (validation), 500 (server)

---

## 9. Notifications

### GET /api/notifications
Description: Retrieves authenticated user's in-app notification alerts with unread count.

```bash
curl -X GET http://localhost:3050/api/notifications \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "notifications": [
    {
      "id": "notif-01",
      "title": "Issue Resolved",
      "message": "Your reported streetlight issue is now resolved.",
      "read": 0,
      "created_at": "2026-10-24 15:55:00"
    }
  ],
  "unreadCount": 1
}
```

Error Codes: 401 (auth), 500 (server)

---

### POST /api/notifications/:id/read
Description: Marks a specific notification as read.

```bash
curl -X POST http://localhost:3050/api/notifications/notif-01/read \
  -H "Authorization: Bearer <token>"
```

Sample Response (200):
```json
{
  "success": true
}
```

Error Codes: 401 (auth), 404 (not found), 500 (server)

---

## 10. System Health

### GET /api/health
Description: Health check endpoint reporting operational parameters and authentication mode.

```bash
curl -X GET http://localhost:3050/api/health
```

Sample Response (200):
```json
{
  "status": "healthy",
  "product": "Civic Resolve AI",
  "version": "1.0.0",
  "environment": "development",
  "realUsersEnabled": true,
  "authentication": "JWT + BCrypt (Strict Verification)",
  "timestamp": "2026-10-29T21:30:00.000Z"
}
```

Error Codes: 500 (server)
