// Civic Resolve AI: Production PostgreSQL Migration Utility
// Safely and non-destructively provisions all 17 production tables, foreign keys, indexes,
// and migrates data from local SQLite/seed files into PostgreSQL (Supabase).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigration() {
  const databaseUrl = (
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.SUPABASE_DB_URL || 
    ''
  ).trim();

  console.log('====================================================');
  console.log('  CIVIC RESOLVE AI — PRODUCTION POSTGRES MIGRATION');
  console.log('====================================================\n');

  if (!databaseUrl || databaseUrl.includes('[YOUR-PASSWORD]') || databaseUrl.includes('your-project-id')) {
    console.error('❌ [FATAL CONFIGURATION ERROR]');
    console.error('   DATABASE_URL or POSTGRES_URL environment variable is missing or contains placeholder text.');
    console.error('\nTo run this migration against your Supabase project:');
    console.error('1. Open your Supabase Dashboard: https://supabase.com/dashboard');
    console.error('2. Navigate to: Project Settings -> Database -> Connection string -> URI');
    console.error('3. Set DATABASE_URL in your .env file:');
    console.error('   DATABASE_URL=postgresql://postgres.[REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
    console.error('4. Re-run: node scripts/migrate_to_postgres.js\n');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1'))
      ? false
      : { rejectUnauthorized: false }
  });

  try {
    console.log('[1/4] Connecting to PostgreSQL database...');
    await client.connect();
    console.log('      ✓ Connected successfully to target PostgreSQL instance.');

    console.log('\n[2/4] Applying production schema (all 17 tables, indexes, constraints, RLS)...');
    const schemaSqlPath = path.join(__dirname, '..', 'server', 'db', 'postgres_schema.sql');
    if (!fs.existsSync(schemaSqlPath)) {
      throw new Error(`Schema file not found at: ${schemaSqlPath}`);
    }
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    await client.query(schemaSql);
    console.log('      ✓ Schema and RLS policies verified/created successfully.');

    console.log('\n[3/4] Preparing migration dataset...');
    let sourceData = {
      departments: [],
      categories: [],
      profiles: [],
      reports: [],
      maintenance: [],
      knowledge: []
    };

    // Check if local SQLite database exists for existing operational data
    const sqlitePath = path.join(__dirname, '..', 'server', 'data', 'civic_resolve.db');
    let usingSqlite = false;
    if (fs.existsSync(sqlitePath)) {
      try {
        const Database = require('better-sqlite3');
        const sdb = new Database(sqlitePath, { readonly: true });
        sourceData.departments = sdb.prepare('SELECT * FROM departments').all();
        sourceData.categories = sdb.prepare('SELECT * FROM categories').all();
        sourceData.profiles = sdb.prepare('SELECT * FROM profiles').all();
        sourceData.reports = sdb.prepare('SELECT * FROM reports').all();
        try { sourceData.maintenance = sdb.prepare('SELECT * FROM maintenance_schedules').all(); } catch (_) {}
        try { sourceData.knowledge = sdb.prepare('SELECT * FROM knowledge_articles').all(); } catch (_) {}
        sdb.close();
        usingSqlite = true;
        console.log(`      ✓ Loaded ${sourceData.reports.length} reports and ${sourceData.profiles.length} profiles from local SQLite.`);
      } catch (e) {
        console.warn('      Notice: Could not read local SQLite, falling back to seed-data.json:', e.message);
      }
    }

    if (!usingSqlite || sourceData.profiles.length === 0) {
      const seedJsonPath = path.join(__dirname, '..', 'server', 'db', 'seed-data.json');
      if (fs.existsSync(seedJsonPath)) {
        const seedData = JSON.parse(fs.readFileSync(seedJsonPath, 'utf8'));
        sourceData.departments = seedData.departments || [];
        sourceData.categories = seedData.categories || [];
        sourceData.profiles = seedData.profiles || [];
        sourceData.reports = seedData.reports || [];
        console.log(`      ✓ Loaded ${sourceData.reports.length} reports from seed-data.json.`);
      }
    }

    console.log('\n[4/4] Migrating records safely (Non-destructive: ON CONFLICT DO NOTHING)...');

    // 1. Departments
    let deptsMigrated = 0;
    for (const d of sourceData.departments) {
      const res = await client.query(`
        INSERT INTO departments (id, name, active)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `, [d.id, d.name, Boolean(d.active)]);
      if (res.rowCount > 0) deptsMigrated++;
    }
    console.log(`      • Departments: ${sourceData.departments.length} scanned, ${deptsMigrated} inserted.`);

    // 2. Categories
    let catsMigrated = 0;
    for (const c of sourceData.categories) {
      const res = await client.query(`
        INSERT INTO categories (id, name, department_id, active)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [c.id, c.name, c.department_id, Boolean(c.active)]);
      if (res.rowCount > 0) catsMigrated++;
    }
    console.log(`      • Categories: ${sourceData.categories.length} scanned, ${catsMigrated} inserted.`);

    // 3. Profiles
    let profsMigrated = 0;
    for (const p of sourceData.profiles) {
      const res = await client.query(`
        INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [p.id, p.email, p.display_name, p.role, p.department_id || null, Boolean(p.active), p.preferred_language || 'en', p.password_hash || null, p.phone || null]);
      if (res.rowCount > 0) profsMigrated++;
    }
    console.log(`      • Profiles: ${sourceData.profiles.length} scanned, ${profsMigrated} inserted.`);

    // 4. Reports
    let repsMigrated = 0;
    for (const r of sourceData.reports) {
      const res = await client.query(`
        INSERT INTO reports (
          id, reference_number, citizen_id, title, description, category_id, department_id,
          location_text, latitude, longitude, location_verified, is_out_of_boundary,
          status, priority_score, priority_level, severity_factor, safety_factor, people_factor, duration_factor,
          safety_flag, safety_flag_reason, review_required, review_reason, analysis_state,
          suggested_category_id, suggested_department_id, confidence_score, analysis_reasoning,
          primary_report_id, assigned_staff_id, blocked_reason, rejected_reason, resolution_summary,
          idempotency_key, community_votes, sla_deadline, escalation_level, last_escalated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27, $28,
          $29, $30, $31, $32, $33,
          $34, $35, $36, $37, $38
        ) ON CONFLICT (id) DO NOTHING
      `, [
        r.id, r.reference_number, r.citizen_id, r.title, r.description, r.category_id || null, r.department_id || null,
        r.location_text, r.latitude || null, r.longitude || null, Boolean(r.location_verified ?? true), Boolean(r.is_out_of_boundary ?? false),
        r.status || 'Submitted', r.priority_score || 0, r.priority_level || 'Medium', r.severity_factor || 50, r.safety_factor || 50, r.people_factor || 50, r.duration_factor || 50,
        Boolean(r.safety_flag ?? false), r.safety_flag_reason || null, Boolean(r.review_required ?? false), r.review_reason || null, r.analysis_state || 'Completed',
        r.suggested_category_id || null, r.suggested_department_id || null, r.confidence_score || 0, r.analysis_reasoning || null,
        r.primary_report_id || null, r.assigned_staff_id || null, r.blocked_reason || null, r.rejected_reason || null, r.resolution_summary || null,
        r.idempotency_key || null, r.community_votes || 0, r.sla_deadline || null, r.escalation_level || 0, r.last_escalated_at || null
      ]);
      if (res.rowCount > 0) repsMigrated++;
    }
    console.log(`      • Reports: ${sourceData.reports.length} scanned, ${repsMigrated} inserted.`);

    console.log('\n====================================================');
    console.log('🎉 Production PostgreSQL Migration Completed Successfully!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\n❌ Migration failed with error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };

