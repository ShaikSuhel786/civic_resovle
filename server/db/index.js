const path = require('path');
const fs = require('fs');
require('dotenv').config();

const isSupabaseConfigured = Boolean(
  process.env.SUPABASE_URL && 
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_URL.includes('your-project-id')
);

let db = null;
let supabaseClient = null;

if (isSupabaseConfigured) {
  const { createClient } = require('@supabase/supabase-js');
  supabaseClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log('[DB] Connected to Supabase Project:', process.env.SUPABASE_URL);
}

// SQLite engine with automated seed & serverless fallback
let Database = null;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('[DB Warning] better-sqlite3 native binary not available in this environment:', e.message);
}

const seedDataPath = path.join(__dirname, 'seed-data.json');
let seedData = { departments: [], categories: [], profiles: [], reports: [] };
if (fs.existsSync(seedDataPath)) {
  try {
    seedData = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
  } catch (_) {}
}

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
}
const dbPath = path.join(dataDir, 'civic_resolve.db');

if (Database) {
  try {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');

    // Ensure production columns exist on existing tables before schema indexes run
    try { db.exec('ALTER TABLE profiles ADD COLUMN phone TEXT;'); } catch (_) {}
    try { db.exec('ALTER TABLE reports ADD COLUMN community_votes INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
    try { db.exec('ALTER TABLE reports ADD COLUMN sla_deadline TEXT;'); } catch (_) {}
    try { db.exec('ALTER TABLE reports ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
    try { db.exec('ALTER TABLE reports ADD COLUMN last_escalated_at TEXT;'); } catch (_) {}
    try { db.exec('ALTER TABLE photo_metadata ADD COLUMN vision_clues_json TEXT;'); } catch (_) {}
    try { db.exec('ALTER TABLE photo_metadata ADD COLUMN confidence_score INTEGER;'); } catch (_) {}
    try { db.exec('ALTER TABLE maintenance_schedules ADD COLUMN assigned_staff_id TEXT;'); } catch (_) {}
    try { db.exec('ALTER TABLE maintenance_schedules ADD COLUMN assigned_staff_name TEXT;'); } catch (_) {}

    // Initialize schema if not present
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
      db.exec(schemaSql);
    }

    // Additive migration: PRD Section 4 & 5 Citizen Appeals
    try {
      db.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_appeals_report ON report_appeals(report_id);
        CREATE INDEX IF NOT EXISTS idx_appeals_citizen ON report_appeals(citizen_id);
        CREATE INDEX IF NOT EXISTS idx_appeals_status ON report_appeals(status);
      `);
    } catch (_) {}

    // Additive migration: PRD Section 4 #48 Citizen Satisfaction Feedback
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS report_feedback (
            id TEXT PRIMARY KEY,
            report_id TEXT NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
            citizen_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_feedback_report ON report_feedback(report_id);
      `);
    } catch (_) {}

    // Backfill SLA deadlines for existing records if null
    try {
      const reportsNeedingSla = db.prepare("SELECT id, created_at, priority_level, category_id, safety_flag FROM reports WHERE sla_deadline IS NULL").all();
      if (reportsNeedingSla.length > 0) {
        const updateSlaStmt = db.prepare("UPDATE reports SET sla_deadline = ? WHERE id = ?");
        for (const rep of reportsNeedingSla) {
          const createdTime = rep.created_at ? new Date(rep.created_at).getTime() : Date.now();
          let hours = 168; // 7 days default
          if (rep.safety_flag || rep.priority_level === 'Urgent') hours = 24;
          else if (rep.priority_level === 'High') hours = 72;
          else if (rep.category_id === 'cat-sanitation' || rep.category_id === 'cat-electrical') hours = 48;
          else if (rep.priority_level === 'Low') hours = 336;
          const deadline = new Date(createdTime + hours * 3600 * 1000).toISOString();
          updateSlaStmt.run(deadline, rep.id);
        }
      }
    } catch (_) {}

    // Ensure maintenance_schedules table exists and is seeded with initial confirmed works
    try {
      db.exec(`
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
      `);

      const mCount = db.prepare('SELECT count(*) as count FROM maintenance_schedules').get()?.count || 0;
      if (mCount === 0) {
        const initialMaintenance = [
          {
            id: 'maint-01',
            title: 'Main Water Pipeline Replacement & Pressure Valve Overhaul',
            department_id: 'dept-water',
            department_name: 'Water & Drainage',
            area: 'Banjara Hills, Road No. 12 to 14',
            start_date: '2026-10-24',
            end_date: '2026-11-04',
            status: 'In Progress',
            official_source: 'MW-2026-WTR-402',
            description: 'Upgrading 600mm feeder pipeline with modern ductile iron pipes. Potential low pressure during night hours (11 PM - 4 AM).'
          },
          {
            id: 'maint-02',
            title: 'Arterial Road Milling & Asphalt Resurfacing',
            department_id: 'dept-roads',
            department_name: 'Roads & Transport',
            area: 'Jubilee Hills Checkpost to Road 36',
            start_date: '2026-11-02',
            end_date: '2026-11-12',
            status: 'Scheduled',
            official_source: 'MW-2026-RDS-108',
            description: 'Full depth asphalt resurfacing and stormwater catch-pit leveling. Evening lane diversions between 10 PM and 6 AM.'
          },
          {
            id: 'maint-03',
            title: 'High-Tension Substation & Streetlight Feeder Maintenance',
            department_id: 'dept-electrical',
            department_name: 'Electrical Services',
            area: 'Madhapur Commercial Belt, Sector 2',
            start_date: '2026-10-15',
            end_date: '2026-10-22',
            status: 'Delayed',
            official_source: 'MW-2026-ELE-890',
            description: 'Feeder cable replacement and automated LED timer switch installation. Work delayed due to specialized circuit breaker delivery.'
          },
          {
            id: 'maint-04',
            title: 'Primary Storm Drain Desilting & Culvert Clearing',
            department_id: 'dept-sanitation',
            department_name: 'Sanitation',
            area: 'Ameerpet Metro Station Catchment',
            start_date: '2026-10-01',
            end_date: '2026-10-18',
            status: 'Completed',
            official_source: 'MW-2026-SAN-315',
            description: 'Pre-monsoon deep silt removal from main outflow canal. Completed ahead of schedule.'
          },
          {
            id: 'maint-05',
            title: 'Heritage Walkway Curb Realignment & Tree Trimming',
            department_id: 'dept-publicworks',
            department_name: 'Public Works',
            area: 'Old City Charminar Buffer Zone',
            start_date: '2026-11-15',
            end_date: '2026-11-25',
            status: 'Scheduled',
            official_source: 'MW-2026-PW-512',
            description: 'Pedestrian paving repairs and structural pruning of overgrown boughs near overhead utility lines.'
          }
        ];

        const insMaint = db.prepare(`
          INSERT INTO maintenance_schedules (
            id, title, department_id, department_name, area, start_date, end_date, status, official_source, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const m of initialMaintenance) {
          insMaint.run(m.id, m.title, m.department_id, m.department_name, m.area, m.start_date, m.end_date, m.status, m.official_source, m.description);
        }
      }
    } catch (mErr) {
      console.warn('[DB] Maintenance table init warning:', mErr.message);
    }

    // Ensure knowledge_articles table exists and is seeded with verified municipal statutory citations
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            official_source TEXT NOT NULL,
            last_verified TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      const kCount = db.prepare('SELECT count(*) as count FROM knowledge_articles').get()?.count || 0;
      if (kCount === 0) {
        const initialArticles = [
          {
            id: 'know-01',
            title: 'How Road & Pothole Repair Deadlines Work',
            category: 'Roads & Transport',
            content: 'Reported potholes are categorized into three response tiers: Critical arterial hazards are evaluated within 24 hours, secondary collector roads within 72 hours, and local colony lanes within 5 working days. Repairs use quick-setting cold bituminous mix during wet conditions and standard hot-mix paving during dry weather.',
            official_source: 'Municipal Works Bylaw 2024, Sec 14',
            last_verified: '2026-10-27 05:31:24'
          },
          {
            id: 'know-02',
            title: 'Reporting Electrical Hazards & Streetlight Failures',
            category: 'Electrical Services',
            content: 'Exposed live cables or sparking feeder pillars are tagged as Immediate Safety Hazards with mandatory 24-hour technician dispatch. Standard luminaire non-functioning reports follow a 48-hour repair SLA from receipt of verification.',
            official_source: 'State Electricity Distribution Code, Art. 9',
            last_verified: '2026-10-27 05:31:24'
          },
          {
            id: 'know-03',
            title: 'Household Waste Segregation & Bulk Debris Pickup',
            category: 'Sanitation',
            content: 'Citizens are required by municipal ordinance to segregate wet (organic/green bin) and dry (recyclable/blue bin) waste at source. Bulk construction debris and tree trimmings cannot be dumped in community bins; residents can request dedicated tractor pickup through this portal within 48 hours.',
            official_source: 'Solid Waste Management Guidelines 2024, Rule 15',
            last_verified: '2026-10-27 05:31:24'
          },
          {
            id: 'know-04',
            title: 'Drinking Water Supply Schedules & Pipeline Leaks',
            category: 'Water & Drainage',
            content: 'Piped drinking water is supplied on alternate days between 06:00 and 09:30 AM in designated pressure zones. Main pipeline fractures resulting in visible street runoff are prioritized within 36 hours to conserve municipal reservoir reserves.',
            official_source: 'Water Supply Board Operations Manual 2025, Sec 32',
            last_verified: '2026-10-27 05:31:24'
          },
          {
            id: 'know-05',
            title: 'Open Manholes & Stormwater Drain Desilting Safety',
            category: 'Public Safety',
            content: 'Missing or dislodged manhole covers are treated as critical life-safety emergencies. Immediate barricading is mandated within 2 hours of report receipt, followed by structural replacement within 12 hours. Pre-monsoon culvert desilting occurs annually between April and June.',
            official_source: 'Disaster Management & Civic Safety Protocol 2024, Sec 8',
            last_verified: '2026-10-28 10:00:00'
          },
          {
            id: 'know-06',
            title: 'Unauthorized Road Cutting & Trenching Penalties',
            category: 'Roads & Transport',
            content: 'No utility, private developer, or resident may dig or trench public carriage-ways without an authorized Right-of-Way (RoW) permit. Unauthorized excavations incur mandatory restoration penalties plus compounding daily fines under Section 228.',
            official_source: 'Telangana Municipalities Act 2019, Sec 228',
            last_verified: '2026-10-28 10:00:00'
          }
        ];

        const insArt = db.prepare(`
          INSERT INTO knowledge_articles (id, title, category, content, official_source, last_verified, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        for (const a of initialArticles) {
          insArt.run(a.id, a.title, a.category, a.content, a.official_source, a.last_verified);
        }
      }
    } catch (kErr) {
      console.warn('[DB] Knowledge table init warning:', kErr.message);
    }

    // Auto-seed if profiles table is empty (e.g. freshly created in /tmp on Vercel)
    try {
      const pCount = db.prepare('SELECT count(*) as count FROM profiles').get()?.count || 0;
      if (pCount === 0 && seedData.profiles.length > 0) {
        console.log('[DB] Fresh database detected. Auto-seeding initial data...');
        const insDept = db.prepare('INSERT OR IGNORE INTO departments (id, name, active) VALUES (?, ?, 1)');
        for (const d of seedData.departments) insDept.run(d.id, d.name);

        const insCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, department_id, active) VALUES (?, ?, ?, 1)');
        for (const c of seedData.categories) insCat.run(c.id, c.name, c.department_id);

        const insProf = db.prepare(`
          INSERT OR IGNORE INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash, phone)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `);
        for (const p of seedData.profiles) {
          insProf.run(p.id, p.email, p.display_name, p.role, p.department_id, p.preferred_language || 'en', p.password_hash, p.phone || null);
        }

        const insRep = db.prepare(`
          INSERT OR IGNORE INTO reports (
            id, reference_number, citizen_id, title, description, category_id, department_id,
            location_text, latitude, longitude, status, priority_score, priority_level,
            severity_factor, safety_factor, people_factor, duration_factor,
            safety_flag, safety_flag_reason, review_required, review_reason, analysis_state,
            suggested_category_id, suggested_department_id, confidence_score, analysis_reasoning,
            assigned_staff_id, blocked_reason, rejected_reason, resolution_summary, idempotency_key, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of seedData.reports) {
          insRep.run(
            r.id, r.reference_number, r.citizen_id, r.title, r.description, r.category_id, r.department_id,
            r.location_text, r.latitude, r.longitude, r.status, r.priority_score, r.priority_level,
            r.severity_factor || 50, r.safety_factor || 50, r.people_factor || 50, r.duration_factor || 50,
            r.safety_flag || 0, r.safety_flag_reason || null, r.review_required || 0, r.review_reason || null, r.analysis_state || 'Completed',
            r.suggested_category_id || r.category_id, r.suggested_department_id || r.department_id, r.confidence_score || 90, r.analysis_reasoning || 'Automated triage',
            r.assigned_staff_id || null, r.blocked_reason || null, r.rejected_reason || null, r.resolution_summary || null, r.idempotency_key || null, r.created_at, r.updated_at || r.created_at
          );
        }
        console.log('[DB] Auto-seed complete.');
      }
    } catch (sErr) {
      console.warn('[DB] Auto-seed check warning:', sErr.message);
    }
  } catch (err) {
    console.error('[DB] SQLite initialization failed:', err);
    db = null;
  }
}

// In production, fail fast if the selected persistent database cannot initialize
if (!db) {
  const fatalMsg = '[DB FATAL] Database initialization failed. Persistent database engine could not be initialized. Silent in-memory mock fallback is disabled to prevent silent data loss.';
  console.error(fatalMsg);
  throw new Error(fatalMsg);
}

module.exports = {
  db,
  supabaseClient,
  isSupabaseConfigured,

  // Helper query methods
  all(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  },

  get(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(params);
  },

  run(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(params);
  },

  transaction(fn) {
    return db.transaction(fn)();
  }
};
