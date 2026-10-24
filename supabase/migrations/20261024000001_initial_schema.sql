-- Civic Resolve AI: Initial Schema Migration
-- Migration: 20261024000001_initial_schema.sql
-- Compatible with Supabase PostgreSQL and standard PostgreSQL 15+

-- Enable UUID extension if available
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

-- 6. Report Events Table (Chronological timeline)
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

-- 7. Audit Events Table (Privileged security audit)
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

-- 9. Private Notes Table (Internal staff and Admin only)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Notifications Table (In-app citizen alerts)
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

-- 12. Notification Jobs Table (Durable background retries)
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

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_reports_citizen ON reports(citizen_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_staff ON reports(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_reports_department ON reports(department_id);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_review_required ON reports(review_required, safety_flag);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(report_id, staff_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_events_report ON report_events(report_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_report ON photo_metadata(report_id);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read basic profile info for display, users can read their own
CREATE POLICY "Public profiles viewable" ON profiles FOR SELECT USING (true);

-- Reports: Citizens see own reports + permitted primary report info; Staff see assigned; Admin see all
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
    assigned_staff_id = auth.uid()::text
);

-- Private Notes: Staff can view if assigned; Admin can view all
CREATE POLICY "Admin private notes access" ON private_notes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

CREATE POLICY "Staff private notes access" ON private_notes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM reports WHERE reports.id = private_notes.report_id AND reports.assigned_staff_id = auth.uid()::text
    )
);

-- Notifications: Users only see their own notifications
CREATE POLICY "Users read own notifications" ON notifications FOR ALL USING (
    recipient_id = auth.uid()::text
);
