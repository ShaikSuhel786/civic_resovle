// Civic Resolve AI: Maintenance Schedules Schema Migration & Initial Staff Assignment
const dbHelper = require('../server/db');
const db = dbHelper.db;

try {
  db.exec('ALTER TABLE maintenance_schedules ADD COLUMN assigned_staff_id TEXT;');
  console.log('Added column assigned_staff_id');
} catch (e) {
  console.log('assigned_staff_id column check:', e.message);
}

try {
  db.exec('ALTER TABLE maintenance_schedules ADD COLUMN assigned_staff_name TEXT;');
  console.log('Added column assigned_staff_name');
} catch (e) {
  console.log('assigned_staff_name column check:', e.message);
}

const updates = [
  { deptId: 'dept-water', staffId: 'usr-staff-water', staffName: 'Mohammed Ali (Water Staff)', filter: '%Water%' },
  { deptId: 'dept-roads', staffId: 'usr-staff-roads', staffName: 'Venkatesh Rao (Roads Staff)', filter: '%Road%' },
  { deptId: 'dept-electrical', staffId: 'usr-staff-electrical', staffName: 'Suresh Babu (Electrical Staff)', filter: '%Electric%' },
  { deptId: 'dept-sanitation', staffId: 'usr-staff-sanitation', staffName: 'K. Anitha (Sanitation Staff)', filter: '%Sanitation%' },
  { deptId: 'dept-publicworks', staffId: 'usr-staff-publicworks', staffName: 'Lakshmi Devi (Public Works Staff)', filter: '%Public Works%' }
];

for (const u of updates) {
  dbHelper.run(
    'UPDATE maintenance_schedules SET department_id = ?, assigned_staff_id = ?, assigned_staff_name = ? WHERE (department_id IS NULL OR assigned_staff_id IS NULL) AND department_name LIKE ?',
    [u.deptId, u.staffId, u.staffName, u.filter]
  );
}

console.log('Migration completed successfully.');
const rows = dbHelper.all('SELECT id, title, department_name, assigned_staff_id, assigned_staff_name, status FROM maintenance_schedules');
console.log(JSON.stringify(rows, null, 2));
