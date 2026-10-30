// Civic Resolve AI: Auto-Seed Initializer for SQLite Fallback
// Ensures demo accounts and initial civic data exist when running without external PostgreSQL.

const bcrypt = require('bcryptjs');

function autoSeedSQLite(sqliteDb) {
  try {
    const countRes = sqliteDb.prepare("SELECT count(*) as count FROM profiles").get();
    if (countRes && countRes.count > 0) {
      return; // Already seeded
    }

    console.log('[DB] Empty SQLite database detected. Auto-seeding demo accounts and civic data...');

    // 1. Departments
    const insertDept = sqliteDb.prepare('INSERT OR IGNORE INTO departments (id, name, active) VALUES (?, ?, 1)');
    const departments = [
      { id: 'dept-roads', name: 'Roads & Transport' },
      { id: 'dept-electrical', name: 'Electrical Services' },
      { id: 'dept-sanitation', name: 'Sanitation' },
      { id: 'dept-water', name: 'Water & Drainage' },
      { id: 'dept-publicworks', name: 'Public Works' }
    ];
    for (const d of departments) insertDept.run(d.id, d.name);

    // 2. Categories
    const insertCat = sqliteDb.prepare('INSERT OR IGNORE INTO categories (id, name, department_id, active) VALUES (?, ?, ?, 1)');
    const categories = [
      { id: 'cat-roads', name: 'Roads and potholes', department_id: 'dept-roads' },
      { id: 'cat-streetlights', name: 'Streetlights', department_id: 'dept-electrical' },
      { id: 'cat-garbage', name: 'Garbage and sanitation', department_id: 'dept-sanitation' },
      { id: 'cat-water', name: 'Water supply and leakage', department_id: 'dept-water' },
      { id: 'cat-drainage', name: 'Drainage and sewage', department_id: 'dept-water' },
      { id: 'cat-publicworks', name: 'Public property damage', department_id: 'dept-publicworks' },
      { id: 'cat-trafficsigns', name: 'Traffic signs and road safety', department_id: 'dept-roads' },
      { id: 'cat-other', name: 'Other civic issues', department_id: 'dept-publicworks' }
    ];
    for (const c of categories) insertCat.run(c.id, c.name, c.department_id);

    // 3. Demo Profiles
    const defaultPasswordHash = bcrypt.hashSync('DemoCitizen123!', 10);
    const adminPasswordHash = bcrypt.hashSync('DemoAdmin123!', 10);
    const staffPasswordHash = bcrypt.hashSync('DemoStaff123!', 10);

    const profiles = [
      { id: 'usr-admin-01', email: 'admin@civicsync.demo', display_name: 'Municipal Admin Officer', role: 'admin', department_id: null, password_hash: adminPasswordHash, preferred_language: 'en' },
      { id: 'usr-citizen-01', email: 'citizen@civicsync.demo', display_name: 'Priya Sharma (Citizen)', role: 'citizen', department_id: null, password_hash: defaultPasswordHash, preferred_language: 'en' },
      { id: 'usr-citizen-02', email: 'citizen2@civicsync.demo', display_name: 'Rajesh Kumar (Citizen)', role: 'citizen', department_id: null, password_hash: defaultPasswordHash, preferred_language: 'te' },
      { id: 'usr-staff-roads', email: 'staff.roads@civicsync.demo', display_name: 'Venkatesh Rao (Roads Staff)', role: 'staff', department_id: 'dept-roads', password_hash: staffPasswordHash, preferred_language: 'en' },
      { id: 'usr-staff-sanitation', email: 'staff.sanitation@civicsync.demo', display_name: 'K. Anitha (Sanitation Staff)', role: 'staff', department_id: 'dept-sanitation', password_hash: staffPasswordHash, preferred_language: 'en' },
      { id: 'usr-staff-electrical', email: 'staff.electrical@civicsync.demo', display_name: 'Suresh Babu (Electrical Staff)', role: 'staff', department_id: 'dept-electrical', password_hash: staffPasswordHash, preferred_language: 'en' },
      { id: 'usr-staff-water', email: 'staff.water@civicsync.demo', display_name: 'Mohammed Ali (Water Staff)', role: 'staff', department_id: 'dept-water', password_hash: staffPasswordHash, preferred_language: 'en' },
      { id: 'usr-staff-publicworks', email: 'staff.publicworks@civicsync.demo', display_name: 'Lakshmi Devi (Public Works Staff)', role: 'staff', department_id: 'dept-publicworks', password_hash: staffPasswordHash, preferred_language: 'en' }
    ];

    const insertProfile = sqliteDb.prepare(`
      INSERT OR IGNORE INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const p of profiles) {
      insertProfile.run(p.id, p.email, p.display_name, p.role, p.department_id, p.preferred_language, p.password_hash);
    }

    // 4. Initial Maintenance Schedules
    const maintenanceSchedules = [
      { id: 'maint-01', title: 'Quarterly Water Pipeline Desilting & Overhaul', department_id: 'dept-water', department_name: 'Water & Drainage', area: 'Banjara Hills & Jubilee Hills', start_date: '2026-11-01', end_date: '2026-11-04', status: 'Scheduled', official_source: 'GHMC Water Works Circular 42/2026', description: 'Preventive desilting of primary 600mm distribution trunk mains to maintain water pressure and prevent winter supply blockages.', assigned_staff_id: 'usr-staff-water', assigned_staff_name: 'Mohammed Ali (Water Staff)' },
      { id: 'maint-02', title: 'LED Luminaire Retrofit & Grid Calibration', department_id: 'dept-electrical', department_name: 'Electrical Services', area: 'Secunderabad Corridor', start_date: '2026-10-25', end_date: '2026-11-02', status: 'In Progress', official_source: 'Municipal Electrical Directive 18/2026', description: 'Systematic replacement of sodium vapor streetlights with energy-efficient 40W smart LED luminaires and timer recalibration.', assigned_staff_id: 'usr-staff-electrical', assigned_staff_name: 'Suresh Babu (Electrical Staff)' },
      { id: 'maint-03', title: 'Corridor Asphalt Milling & Surface Re-profiling', department_id: 'dept-roads', department_name: 'Roads & Transport', area: 'Hitech City Express Ring', start_date: '2026-11-05', end_date: '2026-11-12', status: 'Scheduled', official_source: 'Roads & Bridges Dept Engineering Plan 2026', description: 'Milling aged asphalt and laying 50mm high-density bituminous concrete on high-traffic flyover approach lanes.', assigned_staff_id: 'usr-staff-roads', assigned_staff_name: 'Venkatesh Rao (Roads Staff)' },
      { id: 'maint-04', title: 'Stormwater Drain Channel Deepening & Desilting', department_id: 'dept-water', department_name: 'Water & Drainage', area: 'Old City / Charminar Basin', start_date: '2026-10-18', end_date: '2026-10-24', status: 'Completed', official_source: 'Flood Mitigation Wing Protocol 2026', description: 'Pre-winter silt clearance and hydraulic deepening of Box Drains 1 through 4 to ensure gravity outflow.', assigned_staff_id: 'usr-staff-water', assigned_staff_name: 'Mohammed Ali (Water Staff)' },
      { id: 'maint-05', title: 'Culvert Debris Extraction & Masonry Repair', department_id: 'dept-sanitation', department_name: 'Sanitation', area: 'Ward 5 Culvert, Begumpet', start_date: '2026-09-15', end_date: '2026-09-25', status: 'Delayed', official_source: 'GHMC Sanitation Protocol S-88', description: 'Crane dredging and hydraulic silt suction across primary outflow channels. Delayed due to heavy monsoon sediment accumulation.', assigned_staff_id: 'usr-staff-sanitation', assigned_staff_name: 'K. Anitha (Sanitation Staff)' },
      { id: 'maint-06', title: 'Public Park Boundary Wall & Pavement Rehabilitation', department_id: 'dept-publicworks', department_name: 'Public Works', area: 'Indira Park Sector 3', start_date: '2026-11-12', end_date: '2026-11-20', status: 'Scheduled', official_source: 'Urban Infrastructure Order 2026-88', description: 'Reconstruction of damaged boundary masonry, installation of anti-slip tactile paving, and accessible curb ramps.', assigned_staff_id: 'usr-staff-publicworks', assigned_staff_name: 'Lakshmi Devi (Public Works Staff)' },
      { id: 'maint-07', title: 'High-Tension Substation Transformer Overhaul', department_id: 'dept-electrical', department_name: 'Electrical Services', area: 'Madhapur Power Substation', start_date: '2026-10-28', end_date: '2026-11-03', status: 'In Progress', official_source: 'State Electricity Board Notice 2026-9', description: 'Insulation dielectric oil testing, bushing maintenance, and telemetry RTU updates to prevent ward power spikes.', assigned_staff_id: 'usr-staff-electrical', assigned_staff_name: 'Suresh Babu (Electrical Staff)' },
      { id: 'maint-08', title: 'Traffic Signal Sensor Loop Replacement', department_id: 'dept-roads', department_name: 'Roads & Transport', area: 'Panjagutta Central Circle', start_date: '2026-11-08', end_date: '2026-11-15', status: 'Scheduled', official_source: 'Traffic Safety Taskforce Circular 14', description: 'Installation of inductive loop vehicle detectors and adaptive signal controllers to optimize peak hour flow.', assigned_staff_id: 'usr-staff-roads', assigned_staff_name: 'Venkatesh Rao (Roads Staff)' }
    ];

    const insertMaint = sqliteDb.prepare(`
      INSERT OR IGNORE INTO maintenance_schedules (
        id, title, department_id, department_name, area, start_date, end_date,
        status, official_source, description, assigned_staff_id, assigned_staff_name, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usr-admin-01', datetime('now'), datetime('now'))
    `);
    for (const m of maintenanceSchedules) {
      insertMaint.run(m.id, m.title, m.department_id, m.department_name, m.area, m.start_date, m.end_date, m.status, m.official_source, m.description, m.assigned_staff_id, m.assigned_staff_name);
    }

    console.log('[DB] Auto-seed complete: departments, categories, 8 demo profiles, and 8 maintenance schedules ready.');
  } catch (err) {
    console.warn('[DB] Auto-seed notice:', err.message);
  }
}

module.exports = { autoSeedSQLite };
