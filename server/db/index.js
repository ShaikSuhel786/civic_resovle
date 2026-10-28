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

    // Initialize schema if not present
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
      db.exec(schemaSql);
    }

    // Ensure production user profile columns exist
    try { db.exec('ALTER TABLE profiles ADD COLUMN phone TEXT;'); } catch (_) {}

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
          INSERT OR IGNORE INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `);
        for (const p of seedData.profiles) {
          insProf.run(p.id, p.email, p.display_name, p.role, p.department_id, p.preferred_language || 'en', p.password_hash);
        }

        const insRep = db.prepare(`
          INSERT OR IGNORE INTO reports (
            id, reference_number, citizen_id, title, description, category_id, department_id,
            location_text, latitude, longitude, status, priority_score, priority_level,
            safety_flag, safety_flag_reason, review_required, review_reason, assigned_staff_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of seedData.reports) {
          insRep.run(
            r.id, r.reference_number, r.citizen_id, r.title, r.description, r.category_id, r.department_id,
            r.location_text, r.latitude, r.longitude, r.status, r.priority_score, r.priority_level,
            r.safety_flag, r.safety_flag_reason, r.review_required, r.review_reason, r.assigned_staff_id, r.created_at
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

// Memory database fallback for serverless environments where native modules cannot load
if (!db) {
  console.log('[DB] Operating in Serverless Resilient Memory Mode.');
  const memProfiles = [...seedData.profiles];
  const memReports = [...seedData.reports];
  const memCategories = [...seedData.categories];
  const memDepartments = [...seedData.departments];

  db = {
    pragma() {},
    exec() {},
    transaction(fn) { return fn; },
    prepare(sql) {
      const s = sql.trim().toLowerCase();
      return {
        all(params = []) {
          if (s.includes('from profiles')) {
            if (s.includes("role = 'staff'") || s.includes('role = "staff"')) {
              return memProfiles.filter(p => p.role === 'staff');
            }
            return memProfiles;
          }
          if (s.includes('from reports')) {
            return memReports;
          }
          if (s.includes('from categories')) return memCategories;
          if (s.includes('from departments')) return memDepartments;
          return [];
        },
        get(params = []) {
          if (s.includes('from profiles')) {
            if (params.length > 0) {
              const pVal = String(params[0]).toLowerCase();
              return memProfiles.find(p => p.id === params[0] || p.email.toLowerCase() === pVal) || null;
            }
            return memProfiles[0] || null;
          }
          if (s.includes('from reports')) {
            if (params.length > 0) {
              return memReports.find(r => r.id === params[0] || r.reference_number === params[0]) || null;
            }
            return memReports[0] || null;
          }
          if (s.includes('count(*)')) return { count: memProfiles.length };
          return null;
        },
        run(params = []) {
          return { changes: 1, lastInsertRowid: Date.now() };
        }
      };
    }
  };
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
