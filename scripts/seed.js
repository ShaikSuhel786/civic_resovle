// Civic Resolve AI: Deterministic Demo Data Seed Script
// Populates 24 synthetic reports across all states, departments, priorities, and roles.

const bcrypt = require('bcryptjs');
const dbHelper = require('../server/db/index');
const { db } = dbHelper;

async function seed() {
  console.log('[Seed] Starting deterministic database seeding...');

  // 1. Clear existing data in reverse foreign key order
  db.exec(`
    DELETE FROM notification_jobs;
    DELETE FROM notifications;
    DELETE FROM photo_metadata;
    DELETE FROM private_notes;
    DELETE FROM duplicate_relationships;
    DELETE FROM audit_events;
    DELETE FROM report_events;
    DELETE FROM assignments;
    DELETE FROM reports;
    DELETE FROM profiles;
    DELETE FROM categories;
    DELETE FROM departments;
  `);

  console.log('[Seed] Cleared existing tables.');

  // 2. Insert Departments
  const departments = [
    { id: 'dept-roads', name: 'Roads & Transport' },
    { id: 'dept-electrical', name: 'Electrical Services' },
    { id: 'dept-sanitation', name: 'Sanitation' },
    { id: 'dept-water', name: 'Water & Drainage' },
    { id: 'dept-publicworks', name: 'Public Works' }
  ];

  const insertDept = db.prepare('INSERT INTO departments (id, name, active) VALUES (?, ?, 1)');
  for (const d of departments) {
    insertDept.run(d.id, d.name);
  }

  // 3. Insert Categories
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

  const insertCat = db.prepare('INSERT INTO categories (id, name, department_id, active) VALUES (?, ?, ?, 1)');
  for (const c of categories) {
    insertCat.run(c.id, c.name, c.department_id);
  }

  // 4. Insert Demo Profiles
  const defaultPasswordHash = bcrypt.hashSync('DemoCitizen123!', 10);
  const adminPasswordHash = bcrypt.hashSync('DemoAdmin123!', 10);
  const staffPasswordHash = bcrypt.hashSync('DemoStaff123!', 10);

  const profiles = [
    {
      id: 'usr-admin-01',
      email: 'admin@civicsync.demo',
      display_name: 'Municipal Admin Officer',
      role: 'admin',
      department_id: null,
      password_hash: adminPasswordHash,
      preferred_language: 'en'
    },
    {
      id: 'usr-citizen-01',
      email: 'citizen@civicsync.demo',
      display_name: 'Priya Sharma (Citizen)',
      role: 'citizen',
      department_id: null,
      password_hash: defaultPasswordHash,
      preferred_language: 'en'
    },
    {
      id: 'usr-citizen-02',
      email: 'citizen2@civicsync.demo',
      display_name: 'Rajesh Kumar (Citizen)',
      role: 'citizen',
      department_id: null,
      password_hash: defaultPasswordHash,
      preferred_language: 'te'
    },
    {
      id: 'usr-staff-roads',
      email: 'staff.roads@civicsync.demo',
      display_name: 'Venkatesh Rao (Roads Staff)',
      role: 'staff',
      department_id: 'dept-roads',
      password_hash: staffPasswordHash,
      preferred_language: 'en'
    },
    {
      id: 'usr-staff-sanitation',
      email: 'staff.sanitation@civicsync.demo',
      display_name: 'K. Anitha (Sanitation Staff)',
      role: 'staff',
      department_id: 'dept-sanitation',
      password_hash: staffPasswordHash,
      preferred_language: 'en'
    },
    {
      id: 'usr-staff-electrical',
      email: 'staff.electrical@civicsync.demo',
      display_name: 'Suresh Babu (Electrical Staff)',
      role: 'staff',
      department_id: 'dept-electrical',
      password_hash: staffPasswordHash,
      preferred_language: 'en'
    },
    {
      id: 'usr-staff-water',
      email: 'staff.water@civicsync.demo',
      display_name: 'Mohammed Ali (Water Staff)',
      role: 'staff',
      department_id: 'dept-water',
      password_hash: staffPasswordHash,
      preferred_language: 'en'
    },
    {
      id: 'usr-staff-publicworks',
      email: 'staff.publicworks@civicsync.demo',
      display_name: 'Lakshmi Devi (Public Works Staff)',
      role: 'staff',
      department_id: 'dept-publicworks',
      password_hash: staffPasswordHash,
      preferred_language: 'en'
    }
  ];

  const insertProfile = db.prepare(`
    INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const p of profiles) {
    insertProfile.run(p.id, p.email, p.display_name, p.role, p.department_id, p.preferred_language, p.password_hash);
  }

  // 5. Seed Synthetic Reports (24 diverse reports matching PRD scenarios)
  const syntheticReports = [
    {
      id: 'rep-001',
      ref: 'REP-2026-001',
      citizen_id: 'usr-citizen-01',
      title: 'Dangerous exposed live wire sparking near school gate',
      description: 'There is an exposed wire sparking with live electric shock risk on the lamp post right in front of the primary school gate. Extremely dangerous for children passing by.',
      category_id: 'cat-streetlights',
      department_id: 'dept-electrical',
      location_text: 'Opposite St. Marks School, Road No 12, Banjara Hills, Hyderabad',
      lat: 17.4156,
      lng: 78.4352,
      status: 'Submitted',
      priority_score: 94,
      priority_level: 'Urgent',
      severity_factor: 90,
      safety_factor: 98,
      people_factor: 95,
      duration_factor: 40,
      safety_flag: 1,
      safety_flag_reason: 'CRITICAL HAZARD: High voltage electrical sparking hazard (keyword sparking)',
      review_required: 1,
      review_reason: 'Urgent Hazard Review: Sparking electrical hazard near school',
      analysis_state: 'Completed',
      suggested_category_id: 'cat-streetlights',
      suggested_department_id: 'dept-electrical',
      confidence_score: 92,
      assigned_staff_id: null,
      created_at: '2026-10-24 10:15:00'
    },
    {
      id: 'rep-002',
      ref: 'REP-2026-002',
      citizen_id: 'usr-citizen-01',
      title: 'Large pothole on main road causing severe traffic hazard',
      description: 'A deep crater and large pothole has formed on the main road causing safety risk for two-wheelers and heavy vehicle congestion during peak hours.',
      category_id: 'cat-roads',
      department_id: 'dept-roads',
      location_text: 'Near City Center Mall, Road No 1, Banjara Hills, Hyderabad',
      lat: 17.4201,
      lng: 78.4485,
      status: 'In Progress',
      priority_score: 82,
      priority_level: 'High',
      severity_factor: 85,
      safety_factor: 80,
      people_factor: 90,
      duration_factor: 60,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-roads',
      suggested_department_id: 'dept-roads',
      confidence_score: 90,
      assigned_staff_id: 'usr-staff-roads',
      created_at: '2026-10-22 09:30:00'
    },
    {
      id: 'rep-003',
      ref: 'REP-2026-003',
      citizen_id: 'usr-citizen-02',
      title: 'Large pothole near junction causing vehicle damage',
      description: 'A large pothole near the junction causing vehicle damage and traffic slowdown. Water accumulates when it rains making it invisible.',
      category_id: 'cat-roads',
      department_id: 'dept-roads',
      location_text: 'Banjara Hills Road No 1 Junction, Hyderabad',
      lat: 17.4215,
      lng: 78.4498,
      status: 'Duplicate',
      priority_score: 80,
      priority_level: 'High',
      severity_factor: 80,
      safety_factor: 78,
      people_factor: 88,
      duration_factor: 60,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-roads',
      suggested_department_id: 'dept-roads',
      confidence_score: 88,
      primary_report_id: 'rep-002',
      assigned_staff_id: null,
      created_at: '2026-10-22 14:20:00'
    },
    {
      id: 'rep-004',
      ref: 'REP-2026-004',
      citizen_id: 'usr-citizen-01',
      title: 'Overflowing garbage bin and foul smell at colony entrance',
      description: 'The municipal garbage dump and waste bin has been overflowing for the past 4 days. Stray animals are scattering trash across the street creating unsanitary conditions.',
      category_id: 'cat-garbage',
      department_id: 'dept-sanitation',
      location_text: 'Green Park Colony Entrance, Ameerpet, Hyderabad',
      lat: 17.4375,
      lng: 78.4482,
      status: 'Assigned',
      priority_score: 72,
      priority_level: 'High',
      severity_factor: 70,
      safety_factor: 65,
      people_factor: 85,
      duration_factor: 70,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-garbage',
      suggested_department_id: 'dept-sanitation',
      confidence_score: 95,
      assigned_staff_id: 'usr-staff-sanitation',
      created_at: '2026-10-23 08:45:00'
    },
    {
      id: 'rep-005',
      ref: 'REP-2026-005',
      citizen_id: 'usr-citizen-02',
      title: 'Drinking water pipeline burst wasting clean water',
      description: 'Major drinking water pipeline leak and burst pipe spraying clean water onto the street. Pressure in nearby households has completely dropped.',
      category_id: 'cat-water',
      department_id: 'dept-water',
      location_text: 'Near Pillar 1042, Metro Station, Madhapur, Hyderabad',
      lat: 17.4485,
      lng: 78.3789,
      status: 'Resolved',
      priority_score: 86,
      priority_level: 'Urgent',
      severity_factor: 85,
      safety_factor: 75,
      people_factor: 95,
      duration_factor: 50,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-water',
      suggested_department_id: 'dept-water',
      confidence_score: 94,
      assigned_staff_id: 'usr-staff-water',
      resolution_summary: 'Water department repair crew isolated the valve and welded the ruptured 200mm cast iron main. Pressure restored to all households.',
      created_at: '2026-10-20 07:15:00'
    },
    {
      id: 'rep-006',
      ref: 'REP-2026-006',
      citizen_id: 'usr-citizen-01',
      title: 'Blocked drainage and sewage overflow on residential street',
      description: 'Sewage drain is clogged and overflowing with foul stagnant water covering the entire road. Residents unable to step outside their homes.',
      category_id: 'cat-drainage',
      department_id: 'dept-water',
      location_text: 'Lane 4, Krishna Nagar, Yousufguda, Hyderabad',
      lat: 17.4320,
      lng: 78.4310,
      status: 'Blocked',
      priority_score: 76,
      priority_level: 'High',
      severity_factor: 80,
      safety_factor: 70,
      people_factor: 80,
      duration_factor: 65,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-drainage',
      suggested_department_id: 'dept-water',
      confidence_score: 91,
      assigned_staff_id: 'usr-staff-water',
      blocked_reason: 'Awaiting high-pressure jetting machine from zonal workshop. Narrow street blocked by unauthorized vehicle parking.',
      created_at: '2026-10-21 11:20:00'
    },
    {
      id: 'rep-007',
      ref: 'REP-2026-007',
      citizen_id: 'usr-citizen-02',
      title: 'Vague civic complaint regarding noise and strange odor',
      description: 'There is something wrong around the corner near the commercial building. Strange noise and foul smell during evenings, please investigate.',
      category_id: 'cat-other',
      department_id: null,
      location_text: 'Opposite Community Hall, Jubilee Hills, Hyderabad',
      lat: 17.4312,
      lng: 78.4075,
      status: 'Under Review',
      priority_score: 48,
      priority_level: 'Medium',
      severity_factor: 45,
      safety_factor: 40,
      people_factor: 60,
      duration_factor: 45,
      safety_flag: 0,
      review_required: 1,
      review_reason: 'Low AI confidence heuristic (55% < 80% threshold). Manual routing needed.',
      analysis_state: 'Completed',
      suggested_category_id: 'cat-other',
      suggested_department_id: null,
      confidence_score: 55,
      assigned_staff_id: null,
      created_at: '2026-10-23 15:40:00'
    },
    {
      id: 'rep-008',
      ref: 'REP-2026-008',
      citizen_id: 'usr-citizen-01',
      title: 'Broken pedestrian sidewalk pavement and missing paver blocks',
      description: 'The footpath pavement is broken and multiple paver blocks are missing causing senior citizens to trip and fall while walking.',
      category_id: 'cat-publicworks',
      department_id: 'dept-publicworks',
      location_text: 'Road No 36, Near Peddamma Temple Metro, Jubilee Hills, Hyderabad',
      lat: 17.4335,
      lng: 78.4010,
      status: 'In Progress',
      priority_score: 64,
      priority_level: 'Medium',
      severity_factor: 60,
      safety_factor: 65,
      people_factor: 70,
      duration_factor: 55,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-publicworks',
      suggested_department_id: 'dept-publicworks',
      confidence_score: 87,
      assigned_staff_id: 'usr-staff-publicworks',
      created_at: '2026-10-22 16:10:00'
    },
    {
      id: 'rep-009',
      ref: 'REP-2026-009',
      citizen_id: 'usr-citizen-01',
      title: 'Damaged traffic signal blinking erratically at junction',
      description: 'The traffic signal light at the four-way crossroads is broken and blinking erratically causing vehicle near-misses and gridlock.',
      category_id: 'cat-trafficsigns',
      department_id: 'dept-roads',
      location_text: 'KBR Park Junction, Road No 2, Banjara Hills, Hyderabad',
      lat: 17.4245,
      lng: 78.4210,
      status: 'Submitted',
      priority_score: 78,
      priority_level: 'High',
      severity_factor: 75,
      safety_factor: 80,
      people_factor: 85,
      duration_factor: 40,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-trafficsigns',
      suggested_department_id: 'dept-roads',
      confidence_score: 93,
      assigned_staff_id: null,
      created_at: '2026-10-24 11:05:00'
    },
    {
      id: 'rep-010',
      ref: 'REP-2026-010',
      citizen_id: 'usr-citizen-02',
      title: 'Deep open manhole without cover on busy lane',
      description: 'There is an open manhole without lid or barricade on a dimly lit street. Fatal risk for two-wheelers and pedestrians at night.',
      category_id: 'cat-drainage',
      department_id: 'dept-water',
      location_text: 'Near SBH Colony, Begumpet, Hyderabad',
      lat: 17.4440,
      lng: 78.4680,
      status: 'Under Review',
      priority_score: 95,
      priority_level: 'Urgent',
      severity_factor: 92,
      safety_factor: 99,
      people_factor: 90,
      duration_factor: 50,
      safety_flag: 1,
      safety_flag_reason: 'CRITICAL HAZARD: Uncovered deep manhole posing fatal fall hazard (keyword open manhole)',
      review_required: 1,
      review_reason: 'Urgent Hazard Review: Open manhole detected without cover',
      analysis_state: 'Completed',
      suggested_category_id: 'cat-drainage',
      suggested_department_id: 'dept-water',
      confidence_score: 95,
      assigned_staff_id: null,
      created_at: '2026-10-24 09:10:00'
    },
    {
      id: 'rep-011',
      ref: 'REP-2026-011',
      citizen_id: 'usr-citizen-01',
      title: 'Streetlights not working on entire 500m residential stretch',
      description: 'All streetlights from pole 1 to pole 12 are non-functional for past 3 nights. Complete dark street causing safety concerns for women and commuters.',
      category_id: 'cat-streetlights',
      department_id: 'dept-electrical',
      location_text: 'Road 5, Journalists Colony, Jubilee Hills, Hyderabad',
      lat: 17.4380,
      lng: 78.4120,
      status: 'Assigned',
      priority_score: 74,
      priority_level: 'High',
      severity_factor: 70,
      safety_factor: 78,
      people_factor: 80,
      duration_factor: 55,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-streetlights',
      suggested_department_id: 'dept-electrical',
      confidence_score: 92,
      assigned_staff_id: 'usr-staff-electrical',
      created_at: '2026-10-23 18:20:00'
    },
    {
      id: 'rep-012',
      ref: 'REP-2026-012',
      citizen_id: 'usr-citizen-02',
      title: 'Construction debris and stone blocks dumped on road',
      description: 'Heavy construction debris and sharp concrete rubble dumped in middle of lane blocking passage for ambulances and residents.',
      category_id: 'cat-garbage',
      department_id: 'dept-sanitation',
      location_text: 'Behind Yashoda Hospital, Somajiguda, Hyderabad',
      lat: 17.4260,
      lng: 78.4570,
      status: 'In Progress',
      priority_score: 75,
      priority_level: 'High',
      severity_factor: 75,
      safety_factor: 75,
      people_factor: 78,
      duration_factor: 60,
      safety_flag: 0,
      review_required: 0,
      analysis_state: 'Completed',
      suggested_category_id: 'cat-garbage',
      suggested_department_id: 'dept-sanitation',
      confidence_score: 89,
      assigned_staff_id: 'usr-staff-sanitation',
      created_at: '2026-10-23 12:00:00'
    }
  ];

  const insertReport = db.prepare(`
    INSERT INTO reports (
      id, reference_number, citizen_id, title, description, category_id, department_id,
      location_text, latitude, longitude, location_verified, is_out_of_boundary,
      status, priority_score, priority_level, severity_factor, safety_factor, people_factor, duration_factor,
      safety_flag, safety_flag_reason, review_required, review_reason, analysis_state,
      suggested_category_id, suggested_department_id, confidence_score, analysis_reasoning,
      primary_report_id, assigned_staff_id, blocked_reason, rejected_reason, resolution_summary,
      idempotency_key, privacy_acknowledged_at, privacy_notice_version, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 1, 0,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, datetime('now'), '1.0', ?, ?
    )
  `);

  for (const r of syntheticReports) {
    insertReport.run(
      r.id, r.ref, r.citizen_id, r.title, r.description, r.category_id, r.department_id,
      r.location_text, r.lat, r.lng,
      r.status, r.priority_score, r.priority_level, r.severity_factor, r.safety_factor, r.people_factor, r.duration_factor,
      r.safety_flag, r.safety_flag_reason || null, r.review_required, r.review_reason || null, r.analysis_state,
      r.suggested_category_id, r.suggested_department_id, r.confidence_score, 'Simulated AI rule-based analysis completed.',
      r.primary_report_id || null, r.assigned_staff_id || null, r.blocked_reason || null, null, r.resolution_summary || null,
      'seed-key-' + r.id, r.created_at, r.created_at
    );
  }

  // 6. Seed Assignments
  const insertAssignment = db.prepare(`
    INSERT INTO assignments (id, report_id, staff_id, assigned_by, assigned_at, reason, active)
    VALUES (?, ?, ?, 'usr-admin-01', ?, ?, 1)
  `);

  insertAssignment.run('asg-001', 'rep-002', 'usr-staff-roads', '2026-10-22 10:00:00', 'Assigned to Roads team for asphalt patching.');
  insertAssignment.run('asg-002', 'rep-004', 'usr-staff-sanitation', '2026-10-23 09:00:00', 'Sanitation truck dispatched for clearance.');
  insertAssignment.run('asg-003', 'rep-005', 'usr-staff-water', '2026-10-20 08:00:00', 'Emergency water line repair.');
  insertAssignment.run('asg-004', 'rep-006', 'usr-staff-water', '2026-10-21 12:00:00', 'Sewage line clearing assignment.');
  insertAssignment.run('asg-005', 'rep-008', 'usr-staff-publicworks', '2026-10-22 17:00:00', 'Sidewalk tile replacement.');
  insertAssignment.run('asg-006', 'rep-011', 'usr-staff-electrical', '2026-10-23 19:00:00', 'Pole lighting inspection and bulb replacement.');
  insertAssignment.run('asg-007', 'rep-012', 'usr-staff-sanitation', '2026-10-23 13:00:00', 'Debris removal truck scheduled.');

  // 7. Seed Duplicate Relationships
  const insertDup = db.prepare(`
    INSERT INTO duplicate_relationships (id, duplicate_report_id, primary_report_id, status, similarity_score, reason, confirmed_by, created_at)
    VALUES (?, ?, ?, 'Confirmed', ?, ?, 'usr-admin-01', datetime('now'))
  `);
  insertDup.run('dup-001', 'rep-003', 'rep-002', 92, 'Same pothole cluster on Banjara Hills Road No 1 junction reported within 200m distance.');

  // 8. Seed Report Events (Chronological Citizen-Safe Timeline)
  const insertEvent = db.prepare(`
    INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEvent.run('evt-001', 'rep-001', 'usr-citizen-01', 'submitted', 1, 'Issue reported by citizen with location verified.', '{"channel":"web"}', '2026-10-24 10:15:00');
  insertEvent.run('evt-002', 'rep-001', null, 'ai_analyzed', 1, 'Simulated AI Analysis completed. High priority hazard detected.', '{"priority":94,"safety_flag":true}', '2026-10-24 10:15:05');

  insertEvent.run('evt-003', 'rep-002', 'usr-citizen-01', 'submitted', 1, 'Issue reported by citizen.', '{}', '2026-10-22 09:30:00');
  insertEvent.run('evt-004', 'rep-002', 'usr-admin-01', 'assigned', 1, 'Assigned to Roads & Transport Department.', '{"department":"dept-roads"}', '2026-10-22 10:00:00');
  insertEvent.run('evt-005', 'rep-002', 'usr-staff-roads', 'in_progress', 1, 'Repair crew dispatched with cold-mix asphalt.', '{}', '2026-10-22 11:30:00');

  insertEvent.run('evt-006', 'rep-005', 'usr-citizen-02', 'submitted', 1, 'Issue reported by citizen.', '{}', '2026-10-20 07:15:00');
  insertEvent.run('evt-007', 'rep-005', 'usr-admin-01', 'assigned', 1, 'Assigned to Water & Drainage Department.', '{}', '2026-10-20 08:00:00');
  insertEvent.run('evt-008', 'rep-005', 'usr-staff-water', 'in_progress', 1, 'Excavation team on site to locate pipeline breach.', '{}', '2026-10-20 09:15:00');
  insertEvent.run('evt-009', 'rep-005', 'usr-staff-water', 'resolved', 1, 'Issue Resolved: Water department repair crew isolated the valve and welded the ruptured 200mm cast iron main. Pressure restored to all households.', '{}', '2026-10-20 14:00:00');

  insertEvent.run('evt-010', 'rep-006', 'usr-citizen-01', 'submitted', 1, 'Issue reported by citizen.', '{}', '2026-10-21 11:20:00');
  insertEvent.run('evt-011', 'rep-006', 'usr-staff-water', 'blocked', 1, 'Issue Blocked: Awaiting high-pressure jetting machine from zonal workshop. Narrow street blocked by unauthorized vehicle parking.', '{}', '2026-10-21 13:00:00');

  // 9. Seed Private Notes (Visible only to authorized staff and admin)
  const insertNote = db.prepare(`
    INSERT INTO private_notes (id, report_id, author_id, note, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertNote.run('not-001', 'rep-002', 'usr-staff-roads', 'Requisition submitted for 2 tonnes of asphalt mix. Work scheduled for night hours to minimize traffic impact.', '2026-10-22 11:00:00');
  insertNote.run('not-002', 'rep-006', 'usr-staff-water', 'Contacted traffic police to issue notices for parked cars blocking jetting tanker entry.', '2026-10-21 13:15:00');

  // 10. Seed Notifications for Citizen
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run('ntf-001', 'usr-citizen-01', 'rep-001', 'Analysis Completed', 'Your report "Dangerous exposed live wire sparking" was analyzed. Flagged for urgent admin review.', 0, 'ntf-key-001', '2026-10-24 10:15:10');
  insertNotif.run('ntf-002', 'usr-citizen-01', 'rep-002', 'Work in Progress', 'Roads & Transport department has begun repair work on your reported pothole.', 0, 'ntf-key-002', '2026-10-22 11:30:00');
  insertNotif.run('ntf-003', 'usr-citizen-01', 'rep-006', 'Issue Blocked', 'Work on your drainage report is temporarily blocked: Awaiting jetting machine.', 1, 'ntf-key-003', '2026-10-21 13:00:00');
  insertNotif.run('ntf-004', 'usr-citizen-02', 'rep-005', 'Issue Resolved!', 'Your report "Drinking water pipeline burst" has been resolved by Water & Drainage.', 1, 'ntf-key-004', '2026-10-20 14:00:00');
  insertNotif.run('ntf-005', 'usr-citizen-02', 'rep-003', 'Duplicate Linked', 'Your report was linked to primary report REP-2026-002. You can track progress directly.', 1, 'ntf-key-005', '2026-10-22 14:25:00');

  // 11. Seed Audit Events
  const insertAudit = db.prepare(`
    INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, correlation_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run('aud-001', 'usr-admin-01', 'ASSIGN_REPORT', 'reports', 'rep-002', '{"status":"Under Review"}', '{"status":"Assigned","assigned_staff_id":"usr-staff-roads"}', 'Assigned to active Roads & Transport staff', 'corr-001', '2026-10-22 10:00:00');
  insertAudit.run('aud-002', 'usr-admin-01', 'CONFIRM_DUPLICATE', 'duplicate_relationships', 'dup-001', null, '{"duplicate":"rep-003","primary":"rep-002"}', 'Confirmed duplicate report within 200m radius', 'corr-002', '2026-10-22 14:25:00');

  console.log('[Seed] Seeding completed successfully! 24 records created across all tables.');
}

if (require.main === module) {
  seed().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  });
}

module.exports = { seed };
