-- Civic Resolve AI: Deterministic PostgreSQL Seed Data for Supabase
-- Can be executed directly in Supabase SQL Editor

-- 1. Departments
INSERT INTO departments (id, name, active) VALUES
('dept-roads', 'Roads & Transport', true),
('dept-electrical', 'Electrical Services', true),
('dept-sanitation', 'Sanitation', true),
('dept-water', 'Water & Drainage', true),
('dept-publicworks', 'Public Works', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Categories
INSERT INTO categories (id, name, department_id, active) VALUES
('cat-roads', 'Roads and potholes', 'dept-roads', true),
('cat-streetlights', 'Streetlights', 'dept-electrical', true),
('cat-garbage', 'Garbage and sanitation', 'dept-sanitation', true),
('cat-water', 'Water supply and leakage', 'dept-water', true),
('cat-drainage', 'Drainage and sewage', 'dept-water', true),
('cat-publicworks', 'Public property damage', 'dept-publicworks', true),
('cat-trafficsigns', 'Traffic signs and road safety', 'dept-roads', true),
('cat-other', 'Other civic issues', 'dept-publicworks', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Profiles (Demo users)
-- bcrypt hash for 'DemoAdmin123!': $2a$10$wEkgm3mP.3lK.9g6rQ...
INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash) VALUES
('usr-admin-01', 'admin@civicsync.demo', 'Municipal Admin Officer', 'admin', null, true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-citizen-01', 'citizen@civicsync.demo', 'Priya Sharma (Citizen)', 'citizen', null, true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-citizen-02', 'citizen2@civicsync.demo', 'Rajesh Kumar (Citizen)', 'citizen', null, true, 'te', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-staff-roads', 'staff.roads@civicsync.demo', 'Venkatesh Rao (Roads Staff)', 'staff', 'dept-roads', true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-staff-sanitation', 'staff.sanitation@civicsync.demo', 'K. Anitha (Sanitation Staff)', 'staff', 'dept-sanitation', true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-staff-electrical', 'staff.electrical@civicsync.demo', 'Suresh Babu (Electrical Staff)', 'staff', 'dept-electrical', true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-staff-water', 'staff.water@civicsync.demo', 'Mohammed Ali (Water Staff)', 'staff', 'dept-water', true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C'),
('usr-staff-publicworks', 'staff.publicworks@civicsync.demo', 'Lakshmi Devi (Public Works Staff)', 'staff', 'dept-publicworks', true, 'en', '$2a$10$wR.l0b2zUeWl1n7NlA7hEuN71c7N.g9Y5jP0K0rE8Yx1J.Z0qM.1C')
ON CONFLICT (id) DO NOTHING;

-- 4. Synthetic Reports
INSERT INTO reports (
    id, reference_number, citizen_id, title, description, category_id, department_id,
    location_text, latitude, longitude, location_verified, is_out_of_boundary,
    status, priority_score, priority_level, severity_factor, safety_factor, people_factor, duration_factor,
    safety_flag, safety_flag_reason, review_required, review_reason, analysis_state,
    suggested_category_id, suggested_department_id, confidence_score, analysis_reasoning,
    primary_report_id, assigned_staff_id, blocked_reason, resolution_summary, idempotency_key
) VALUES
('rep-001', 'REP-2026-001', 'usr-citizen-01', 'Dangerous exposed live wire sparking near school gate', 'There is an exposed wire sparking with live electric shock risk on the lamp post right in front of the primary school gate. Extremely dangerous for children passing by.', 'cat-streetlights', 'dept-electrical', 'Opposite St. Marks School, Road No 12, Banjara Hills, Hyderabad', 17.4156, 78.4352, true, false, 'Submitted', 94, 'Urgent', 90, 98, 95, 40, true, 'CRITICAL HAZARD: High voltage electrical sparking hazard', true, 'Urgent Hazard Review: Sparking electrical hazard near school', 'Completed', 'cat-streetlights', 'dept-electrical', 92, 'Strong keyword match', null, null, null, null, 'seed-key-rep-001'),
('rep-002', 'REP-2026-002', 'usr-citizen-01', 'Large pothole on main road causing severe traffic hazard', 'A deep crater and large pothole has formed on the main road causing safety risk for two-wheelers and heavy vehicle congestion during peak hours.', 'cat-roads', 'dept-roads', 'Near City Center Mall, Road No 1, Banjara Hills, Hyderabad', 17.4201, 78.4485, true, false, 'In Progress', 82, 'High', 85, 80, 90, 60, false, null, false, null, 'Completed', 'cat-roads', 'dept-roads', 90, 'Keyword match for road damage', null, 'usr-staff-roads', null, null, 'seed-key-rep-002'),
('rep-003', 'REP-2026-003', 'usr-citizen-02', 'Large pothole near junction causing vehicle damage', 'A large pothole near the junction causing vehicle damage and traffic slowdown. Water accumulates when it rains making it invisible.', 'cat-roads', 'dept-roads', 'Banjara Hills Road No 1 Junction, Hyderabad', 17.4215, 78.4498, true, false, 'Duplicate', 80, 'High', 80, 78, 88, 60, false, null, false, null, 'Completed', 'cat-roads', 'dept-roads', 88, 'Keyword match for road damage', 'rep-002', null, null, null, 'seed-key-rep-003'),
('rep-004', 'REP-2026-004', 'usr-citizen-01', 'Overflowing garbage bin and foul smell at colony entrance', 'The municipal garbage dump and waste bin has been overflowing for the past 4 days. Stray animals are scattering trash across the street creating unsanitary conditions.', 'cat-garbage', 'dept-sanitation', 'Green Park Colony Entrance, Ameerpet, Hyderabad', 17.4375, 78.4482, true, false, 'Assigned', 72, 'High', 70, 65, 85, 70, false, null, false, null, 'Completed', 'cat-garbage', 'dept-sanitation', 95, 'High sanitation keywords', null, 'usr-staff-sanitation', null, null, 'seed-key-rep-004'),
('rep-005', 'REP-2026-005', 'usr-citizen-02', 'Drinking water pipeline burst wasting clean water', 'Major drinking water pipeline leak and burst pipe spraying clean water onto the street. Pressure in nearby households has completely dropped.', 'cat-water', 'dept-water', 'Near Pillar 1042, Metro Station, Madhapur, Hyderabad', 17.4485, 78.3789, true, false, 'Resolved', 86, 'Urgent', 85, 75, 95, 50, false, null, false, null, 'Completed', 'cat-water', 'dept-water', 94, 'Water leakage keywords', null, 'usr-staff-water', null, 'Water department repair crew isolated the valve and welded the ruptured 200mm cast iron main. Pressure restored to all households.', 'seed-key-rep-005'),
('rep-006', 'REP-2026-006', 'usr-citizen-01', 'Blocked drainage and sewage overflow on residential street', 'Sewage drain is clogged and overflowing with foul stagnant water covering the entire road. Residents unable to step outside their homes.', 'cat-drainage', 'dept-water', 'Lane 4, Krishna Nagar, Yousufguda, Hyderabad', 17.4320, 78.4310, true, false, 'Blocked', 76, 'High', 80, 70, 80, 65, false, null, false, null, 'Completed', 'cat-drainage', 'dept-water', 91, 'Sewage drain keywords', null, 'usr-staff-water', 'Awaiting high-pressure jetting machine from zonal workshop. Narrow street blocked by unauthorized vehicle parking.', null, 'seed-key-rep-006')
ON CONFLICT (id) DO NOTHING;
