-- Civic Resolve AI: Complete PostgreSQL Production Schema
-- Compatible with Supabase PostgreSQL and PostgreSQL 15+
-- Enforces all 17 relational tables, check constraints, foreign keys, indexes, and RLS policies.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('citizen', 'staff', 'admin')),
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_language TEXT NOT NULL DEFAULT 'en' CHECK(preferred_language IN ('en', 'te')),
    password_hash TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reference_number TEXT NOT NULL UNIQUE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT NOT NULL CHECK(LENGTH(description) >= 20 AND LENGTH(description) <= 2000),
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    location_text TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_verified BOOLEAN NOT NULL DEFAULT TRUE,
    is_out_of_boundary BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Blocked', 'Resolved', 'Rejected', 'Withdrawn', 'Duplicate')),
    priority_score INTEGER DEFAULT 0 CHECK(priority_score >= 0 AND priority_score <= 100),
    priority_level TEXT DEFAULT 'Medium' CHECK(priority_level IN ('Low', 'Medium', 'High', 'Urgent')),
    severity_factor INTEGER DEFAULT 50 CHECK(severity_factor >= 0 AND severity_factor <= 100),
    safety_factor INTEGER DEFAULT 50 CHECK(safety_factor >= 0 AND safety_factor <= 100),
    people_factor INTEGER DEFAULT 50 CHECK(people_factor >= 0 AND people_factor <= 100),
    duration_factor INTEGER DEFAULT 50 CHECK(duration_factor >= 0 AND duration_factor <= 100),
    safety_flag BOOLEAN NOT NULL DEFAULT FALSE,
    safety_flag_reason TEXT,
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
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
    sla_deadline TIMESTAMPTZ,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    last_escalated_at TIMESTAMPTZ,
    privacy_acknowledged_at TIMESTAMPTZ,
    privacy_notice_version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    reason TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6. Report Events Table
CREATE TABLE IF NOT EXISTS report_events (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    citizen_visible BOOLEAN NOT NULL DEFAULT TRUE,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_at TIMESTAMPTZ,
    CHECK (duplicate_report_id <> primary_report_id)
);

-- 9. Private Notes Table
CREATE TABLE IF NOT EXISTS private_notes (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    is_resolution_photo BOOLEAN NOT NULL DEFAULT FALSE,
    vision_clues_json TEXT,
    confidence_score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    report_id TEXT REFERENCES reports(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
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
    next_eligible_retry_at TIMESTAMPTZ,
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Maintenance Schedules Table
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    official_source TEXT NOT NULL,
    last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Community Votes Table
CREATE TABLE IF NOT EXISTS community_votes (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_report_citizen_vote UNIQUE (report_id, citizen_id)
);

-- 16. Citizen Appeals Table
CREATE TABLE IF NOT EXISTS report_appeals (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    appeal_type TEXT NOT NULL DEFAULT 'resolution' CHECK (appeal_type IN ('rejection', 'resolution', 'general')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    admin_notes TEXT,
    decided_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Citizen Feedback Table
CREATE TABLE IF NOT EXISTS report_feedback (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_reports_review_required ON reports(review_required, safety_flag);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(report_id, staff_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_events_report ON report_events(report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_report ON photo_metadata(report_id);
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

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles viewable" ON profiles FOR SELECT USING (true);

-- Reports Policies
CREATE POLICY "Admin reports full access" ON reports FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);
CREATE POLICY "Citizen can read own reports" ON reports FOR SELECT USING (
    citizen_id = auth.uid()::text OR id IN (
        SELECT primary_report_id FROM reports WHERE citizen_id = auth.uid()::text AND primary_report_id IS NOT NULL
    )
);
CREATE POLICY "Citizen can insert own reports" ON reports FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Staff can view assigned reports" ON reports FOR SELECT USING (
    assigned_staff_id = auth.uid()::text OR department_id IN (
        SELECT department_id FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'staff'
    )
);

-- Private Notes Policies
CREATE POLICY "Admin private notes access" ON private_notes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);
CREATE POLICY "Staff private notes access" ON private_notes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM reports WHERE reports.id = private_notes.report_id AND reports.assigned_staff_id = auth.uid()::text
    )
);

-- Notifications Policies
CREATE POLICY "Users read own notifications" ON notifications FOR ALL USING (
    recipient_id = auth.uid()::text
);

-- Maintenance Policies
CREATE POLICY "Public can view maintenance schedules" ON maintenance_schedules FOR SELECT USING (true);
CREATE POLICY "Admin full access to maintenance" ON maintenance_schedules FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

-- Knowledge Articles Policies
CREATE POLICY "Public can view knowledge articles" ON knowledge_articles FOR SELECT USING (true);
CREATE POLICY "Admin full access to knowledge articles" ON knowledge_articles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

-- Community Votes Policies
CREATE POLICY "Public can view community votes" ON community_votes FOR SELECT USING (true);
CREATE POLICY "Citizens can insert own votes" ON community_votes FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Citizens can delete own votes" ON community_votes FOR DELETE USING (
    citizen_id = auth.uid()::text
);

-- Appeals Policies
CREATE POLICY "Citizens can view own appeals" ON report_appeals FOR SELECT USING (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Citizens can insert own appeals" ON report_appeals FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Admin full access to appeals" ON report_appeals FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

-- Feedback Policies
CREATE POLICY "Citizens can insert own feedback" ON report_feedback FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Citizens can view own feedback" ON report_feedback FOR SELECT USING (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Admin full access to feedback" ON report_feedback FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

