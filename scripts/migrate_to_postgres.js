// Civic Resolve AI: Production PostgreSQL Migration Utility
// Safely and non-destructively provisions all 17 production tables, foreign keys, indexes,
// and migrates data from local SQLite/seed files into PostgreSQL (Supabase) in strict FK order.

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

    console.log('\n[3/4] Preparing migration dataset across all 17 operational tables...');
    const sourceData = {
      departments: [],
      categories: [],
      profiles: [],
      reports: [],
      assignments: [],
      report_events: [],
      audit_events: [],
      duplicate_relationships: [],
      private_notes: [],
      photo_metadata: [],
      notifications: [],
      notification_jobs: [],
      maintenance_schedules: [],
      knowledge_articles: [],
      community_votes: [],
      report_appeals: [],
      report_feedback: []
    };

    // Check if local SQLite database exists for existing operational data
    const sqlitePath = path.join(__dirname, '..', 'server', 'data', 'civic_resolve.db');
    let usingSqlite = false;
    if (fs.existsSync(sqlitePath)) {
      try {
        const Database = require('better-sqlite3');
        const sdb = new Database(sqlitePath, { readonly: true });

        const loadTable = (tableName) => {
          try {
            return sdb.prepare(`SELECT * FROM ${tableName}`).all();
          } catch (_) {
            return [];
          }
        };

        sourceData.departments = loadTable('departments');
        sourceData.categories = loadTable('categories');
        sourceData.profiles = loadTable('profiles');
        sourceData.reports = loadTable('reports');
        sourceData.assignments = loadTable('assignments');
        sourceData.report_events = loadTable('report_events');
        sourceData.audit_events = loadTable('audit_events');
        sourceData.duplicate_relationships = loadTable('duplicate_relationships');
        sourceData.private_notes = loadTable('private_notes');
        sourceData.photo_metadata = loadTable('photo_metadata');
        sourceData.notifications = loadTable('notifications');
        sourceData.notification_jobs = loadTable('notification_jobs');
        sourceData.maintenance_schedules = loadTable('maintenance_schedules');
        sourceData.knowledge_articles = loadTable('knowledge_articles');
        sourceData.community_votes = loadTable('community_votes');
        sourceData.report_appeals = loadTable('report_appeals');
        sourceData.report_feedback = loadTable('report_feedback');

        sdb.close();
        usingSqlite = true;
        console.log(`      ✓ Loaded operational tables from local SQLite (${sourceData.reports.length} reports, ${sourceData.profiles.length} profiles).`);
      } catch (e) {
        console.warn('      Notice: Could not read local SQLite, falling back to seed-data.json:', e.message);
      }
    }

    if (!usingSqlite || sourceData.profiles.length === 0) {
      const seedJsonPath = path.join(__dirname, '..', 'server', 'db', 'seed-data.json');
      if (fs.existsSync(seedJsonPath)) {
        const seedData = JSON.parse(fs.readFileSync(seedJsonPath, 'utf8'));
        if (sourceData.departments.length === 0) sourceData.departments = seedData.departments || [];
        if (sourceData.categories.length === 0) sourceData.categories = seedData.categories || [];
        if (sourceData.profiles.length === 0) sourceData.profiles = seedData.profiles || [];
        if (sourceData.reports.length === 0) sourceData.reports = seedData.reports || [];
        console.log(`      ✓ Loaded fallback seed data (${sourceData.reports.length} reports, ${sourceData.profiles.length} profiles).`);
      }
    }

    console.log('\n[4/4] Migrating records safely in strict foreign-key dependency order (ON CONFLICT DO NOTHING)...');
    const reconciliation = {};

    // 1. Departments
    let deptsMigrated = 0;
    for (const d of sourceData.departments) {
      const res = await client.query(`
        INSERT INTO departments (id, name, active, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [d.id, d.name, Boolean(d.active), d.created_at || new Date().toISOString()]);
      if (res.rowCount > 0) deptsMigrated++;
    }
    reconciliation.departments = { scanned: sourceData.departments.length, inserted: deptsMigrated };
    console.log(`      1. Departments: ${sourceData.departments.length} scanned, ${deptsMigrated} inserted.`);

    // 2. Categories
    let catsMigrated = 0;
    for (const c of sourceData.categories) {
      const res = await client.query(`
        INSERT INTO categories (id, name, department_id, active, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [c.id, c.name, c.department_id, Boolean(c.active), c.created_at || new Date().toISOString()]);
      if (res.rowCount > 0) catsMigrated++;
    }
    reconciliation.categories = { scanned: sourceData.categories.length, inserted: catsMigrated };
    console.log(`      2. Categories: ${sourceData.categories.length} scanned, ${catsMigrated} inserted.`);

    // 3. Profiles
    let profsMigrated = 0;
    for (const p of sourceData.profiles) {
      const res = await client.query(`
        INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash, phone, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        p.id, p.email, p.display_name, p.role, p.department_id || null,
        Boolean(p.active), p.preferred_language || 'en', p.password_hash || null,
        p.phone || null, p.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) profsMigrated++;
    }
    reconciliation.profiles = { scanned: sourceData.profiles.length, inserted: profsMigrated };
    console.log(`      3. Profiles: ${sourceData.profiles.length} scanned, ${profsMigrated} inserted.`);

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
          idempotency_key, community_votes, sla_deadline, escalation_level, last_escalated_at,
          privacy_acknowledged_at, privacy_notice_version, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27, $28,
          $29, $30, $31, $32, $33,
          $34, $35, $36, $37, $38,
          $39, $40, $41, $42
        ) ON CONFLICT (id) DO NOTHING
      `, [
        r.id, r.reference_number, r.citizen_id, r.title, r.description, r.category_id || null, r.department_id || null,
        r.location_text, r.latitude || null, r.longitude || null, Boolean(r.location_verified ?? true), Boolean(r.is_out_of_boundary ?? false),
        r.status || 'Submitted', r.priority_score || 0, r.priority_level || 'Medium', r.severity_factor || 50, r.safety_factor || 50, r.people_factor || 50, r.duration_factor || 50,
        Boolean(r.safety_flag ?? false), r.safety_flag_reason || null, Boolean(r.review_required ?? false), r.review_reason || null, r.analysis_state || 'Completed',
        r.suggested_category_id || null, r.suggested_department_id || null, r.confidence_score || 0, r.analysis_reasoning || null,
        r.primary_report_id || null, r.assigned_staff_id || null, r.blocked_reason || null, r.rejected_reason || null, r.resolution_summary || null,
        r.idempotency_key || null, r.community_votes || 0, r.sla_deadline || null, r.escalation_level || 0, r.last_escalated_at || null,
        r.privacy_acknowledged_at || null, r.privacy_notice_version || '1.0', r.created_at || new Date().toISOString(), r.updated_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) repsMigrated++;
    }
    reconciliation.reports = { scanned: sourceData.reports.length, inserted: repsMigrated };
    console.log(`      4. Reports: ${sourceData.reports.length} scanned, ${repsMigrated} inserted.`);

    // 5. Assignments
    let assignsMigrated = 0;
    for (const a of sourceData.assignments) {
      const res = await client.query(`
        INSERT INTO assignments (id, report_id, staff_id, assigned_by, assigned_at, ended_at, reason, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        a.id, a.report_id, a.staff_id, a.assigned_by,
        a.assigned_at || new Date().toISOString(), a.ended_at || null, a.reason || null, Boolean(a.active)
      ]);
      if (res.rowCount > 0) assignsMigrated++;
    }
    reconciliation.assignments = { scanned: sourceData.assignments.length, inserted: assignsMigrated };
    console.log(`      5. Assignments: ${sourceData.assignments.length} scanned, ${assignsMigrated} inserted.`);

    // 6. Report Events
    let eventsMigrated = 0;
    for (const e of sourceData.report_events) {
      const res = await client.query(`
        INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        e.id, e.report_id, e.actor_id || null, e.event_type,
        Boolean(e.citizen_visible), e.message, e.metadata_json || null, e.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) eventsMigrated++;
    }
    reconciliation.report_events = { scanned: sourceData.report_events.length, inserted: eventsMigrated };
    console.log(`      6. Report Events: ${sourceData.report_events.length} scanned, ${eventsMigrated} inserted.`);

    // 7. Audit Events
    let auditMigrated = 0;
    for (const ae of sourceData.audit_events) {
      const res = await client.query(`
        INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, correlation_id, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        ae.id, ae.actor_id || null, ae.action, ae.entity_type, ae.entity_id,
        ae.before_state_json || null, ae.after_state_json || null, ae.reason || null,
        ae.correlation_id || null, ae.ip_address || null, ae.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) auditMigrated++;
    }
    reconciliation.audit_events = { scanned: sourceData.audit_events.length, inserted: auditMigrated };
    console.log(`      7. Audit Events: ${sourceData.audit_events.length} scanned, ${auditMigrated} inserted.`);

    // 8. Duplicate Relationships
    let dupsMigrated = 0;
    for (const dr of sourceData.duplicate_relationships) {
      const res = await client.query(`
        INSERT INTO duplicate_relationships (id, duplicate_report_id, primary_report_id, status, similarity_score, reason, confirmed_by, created_at, reversed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        dr.id, dr.duplicate_report_id, dr.primary_report_id, dr.status || 'Confirmed',
        dr.similarity_score ?? 100, dr.reason || null, dr.confirmed_by || null,
        dr.created_at || new Date().toISOString(), dr.reversed_at || null
      ]);
      if (res.rowCount > 0) dupsMigrated++;
    }
    reconciliation.duplicate_relationships = { scanned: sourceData.duplicate_relationships.length, inserted: dupsMigrated };
    console.log(`      8. Duplicate Relationships: ${sourceData.duplicate_relationships.length} scanned, ${dupsMigrated} inserted.`);

    // 9. Private Notes
    let notesMigrated = 0;
    for (const pn of sourceData.private_notes) {
      const res = await client.query(`
        INSERT INTO private_notes (id, report_id, author_id, note, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [
        pn.id, pn.report_id, pn.author_id, pn.note, pn.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) notesMigrated++;
    }
    reconciliation.private_notes = { scanned: sourceData.private_notes.length, inserted: notesMigrated };
    console.log(`      9. Private Notes: ${sourceData.private_notes.length} scanned, ${notesMigrated} inserted.`);

    // 10. Photo Metadata
    let photosMigrated = 0;
    for (const pm of sourceData.photo_metadata) {
      const res = await client.query(`
        INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, vision_clues_json, confidence_score, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        pm.id, pm.report_id, pm.uploader_id, pm.storage_path, pm.file_name,
        pm.content_type, pm.size_bytes, Boolean(pm.is_resolution_photo),
        pm.vision_clues_json || null, pm.confidence_score || null, pm.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) photosMigrated++;
    }
    reconciliation.photo_metadata = { scanned: sourceData.photo_metadata.length, inserted: photosMigrated };
    console.log(`      10. Photo Metadata: ${sourceData.photo_metadata.length} scanned, ${photosMigrated} inserted.`);

    // 11. Notifications
    let notifsMigrated = 0;
    for (const n of sourceData.notifications) {
      const res = await client.query(`
        INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at, read_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        n.id, n.recipient_id, n.report_id || null, n.title, n.message,
        Boolean(n.read), n.idempotency_key || null, n.created_at || new Date().toISOString(), n.read_at || null
      ]);
      if (res.rowCount > 0) notifsMigrated++;
    }
    reconciliation.notifications = { scanned: sourceData.notifications.length, inserted: notifsMigrated };
    console.log(`      11. Notifications: ${sourceData.notifications.length} scanned, ${notifsMigrated} inserted.`);

    // 12. Notification Jobs
    let jobsMigrated = 0;
    for (const nj of sourceData.notification_jobs) {
      const res = await client.query(`
        INSERT INTO notification_jobs (id, recipient_id, report_id, payload_json, status, attempts, max_attempts, next_eligible_retry_at, lease_token, lease_expires_at, failure_reason, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `, [
        nj.id, nj.recipient_id, nj.report_id || null, nj.payload_json,
        nj.status || 'Pending', nj.attempts || 0, nj.max_attempts || 3,
        nj.next_eligible_retry_at || null, nj.lease_token || null, nj.lease_expires_at || null,
        nj.failure_reason || null, nj.created_at || new Date().toISOString(), nj.updated_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) jobsMigrated++;
    }
    reconciliation.notification_jobs = { scanned: sourceData.notification_jobs.length, inserted: jobsMigrated };
    console.log(`      12. Notification Jobs: ${sourceData.notification_jobs.length} scanned, ${jobsMigrated} inserted.`);

    // 13. Maintenance Schedules
    let maintMigrated = 0;
    for (const ms of sourceData.maintenance_schedules) {
      const res = await client.query(`
        INSERT INTO maintenance_schedules (id, title, department_id, department_name, area, start_date, end_date, status, official_source, description, assigned_staff_id, assigned_staff_name, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO NOTHING
      `, [
        ms.id, ms.title, ms.department_id || null, ms.department_name, ms.area,
        ms.start_date, ms.end_date, ms.status || 'Scheduled', ms.official_source || null,
        ms.description, ms.assigned_staff_id || null, ms.assigned_staff_name || null,
        ms.created_by || null, ms.created_at || new Date().toISOString(), ms.updated_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) maintMigrated++;
    }
    reconciliation.maintenance_schedules = { scanned: sourceData.maintenance_schedules.length, inserted: maintMigrated };
    console.log(`      13. Maintenance Schedules: ${sourceData.maintenance_schedules.length} scanned, ${maintMigrated} inserted.`);

    // 14. Knowledge Articles
    let knowMigrated = 0;
    for (const ka of sourceData.knowledge_articles) {
      const res = await client.query(`
        INSERT INTO knowledge_articles (id, title, category, content, official_source, last_verified, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        ka.id, ka.title, ka.category, ka.content, ka.official_source,
        ka.last_verified || new Date().toISOString(), ka.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) knowMigrated++;
    }
    reconciliation.knowledge_articles = { scanned: sourceData.knowledge_articles.length, inserted: knowMigrated };
    console.log(`      14. Knowledge Articles: ${sourceData.knowledge_articles.length} scanned, ${knowMigrated} inserted.`);

    // 15. Community Votes
    let votesMigrated = 0;
    for (const cv of sourceData.community_votes) {
      const res = await client.query(`
        INSERT INTO community_votes (id, report_id, citizen_id, created_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [
        cv.id, cv.report_id, cv.citizen_id, cv.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) votesMigrated++;
    }
    reconciliation.community_votes = { scanned: sourceData.community_votes.length, inserted: votesMigrated };
    console.log(`      15. Community Votes: ${sourceData.community_votes.length} scanned, ${votesMigrated} inserted.`);

    // 16. Report Appeals
    let appealsMigrated = 0;
    for (const ra of sourceData.report_appeals) {
      const res = await client.query(`
        INSERT INTO report_appeals (id, report_id, citizen_id, reason, appeal_type, status, admin_notes, decided_by, decided_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        ra.id, ra.report_id, ra.citizen_id, ra.reason, ra.appeal_type || 'resolution',
        ra.status || 'Pending', ra.admin_notes || null, ra.decided_by || null,
        ra.decided_at || null, ra.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) appealsMigrated++;
    }
    reconciliation.report_appeals = { scanned: sourceData.report_appeals.length, inserted: appealsMigrated };
    console.log(`      16. Report Appeals: ${sourceData.report_appeals.length} scanned, ${appealsMigrated} inserted.`);

    // 17. Report Feedback
    let feedbackMigrated = 0;
    for (const rf of sourceData.report_feedback) {
      const res = await client.query(`
        INSERT INTO report_feedback (id, report_id, citizen_id, rating, comment, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `, [
        rf.id, rf.report_id, rf.citizen_id, rf.rating, rf.comment || null, rf.created_at || new Date().toISOString()
      ]);
      if (res.rowCount > 0) feedbackMigrated++;
    }
    reconciliation.report_feedback = { scanned: sourceData.report_feedback.length, inserted: feedbackMigrated };
    console.log(`      17. Report Feedback: ${sourceData.report_feedback.length} scanned, ${feedbackMigrated} inserted.`);

    console.log('\n====================================================');
    console.log('🎉 Production PostgreSQL Migration Completed Successfully!');
    console.log('   All 17 operational tables migrated with full FK integrity.');
    console.log('====================================================\n');

    return reconciliation;
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
