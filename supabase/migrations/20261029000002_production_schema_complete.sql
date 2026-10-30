-- Civic Resolve AI: Production Schema Completion Migration
-- Migration: 20261029000002_production_schema_complete.sql
-- Completes the production schema for all 17 operational tables, columns, indexes, and RLS policies.
-- Compatible with Supabase PostgreSQL and PostgreSQL 15+

-- 1. Ensure additive columns on existing tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS community_votes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

ALTER TABLE photo_metadata ADD COLUMN IF NOT EXISTS vision_clues_json TEXT;
ALTER TABLE photo_metadata ADD COLUMN IF NOT EXISTS confidence_score INTEGER;

-- 2. Maintenance Schedules Table (PRD Section 4: Confirmed Maintenance Activities)
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

-- 3. Official Civic Knowledge Base (PRD Section 4: Verified Statutory Articles)
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    official_source TEXT NOT NULL,
    last_verified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Community Impact Voting Table (PRD F7)
CREATE TABLE IF NOT EXISTS community_votes (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_report_citizen_vote UNIQUE (report_id, citizen_id)
);

-- 5. Citizen Appeals & Administrative Review Table (PRD Section 4 & 5)
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

-- 6. Citizen Satisfaction Feedback Table (PRD Section 4 #48)
CREATE TABLE IF NOT EXISTS report_feedback (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and query optimization
CREATE INDEX IF NOT EXISTS idx_reports_sla ON reports(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_reports_escalation ON reports(escalation_level);
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

-- Row Level Security (RLS) Policies
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_feedback ENABLE ROW LEVEL SECURITY;

-- Maintenance Schedules: Public read, admin write, assigned staff update
CREATE POLICY "Public can view maintenance schedules" ON maintenance_schedules FOR SELECT USING (true);
CREATE POLICY "Admin full access to maintenance" ON maintenance_schedules FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);
CREATE POLICY "Staff can update assigned maintenance" ON maintenance_schedules FOR UPDATE USING (
    assigned_staff_id = auth.uid()::text OR
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid()::text 
          AND profiles.role = 'staff' 
          AND profiles.department_id = maintenance_schedules.department_id
    )
);

-- Knowledge Base: Public read, admin write
CREATE POLICY "Public can view knowledge articles" ON knowledge_articles FOR SELECT USING (true);
CREATE POLICY "Admin full access to knowledge articles" ON knowledge_articles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

-- Community Votes: Viewable by all, citizens can cast/retract own votes
CREATE POLICY "Public can view community votes" ON community_votes FOR SELECT USING (true);
CREATE POLICY "Citizens can insert own votes" ON community_votes FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Citizens can delete own votes" ON community_votes FOR DELETE USING (
    citizen_id = auth.uid()::text
);

-- Appeals: Citizens view own, admin view/manage all
CREATE POLICY "Citizens can view own appeals" ON report_appeals FOR SELECT USING (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Citizens can insert own appeals" ON report_appeals FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Admin full access to appeals" ON report_appeals FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

-- Feedback: Citizens view/create own feedback, admin view all
CREATE POLICY "Citizens can insert own feedback" ON report_feedback FOR INSERT WITH CHECK (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Citizens can view own feedback" ON report_feedback FOR SELECT USING (
    citizen_id = auth.uid()::text
);
CREATE POLICY "Admin full access to feedback" ON report_feedback FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()::text AND profiles.role = 'admin')
);

