-- Civic Resolve AI: SQLite Local Persistent Schema
PRAGMA foreign_keys = ON;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('citizen', 'staff', 'admin')),
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    active INTEGER NOT NULL DEFAULT 1,
    preferred_language TEXT NOT NULL DEFAULT 'en' CHECK(preferred_language IN ('en', 'te')),
    password_hash TEXT,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reference_number TEXT NOT NULL UNIQUE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL CHECK(length(description) >= 20 AND length(description) <= 2000),
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    location_text TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    location_verified INTEGER NOT NULL DEFAULT 1,
    is_out_of_boundary INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Blocked', 'Resolved', 'Rejected', 'Withdrawn', 'Duplicate')),
    priority_score INTEGER DEFAULT 0 CHECK(priority_score >= 0 AND priority_score <= 100),
    priority_level TEXT DEFAULT 'Medium' CHECK(priority_level IN ('Low', 'Medium', 'High', 'Urgent')),
    severity_factor INTEGER DEFAULT 50 CHECK(severity_factor >= 0 AND severity_factor <= 100),
    safety_factor INTEGER DEFAULT 50 CHECK(safety_factor >= 0 AND safety_factor <= 100),
    people_factor INTEGER DEFAULT 50 CHECK(people_factor >= 0 AND people_factor <= 100),
    duration_factor INTEGER DEFAULT 50 CHECK(duration_factor >= 0 AND duration_factor <= 100),
    safety_flag INTEGER NOT NULL DEFAULT 0,
    safety_flag_reason TEXT,
    review_required INTEGER NOT NULL DEFAULT 0,
    review_reason TEXT,
    analysis_state TEXT NOT NULL DEFAULT 'Pending' CHECK(analysis_state IN ('Pending', 'Completed', 'Failed')),
    suggested_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    suggested_department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    confidence_score INTEGER DEFAULT 0 CHECK(confidence_score >= 0 AND confidence_score <= 100),
    analysis_reasoning TEXT,
    primary_report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
    assigned_staff_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    blocked_reason TEXT,
    rejected_reason TEXT,
    resolution_summary TEXT,
    idempotency_key TEXT UNIQUE,
    community_votes INTEGER NOT NULL DEFAULT 0,
    sla_deadline TEXT,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    last_escalated_at TEXT,
    privacy_acknowledged_at TEXT,
    privacy_notice_version TEXT DEFAULT '1.0',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    reason TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

-- 6. Report Events Table
CREATE TABLE IF NOT EXISTS report_events (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    citizen_visible INTEGER NOT NULL DEFAULT 1,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_state_json TEXT,
    after_state_json TEXT,
    reason TEXT,
    correlation_id TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Duplicate Relationships Table
CREATE TABLE IF NOT EXISTS duplicate_relationships (
    id TEXT PRIMARY KEY,
    duplicate_report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    primary_report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Confirmed' CHECK(status IN ('Candidate', 'Confirmed', 'Reversed')),
    similarity_score INTEGER CHECK(similarity_score >= 0 AND similarity_score <= 100),
    reason TEXT,
    confirmed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reversed_at TEXT,
    CHECK (duplicate_report_id <> primary_report_id)
);

-- 9. Private Notes Table
CREATE TABLE IF NOT EXISTS private_notes (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Photo Metadata Table
CREATE TABLE IF NOT EXISTS photo_metadata (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    uploader_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 5242880),
    is_resolution_photo INTEGER NOT NULL DEFAULT 0,
    vision_clues_json TEXT,
    confidence_score INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
);

-- 12. Notification Jobs Table
CREATE TABLE IF NOT EXISTS notification_jobs (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Processing', 'Delivered', 'Failed', 'Skipped')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_eligible_retry_at TEXT,
    lease_token TEXT,
    lease_expires_at TEXT,
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. Maintenance Schedules Table (PRD Section 4: Confirmed Maintenance Activities)
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    department_name TEXT NOT NULL,
    area TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK(status IN ('Scheduled', 'In Progress', 'Completed', 'Delayed', 'Overdue')),
    official_source TEXT,
    description TEXT NOT NULL,
    assigned_staff_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_staff_name TEXT,
    created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 14. Official Civic Knowledge Base (PRD Section 4: Verified Statutory Articles)
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    official_source TEXT NOT NULL,
    last_verified TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15. Community Impact Voting Table (PRD F7)
CREATE TABLE IF NOT EXISTS community_votes (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT uq_report_citizen_vote UNIQUE (report_id, citizen_id)
);

-- 16. Citizen Appeals & Administrative Review Table (PRD Section 4 & 5)
CREATE TABLE IF NOT EXISTS report_appeals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    appeal_type TEXT NOT NULL DEFAULT 'resolution' CHECK (appeal_type IN ('rejection', 'resolution', 'general')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_notes TEXT,
    decided_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    decided_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 17. Citizen Satisfaction Feedback Table (PRD Section 4 #48)
CREATE TABLE IF NOT EXISTS report_feedback (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_citizen ON reports(citizen_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_staff ON reports(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_reports_department ON reports(department_id);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_sla ON reports(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_reports_escalation ON reports(escalation_level);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(report_id, staff_id, active);
CREATE INDEX IF NOT EXISTS idx_report_events_report ON report_events(report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_maint_dates ON maintenance_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_schedules(status);
CREATE INDEX IF NOT EXISTS idx_maint_dept ON maintenance_schedules(department_id);
CREATE INDEX IF NOT EXISTS idx_maint_staff ON maintenance_schedules(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_community_votes_report ON community_votes(report_id);
CREATE INDEX IF NOT EXISTS idx_community_votes_citizen ON community_votes(citizen_id);
CREATE INDEX IF NOT EXISTS idx_appeals_report ON report_appeals(report_id);
CREATE INDEX IF NOT EXISTS idx_appeals_citizen ON report_appeals(citizen_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON report_appeals(status);
CREATE INDEX IF NOT EXISTS idx_feedback_report ON report_feedback(report_id);
