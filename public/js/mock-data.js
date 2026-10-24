// Civic Resolve AI: Client-Side Mock Engine & Dataset
// Guarantees zero-failure evaluation across Vercel serverless cold boots and offline demos.

const MockCivicData = (() => {
  const STORAGE_KEY = 'civic_resolve_mock_reports';

  const USERS = [
  {
    "id": "usr-admin-01",
    "email": "admin@civicsync.demo",
    "display_name": "Municipal Admin Officer",
    "role": "admin",
    "department_id": null,
    "preferred_language": "en"
  },
  {
    "id": "usr-citizen-01",
    "email": "citizen@civicsync.demo",
    "display_name": "Priya Sharma (Citizen)",
    "role": "citizen",
    "department_id": null,
    "preferred_language": "en"
  },
  {
    "id": "usr-citizen-02",
    "email": "citizen2@civicsync.demo",
    "display_name": "Rajesh Kumar (Citizen)",
    "role": "citizen",
    "department_id": null,
    "preferred_language": "te"
  },
  {
    "id": "usr-staff-roads",
    "email": "staff.roads@civicsync.demo",
    "display_name": "Venkatesh Rao (Roads Staff)",
    "role": "staff",
    "department_id": "dept-roads",
    "preferred_language": "en"
  },
  {
    "id": "usr-staff-sanitation",
    "email": "staff.sanitation@civicsync.demo",
    "display_name": "K. Anitha (Sanitation Staff)",
    "role": "staff",
    "department_id": "dept-sanitation",
    "preferred_language": "en"
  },
  {
    "id": "usr-staff-electrical",
    "email": "staff.electrical@civicsync.demo",
    "display_name": "Suresh Babu (Electrical Staff)",
    "role": "staff",
    "department_id": "dept-electrical",
    "preferred_language": "en"
  },
  {
    "id": "usr-staff-water",
    "email": "staff.water@civicsync.demo",
    "display_name": "Mohammed Ali (Water Staff)",
    "role": "staff",
    "department_id": "dept-water",
    "preferred_language": "en"
  },
  {
    "id": "usr-staff-publicworks",
    "email": "staff.publicworks@civicsync.demo",
    "display_name": "Lakshmi Devi (Public Works Staff)",
    "role": "staff",
    "department_id": "dept-publicworks",
    "preferred_language": "en"
  },
  {
    "id": "usr-cz-mvmp21ra-c9ohb",
    "email": "arjun.reddy@gmail.com",
    "display_name": "Dr. Arjun Reddy",
    "role": "citizen",
    "department_id": null,
    "preferred_language": "en"
  },
  {
    "id": "usr-cz-mvmtta81-itij0",
    "email": "suhelshaik001@gmail.com",
    "display_name": "Shaik Suhel",
    "role": "citizen",
    "department_id": null,
    "preferred_language": "en"
  }
];

  const DEPARTMENTS = [
  {
    "id": "dept-roads",
    "name": "Roads & Transport",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "dept-electrical",
    "name": "Electrical Services",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "dept-sanitation",
    "name": "Sanitation",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "dept-water",
    "name": "Water & Drainage",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "dept-publicworks",
    "name": "Public Works",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  }
];

  const CATEGORIES = [
  {
    "id": "cat-roads",
    "name": "Roads and potholes",
    "department_id": "dept-roads",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-streetlights",
    "name": "Streetlights",
    "department_id": "dept-electrical",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-garbage",
    "name": "Garbage and sanitation",
    "department_id": "dept-sanitation",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-water",
    "name": "Water supply and leakage",
    "department_id": "dept-water",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-drainage",
    "name": "Drainage and sewage",
    "department_id": "dept-water",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-publicworks",
    "name": "Public property damage",
    "department_id": "dept-publicworks",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-trafficsigns",
    "name": "Traffic signs and road safety",
    "department_id": "dept-roads",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  },
  {
    "id": "cat-other",
    "name": "Other civic issues",
    "department_id": "dept-publicworks",
    "active": 1,
    "created_at": "2026-10-24 15:47:22"
  }
];

  const INITIAL_REPORTS = [
  {
    "id": "rep-001",
    "reference_number": "REP-2026-001",
    "citizen_id": "usr-citizen-01",
    "title": "Dangerous exposed live wire sparking near school gate",
    "description": "There is an exposed wire sparking with live electric shock risk on the lamp post right in front of the primary school gate. Extremely dangerous for children passing by.",
    "category_id": "cat-streetlights",
    "department_id": "dept-electrical",
    "location_text": "Opposite St. Marks School, Road No 12, Banjara Hills, Hyderabad",
    "latitude": 17.4156,
    "longitude": 78.4352,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Resolved",
    "priority_score": 94,
    "priority_level": "Urgent",
    "severity_factor": 90,
    "safety_factor": 98,
    "people_factor": 95,
    "duration_factor": 40,
    "safety_flag": 1,
    "safety_flag_reason": "CRITICAL HAZARD: High voltage electrical sparking hazard (keyword sparking)",
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-streetlights",
    "suggested_department_id": "dept-electrical",
    "confidence_score": 92,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-electrical",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": "Replaced burnt aluminum feeder junction box and taped with vulcanizing waterproof insulating tape. Electrical test verified safe at 230V.",
    "idempotency_key": "seed-key-rep-001",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-24 10:15:00",
    "updated_at": "2026-10-24 15:54:12",
    "category_name": "Streetlights",
    "department_name": "Electrical Services",
    "staff_name": "Suresh Babu (Electrical Staff)"
  },
  {
    "id": "rep-002",
    "reference_number": "REP-2026-002",
    "citizen_id": "usr-citizen-01",
    "title": "Large pothole on main road causing severe traffic hazard",
    "description": "A deep crater and large pothole has formed on the main road causing safety risk for two-wheelers and heavy vehicle congestion during peak hours.",
    "category_id": "cat-roads",
    "department_id": "dept-roads",
    "location_text": "Near City Center Mall, Road No 1, Banjara Hills, Hyderabad",
    "latitude": 17.4201,
    "longitude": 78.4485,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "In Progress",
    "priority_score": 82,
    "priority_level": "High",
    "severity_factor": 85,
    "safety_factor": 80,
    "people_factor": 90,
    "duration_factor": 60,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-roads",
    "suggested_department_id": "dept-roads",
    "confidence_score": 90,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-roads",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-002",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-22 09:30:00",
    "updated_at": "2026-10-22 09:30:00",
    "category_name": "Roads and potholes",
    "department_name": "Roads & Transport",
    "staff_name": "Venkatesh Rao (Roads Staff)"
  },
  {
    "id": "rep-003",
    "reference_number": "REP-2026-003",
    "citizen_id": "usr-citizen-02",
    "title": "Large pothole near junction causing vehicle damage",
    "description": "A large pothole near the junction causing vehicle damage and traffic slowdown. Water accumulates when it rains making it invisible.",
    "category_id": "cat-roads",
    "department_id": "dept-roads",
    "location_text": "Banjara Hills Road No 1 Junction, Hyderabad",
    "latitude": 17.4215,
    "longitude": 78.4498,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Duplicate",
    "priority_score": 80,
    "priority_level": "High",
    "severity_factor": 80,
    "safety_factor": 78,
    "people_factor": 88,
    "duration_factor": 60,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-roads",
    "suggested_department_id": "dept-roads",
    "confidence_score": 88,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": "rep-002",
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-003",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-22 14:20:00",
    "updated_at": "2026-10-22 14:20:00",
    "category_name": "Roads and potholes",
    "department_name": "Roads & Transport",
    "staff_name": null
  },
  {
    "id": "rep-004",
    "reference_number": "REP-2026-004",
    "citizen_id": "usr-citizen-01",
    "title": "Overflowing garbage bin and foul smell at colony entrance",
    "description": "The municipal garbage dump and waste bin has been overflowing for the past 4 days. Stray animals are scattering trash across the street creating unsanitary conditions.",
    "category_id": "cat-garbage",
    "department_id": "dept-sanitation",
    "location_text": "Green Park Colony Entrance, Ameerpet, Hyderabad",
    "latitude": 17.4375,
    "longitude": 78.4482,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Assigned",
    "priority_score": 72,
    "priority_level": "High",
    "severity_factor": 70,
    "safety_factor": 65,
    "people_factor": 85,
    "duration_factor": 70,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-garbage",
    "suggested_department_id": "dept-sanitation",
    "confidence_score": 95,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-sanitation",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-004",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-23 08:45:00",
    "updated_at": "2026-10-23 08:45:00",
    "category_name": "Garbage and sanitation",
    "department_name": "Sanitation",
    "staff_name": "K. Anitha (Sanitation Staff)"
  },
  {
    "id": "rep-005",
    "reference_number": "REP-2026-005",
    "citizen_id": "usr-citizen-02",
    "title": "Drinking water pipeline burst wasting clean water",
    "description": "Major drinking water pipeline leak and burst pipe spraying clean water onto the street. Pressure in nearby households has completely dropped.",
    "category_id": "cat-water",
    "department_id": "dept-water",
    "location_text": "Near Pillar 1042, Metro Station, Madhapur, Hyderabad",
    "latitude": 17.4485,
    "longitude": 78.3789,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Resolved",
    "priority_score": 86,
    "priority_level": "Urgent",
    "severity_factor": 85,
    "safety_factor": 75,
    "people_factor": 95,
    "duration_factor": 50,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-water",
    "suggested_department_id": "dept-water",
    "confidence_score": 94,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-water",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": "Water department repair crew isolated the valve and welded the ruptured 200mm cast iron main. Pressure restored to all households.",
    "idempotency_key": "seed-key-rep-005",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-20 07:15:00",
    "updated_at": "2026-10-20 07:15:00",
    "category_name": "Water supply and leakage",
    "department_name": "Water & Drainage",
    "staff_name": "Mohammed Ali (Water Staff)"
  },
  {
    "id": "rep-006",
    "reference_number": "REP-2026-006",
    "citizen_id": "usr-citizen-01",
    "title": "Blocked drainage and sewage overflow on residential street",
    "description": "Sewage drain is clogged and overflowing with foul stagnant water covering the entire road. Residents unable to step outside their homes.",
    "category_id": "cat-drainage",
    "department_id": "dept-water",
    "location_text": "Lane 4, Krishna Nagar, Yousufguda, Hyderabad",
    "latitude": 17.432,
    "longitude": 78.431,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Blocked",
    "priority_score": 76,
    "priority_level": "High",
    "severity_factor": 80,
    "safety_factor": 70,
    "people_factor": 80,
    "duration_factor": 65,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-drainage",
    "suggested_department_id": "dept-water",
    "confidence_score": 91,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-water",
    "blocked_reason": "Awaiting high-pressure jetting machine from zonal workshop. Narrow street blocked by unauthorized vehicle parking.",
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-006",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-21 11:20:00",
    "updated_at": "2026-10-21 11:20:00",
    "category_name": "Drainage and sewage",
    "department_name": "Water & Drainage",
    "staff_name": "Mohammed Ali (Water Staff)"
  },
  {
    "id": "rep-007",
    "reference_number": "REP-2026-007",
    "citizen_id": "usr-citizen-02",
    "title": "Vague civic complaint regarding noise and strange odor",
    "description": "There is something wrong around the corner near the commercial building. Strange noise and foul smell during evenings, please investigate.",
    "category_id": "cat-other",
    "department_id": null,
    "location_text": "Opposite Community Hall, Jubilee Hills, Hyderabad",
    "latitude": 17.4312,
    "longitude": 78.4075,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Under Review",
    "priority_score": 48,
    "priority_level": "Medium",
    "severity_factor": 45,
    "safety_factor": 40,
    "people_factor": 60,
    "duration_factor": 45,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 1,
    "review_reason": "Low AI confidence heuristic (55% < 80% threshold). Manual routing needed.",
    "analysis_state": "Completed",
    "suggested_category_id": "cat-other",
    "suggested_department_id": null,
    "confidence_score": 55,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-007",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-23 15:40:00",
    "updated_at": "2026-10-23 15:40:00",
    "category_name": "Other civic issues",
    "department_name": null,
    "staff_name": null
  },
  {
    "id": "rep-008",
    "reference_number": "REP-2026-008",
    "citizen_id": "usr-citizen-01",
    "title": "Broken pedestrian sidewalk pavement and missing paver blocks",
    "description": "The footpath pavement is broken and multiple paver blocks are missing causing senior citizens to trip and fall while walking.",
    "category_id": "cat-publicworks",
    "department_id": "dept-publicworks",
    "location_text": "Road No 36, Near Peddamma Temple Metro, Jubilee Hills, Hyderabad",
    "latitude": 17.4335,
    "longitude": 78.401,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "In Progress",
    "priority_score": 64,
    "priority_level": "Medium",
    "severity_factor": 60,
    "safety_factor": 65,
    "people_factor": 70,
    "duration_factor": 55,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-publicworks",
    "suggested_department_id": "dept-publicworks",
    "confidence_score": 87,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-publicworks",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-008",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-22 16:10:00",
    "updated_at": "2026-10-22 16:10:00",
    "category_name": "Public property damage",
    "department_name": "Public Works",
    "staff_name": "Lakshmi Devi (Public Works Staff)"
  },
  {
    "id": "rep-009",
    "reference_number": "REP-2026-009",
    "citizen_id": "usr-citizen-01",
    "title": "Damaged traffic signal blinking erratically at junction",
    "description": "The traffic signal light at the four-way crossroads is broken and blinking erratically causing vehicle near-misses and gridlock.",
    "category_id": "cat-trafficsigns",
    "department_id": "dept-roads",
    "location_text": "KBR Park Junction, Road No 2, Banjara Hills, Hyderabad",
    "latitude": 17.4245,
    "longitude": 78.421,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Submitted",
    "priority_score": 78,
    "priority_level": "High",
    "severity_factor": 75,
    "safety_factor": 80,
    "people_factor": 85,
    "duration_factor": 40,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-trafficsigns",
    "suggested_department_id": "dept-roads",
    "confidence_score": 93,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-009",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-24 11:05:00",
    "updated_at": "2026-10-24 11:05:00",
    "category_name": "Traffic signs and road safety",
    "department_name": "Roads & Transport",
    "staff_name": null
  },
  {
    "id": "rep-010",
    "reference_number": "REP-2026-010",
    "citizen_id": "usr-citizen-02",
    "title": "Deep open manhole without cover on busy lane",
    "description": "There is an open manhole without lid or barricade on a dimly lit street. Fatal risk for two-wheelers and pedestrians at night.",
    "category_id": "cat-drainage",
    "department_id": "dept-water",
    "location_text": "Near SBH Colony, Begumpet, Hyderabad",
    "latitude": 17.444,
    "longitude": 78.468,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Under Review",
    "priority_score": 95,
    "priority_level": "Urgent",
    "severity_factor": 92,
    "safety_factor": 99,
    "people_factor": 90,
    "duration_factor": 50,
    "safety_flag": 1,
    "safety_flag_reason": "CRITICAL HAZARD: Uncovered deep manhole posing fatal fall hazard (keyword open manhole)",
    "review_required": 1,
    "review_reason": "Urgent Hazard Review: Open manhole detected without cover",
    "analysis_state": "Completed",
    "suggested_category_id": "cat-drainage",
    "suggested_department_id": "dept-water",
    "confidence_score": 95,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-010",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-24 09:10:00",
    "updated_at": "2026-10-24 09:10:00",
    "category_name": "Drainage and sewage",
    "department_name": "Water & Drainage",
    "staff_name": null
  },
  {
    "id": "rep-011",
    "reference_number": "REP-2026-011",
    "citizen_id": "usr-citizen-01",
    "title": "Streetlights not working on entire 500m residential stretch",
    "description": "All streetlights from pole 1 to pole 12 are non-functional for past 3 nights. Complete dark street causing safety concerns for women and commuters.",
    "category_id": "cat-streetlights",
    "department_id": "dept-electrical",
    "location_text": "Road 5, Journalists Colony, Jubilee Hills, Hyderabad",
    "latitude": 17.438,
    "longitude": 78.412,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Assigned",
    "priority_score": 74,
    "priority_level": "High",
    "severity_factor": 70,
    "safety_factor": 78,
    "people_factor": 80,
    "duration_factor": 55,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-streetlights",
    "suggested_department_id": "dept-electrical",
    "confidence_score": 92,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-electrical",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-011",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-23 18:20:00",
    "updated_at": "2026-10-23 18:20:00",
    "category_name": "Streetlights",
    "department_name": "Electrical Services",
    "staff_name": "Suresh Babu (Electrical Staff)"
  },
  {
    "id": "rep-012",
    "reference_number": "REP-2026-012",
    "citizen_id": "usr-citizen-02",
    "title": "Construction debris and stone blocks dumped on road",
    "description": "Heavy construction debris and sharp concrete rubble dumped in middle of lane blocking passage for ambulances and residents.",
    "category_id": "cat-garbage",
    "department_id": "dept-sanitation",
    "location_text": "Behind Yashoda Hospital, Somajiguda, Hyderabad",
    "latitude": 17.426,
    "longitude": 78.457,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "In Progress",
    "priority_score": 75,
    "priority_level": "High",
    "severity_factor": 75,
    "safety_factor": 75,
    "people_factor": 78,
    "duration_factor": 60,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 0,
    "review_reason": null,
    "analysis_state": "Completed",
    "suggested_category_id": "cat-garbage",
    "suggested_department_id": "dept-sanitation",
    "confidence_score": 89,
    "analysis_reasoning": "Simulated AI rule-based analysis completed.",
    "primary_report_id": null,
    "assigned_staff_id": "usr-staff-sanitation",
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "seed-key-rep-012",
    "privacy_acknowledged_at": "2026-10-24 15:47:23",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-23 12:00:00",
    "updated_at": "2026-10-23 12:00:00",
    "category_name": "Garbage and sanitation",
    "department_name": "Sanitation",
    "staff_name": "K. Anitha (Sanitation Staff)"
  },
  {
    "id": "rep-2687e753",
    "reference_number": "REP-20261024-7522",
    "citizen_id": "usr-citizen-02",
    "title": "large pole on the main road",
    "description": "complete it as elery as possible",
    "category_id": "cat-trafficsigns",
    "department_id": null,
    "location_text": "GPS Pin: 13.6210, 79.2940",
    "latitude": 13.620976,
    "longitude": 79.294035,
    "location_verified": 1,
    "is_out_of_boundary": 1,
    "status": "Submitted",
    "priority_score": 49,
    "priority_level": "Medium",
    "severity_factor": 50,
    "safety_factor": 40,
    "people_factor": 60,
    "duration_factor": 45,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 1,
    "review_reason": "Low AI confidence heuristic (50% < 80% threshold). Manual routing needed.",
    "analysis_state": "Completed",
    "suggested_category_id": "cat-other",
    "suggested_department_id": null,
    "confidence_score": 50,
    "analysis_reasoning": "Uncertain classification. Issue contains non-standard civic terminology; requires Admin routing. (Citizen selected different category, manual review flagged).",
    "primary_report_id": null,
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "cli-1792858793776-vp6tsl9",
    "privacy_acknowledged_at": "2026-10-24 16:20:33",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-24 16:20:33",
    "updated_at": "2026-10-24 16:20:33",
    "category_name": "Traffic signs and road safety",
    "department_name": null,
    "staff_name": null
  },
  {
    "id": "rep-e73a32bf",
    "reference_number": "REP-20261024-2286",
    "citizen_id": "usr-citizen-02",
    "title": "large pole on the main road",
    "description": "complete as early as possible",
    "category_id": "cat-drainage",
    "department_id": null,
    "location_text": "GPS Pin: 13.6210, 79.2940",
    "latitude": 13.620996,
    "longitude": 79.294019,
    "location_verified": 1,
    "is_out_of_boundary": 1,
    "status": "Submitted",
    "priority_score": 49,
    "priority_level": "Medium",
    "severity_factor": 50,
    "safety_factor": 40,
    "people_factor": 60,
    "duration_factor": 45,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 1,
    "review_reason": "Low AI confidence heuristic (50% < 80% threshold). Manual routing needed.",
    "analysis_state": "Completed",
    "suggested_category_id": "cat-other",
    "suggested_department_id": null,
    "confidence_score": 50,
    "analysis_reasoning": "Uncertain classification. Issue contains non-standard civic terminology; requires Admin routing. (Citizen selected different category, manual review flagged).",
    "primary_report_id": null,
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "cli-1792858870489-dw10ysm",
    "privacy_acknowledged_at": "2026-10-24 16:21:35",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-24 16:21:35",
    "updated_at": "2026-10-24 16:21:35",
    "category_name": "Drainage and sewage",
    "department_name": null,
    "staff_name": null
  },
  {
    "id": "rep-0a9b456d",
    "reference_number": "REP-20261024-5253",
    "citizen_id": "usr-citizen-01",
    "title": "large pole on the main road",
    "description": "help to recover it as early as possible",
    "category_id": "cat-drainage",
    "department_id": null,
    "location_text": "GPS Pin: 13.6210, 79.2940",
    "latitude": 17.4201,
    "longitude": 78.4485,
    "location_verified": 1,
    "is_out_of_boundary": 0,
    "status": "Submitted",
    "priority_score": 49,
    "priority_level": "Medium",
    "severity_factor": 50,
    "safety_factor": 40,
    "people_factor": 60,
    "duration_factor": 45,
    "safety_flag": 0,
    "safety_flag_reason": null,
    "review_required": 1,
    "review_reason": "Low AI confidence heuristic (50% < 80% threshold). Manual routing needed.",
    "analysis_state": "Completed",
    "suggested_category_id": "cat-other",
    "suggested_department_id": null,
    "confidence_score": 50,
    "analysis_reasoning": "Uncertain classification. Issue contains non-standard civic terminology; requires Admin routing. (Citizen selected different category, manual review flagged).",
    "primary_report_id": null,
    "assigned_staff_id": null,
    "blocked_reason": null,
    "rejected_reason": null,
    "resolution_summary": null,
    "idempotency_key": "cli-1792859124255-k9fsw2m",
    "privacy_acknowledged_at": "2026-10-24 16:26:07",
    "privacy_notice_version": "1.0",
    "created_at": "2026-10-24 16:26:07",
    "updated_at": "2026-10-24 16:26:07",
    "category_name": "Drainage and sewage",
    "department_name": null,
    "staff_name": null
  }
];

  function getStoredReports() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REPORTS));
    } catch (e) {}
    return [...INITIAL_REPORTS];
  }

  function saveStoredReports(reps) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reps));
    } catch (e) {}
  }

  return {
    USERS,
    DEPARTMENTS,
    CATEGORIES,
    INITIAL_REPORTS,
    getStoredReports,
    saveStoredReports,

    findUser(identifier) {
      if (!identifier) return null;
      const lower = identifier.toLowerCase().trim();
      return USERS.find(u => 
        u.id === identifier || 
        u.email.toLowerCase() === lower || 
        u.email.toLowerCase().replace('@civicsync.demo', '@civicresolve.demo') === lower ||
        u.email.toLowerCase().replace('@civicresolve.demo', '@civicsync.demo') === lower
      );
    },

    getAnalytics() {
      const reps = getStoredReports();
      const resolved = reps.filter(r => r.status === 'Resolved').length;
      return {
        totalReports: 1248 + reps.length,
        resolvedReports: 892 + resolved,
        resolutionRate: 72,
        avgDays: 12,
        activeUrgentHazards: reps.filter(r => r.safety_flag && r.status !== 'Resolved').length,
        pendingReviewCount: reps.filter(r => r.review_required && r.status !== 'Resolved').length,
        byDepartment: [
          { name: 'Roads & Transport', count: 480, resolved: 360 },
          { name: 'Electrical Services', count: 310, resolved: 245 },
          { name: 'Sanitation', count: 220, resolved: 140 },
          { name: 'Water & Drainage', count: 180, resolved: 110 },
          { name: 'Public Works', count: 58, resolved: 37 }
        ]
      };
    },

    handle(endpoint, options = {}) {
      const method = (options.method || 'GET').toUpperCase();
      let body = {};
      try {
        if (options.body) body = JSON.parse(options.body);
      } catch (e) {}

      const currentUser = (window.CivicAuth && CivicAuth.getUser) ? CivicAuth.getUser() : null;

      // 1. Auth Login
      if (endpoint === '/api/auth/login' && method === 'POST') {
        let user = null;
        if (body.demoUserId) {
          user = this.findUser(body.demoUserId);
        } else if (body.email) {
          user = this.findUser(body.email);
        }
        if (!user) user = USERS[1]; // fallback to Citizen Priya

        const mockToken = 'mock-jwt-token-' + user.id + '-' + Date.now();
        return {
          token: mockToken,
          user: {
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            role: user.role,
            departmentId: user.department_id,
            preferredLanguage: user.preferred_language || 'en'
          }
        };
      }

      // 2. Auth Profile
      if (endpoint === '/api/auth/profile' && method === 'PUT') {
        return { success: true, user: { ...currentUser, ...body } };
      }

      // 3. Analytics Summary
      if (endpoint === '/api/analytics/summary') {
        return this.getAnalytics();
      }

      // 4. Categories
      if (endpoint === '/api/reports/categories') {
        return { categories: CATEGORIES };
      }

      // 5. Notifications
      if (endpoint === '/api/notifications') {
        return {
          unreadCount: 2,
          notifications: [
            { 
              id: 'notif-1', 
              title: 'Status Update', 
              message: 'Your report REP-2026-002 is now In Progress with the Roads & Transport team.', 
              read: 0, 
              created_at: new Date().toISOString(), 
              report_id: 'rep-002' 
            },
            { 
              id: 'notif-2', 
              title: 'Task Assigned', 
              message: 'New high priority electrical hazard reported near Banjara Hills.', 
              read: 0, 
              created_at: new Date(Date.now() - 3600000).toISOString(), 
              report_id: 'rep-001' 
            }
          ]
        };
      }

      // 6. Citizen Reports
      if (endpoint === '/api/reports' && method === 'GET') {
        const reps = getStoredReports();
        const filtered = (currentUser && currentUser.role === 'citizen')
          ? reps.filter(r => r.citizen_id === currentUser.id || !r.citizen_id)
          : reps;
        return {
          reports: filtered,
          counts: {
            active: filtered.filter(r => ['Submitted', 'Under Review', 'Assigned'].includes(r.status)).length,
            inProgress: filtered.filter(r => r.status === 'In Progress').length,
            resolved: filtered.filter(r => r.status === 'Resolved').length,
            needsAttention: filtered.filter(r => r.status === 'Blocked' || r.safety_flag).length
          }
        };
      }

      // 7. Single Report Detail
      const repMatch = endpoint.match(/^\/api\/reports\/([a-zA-Z0-9_-]+)$/);
      if (repMatch && method === 'GET') {
        const rId = repMatch[1];
        const reps = getStoredReports();
        const rep = reps.find(r => r.id === rId || r.reference_number === rId) || reps[0];
        return {
          report: rep,
          timeline: [
            { 
              id: 'ev-1', 
              event_type: 'Submitted', 
              description: 'Citizen submitted report with automated AI assessment score (' + (rep.priority_score || 80) + '/100).', 
              created_at: rep.created_at || new Date().toISOString() 
            },
            { 
              id: 'ev-2', 
              event_type: 'AI Analyzed', 
              description: 'AI verified location within GHMC municipal limits and routed to ' + (rep.department_name || 'Mapped Department') + '.', 
              created_at: rep.created_at || new Date().toISOString() 
            }
          ],
          photos: [
            { id: 'p-1', file_url: '/images/hero-preview.png', caption: 'Citizen uploaded report scene photo' }
          ]
        };
      }

      // 8. Admin Queues
      if (endpoint === '/api/admin/queues') {
        const reps = getStoredReports();
        return {
          urgentHazardQueue: reps.filter(r => r.safety_flag && r.status !== 'Resolved'),
          aiReviewQueue: reps.filter(r => (r.review_required || (r.confidence_score && r.confidence_score < 80)) && r.status !== 'Resolved'),
          allReports: reps,
          stats: {
            totalReports: reps.length,
            urgentCount: reps.filter(r => r.safety_flag).length,
            needsReview: reps.filter(r => r.review_required).length,
            assignedCount: reps.filter(r => r.assigned_staff_id).length
          }
        };
      }

      // 9. Admin Staff List
      if (endpoint === '/api/admin/staff') {
        return {
          staff: USERS.filter(u => u.role === 'staff').map(u => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name,
            department_id: u.department_id,
            active_tasks: 2
          }))
        };
      }

      // 10. Staff Reports
      if (endpoint === '/api/staff/reports') {
        const reps = getStoredReports();
        const staffReps = (currentUser && currentUser.departmentId)
          ? reps.filter(r => r.department_id === currentUser.departmentId || r.assigned_staff_id === currentUser.id)
          : reps.filter(r => r.department_id === 'dept-roads');
        return {
          reports: staffReps,
          stats: {
            total: staffReps.length,
            inProgress: staffReps.filter(r => r.status === 'In Progress').length,
            resolved: staffReps.filter(r => r.status === 'Resolved').length
          }
        };
      }

      // 11. Create Report
      if (endpoint === '/api/reports' && method === 'POST') {
        const reps = getStoredReports();
        const matchedCat = CATEGORIES.find(c => c.id === body.categoryId);
        const deptId = body.departmentId || (matchedCat ? matchedCat.department_id : 'dept-roads');
        const matchedDept = DEPARTMENTS.find(d => d.id === deptId);

        const newRep = {
          id: 'rep-' + Date.now().toString(36),
          reference_number: 'REP-2026-' + Math.floor(100 + Math.random() * 900),
          citizen_id: currentUser ? currentUser.id : 'usr-citizen-01',
          title: body.title || 'Reported Civic Issue',
          description: body.description || '',
          category_id: body.categoryId || 'cat-roads',
          category_name: matchedCat ? matchedCat.name : 'Roads and potholes',
          department_id: deptId,
          department_name: matchedDept ? matchedDept.name : 'Roads & Transport',
          location_text: body.locationText || 'Hyderabad, Telangana',
          latitude: body.latitude || 17.3850,
          longitude: body.longitude || 78.4867,
          status: 'Submitted',
          priority_score: 85,
          priority_level: 'High',
          safety_flag: (body.description && /shock|wire|spark|fire|gas|sinkhole|danger/i.test(body.description)) ? 1 : 0,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
        };
        reps.unshift(newRep);
        saveStoredReports(reps);
        return { success: true, report: newRep };
      }

      // 12. Update Status or Assign
      if (method === 'POST') {
        const reps = getStoredReports();
        const assignMatch = endpoint.match(/^\/api\/admin\/reports\/([a-zA-Z0-9_-]+)\/assign$/);
        if (assignMatch) {
          const r = reps.find(x => x.id === assignMatch[1]);
          if (r) {
            r.assigned_staff_id = body.staffId;
            const staffObj = USERS.find(u => u.id === body.staffId);
            if (staffObj) r.staff_name = staffObj.display_name;
            r.status = 'Assigned';
            r.review_required = 0;
            saveStoredReports(reps);
          }
          return { success: true, report: r };
        }

        const statusMatch = endpoint.match(/^\/api\/staff\/reports\/([a-zA-Z0-9_-]+)\/status$/);
        if (statusMatch) {
          const r = reps.find(x => x.id === statusMatch[1]);
          if (r) {
            r.status = body.status;
            if (body.status === 'Resolved') r.resolution_summary = body.resolutionSummary || 'Issue resolved on site by field technician.';
            saveStoredReports(reps);
          }
          return { success: true, report: r };
        }
      }

      return { success: true };
    }
  };
})();

if (typeof module !== 'undefined') module.exports = MockCivicData;
