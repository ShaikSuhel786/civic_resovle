// Civic Resolve AI: Unified Production Database Adapter
// Provides seamless persistence across PostgreSQL (Production / Supabase) and SQLite (Local / Dev / Tests).
// Strictly enforces fail-fast error boundaries when persistent production database credentials are missing.

const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

const asyncLocalStorage = new AsyncLocalStorage();

// Determine configuration
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = (
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.SUPABASE_DB_URL || 
  ''
).trim();

const isPostgresConfigured = Boolean(
  databaseUrl && 
  (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) &&
  !databaseUrl.includes('[YOUR-PASSWORD]') &&
  !databaseUrl.includes('your-project-id')
);

const isSupabaseConfigured = Boolean(
  process.env.SUPABASE_URL && 
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.SUPABASE_URL.includes('your-project-id')
);

// In production, strictly reject ephemeral in-memory or ephemeral /tmp SQLite storage
if (isProduction && !isPostgresConfigured) {
  const fatalMsg = (
    '[DB FATAL] Production database configuration missing! ' +
    'Civic Resolve AI requires a durable shared PostgreSQL database in production (set DATABASE_URL or POSTGRES_URL). ' +
    'Silent in-memory mock or ephemeral /tmp SQLite fallback is strictly prohibited in production to prevent data loss across serverless instances.'
  );
  console.error(fatalMsg);
  throw new Error(fatalMsg);
}

let supabaseClient = null;
if (isSupabaseConfigured) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('[DB] Supabase client initialized for project:', process.env.SUPABASE_URL);
  } catch (err) {
    console.warn('[DB Warning] Supabase client initialization warning:', err.message);
  }
}

// --------------------------------------------------------------------------
// SQL Normalizer for PostgreSQL Dialect
// --------------------------------------------------------------------------
function toPgSql(sql) {
  if (!sql || typeof sql !== 'string') return sql;

  let pgSql = sql
    // Datetime replacements
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/datetime\("now"\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/datetime\('now',\s*'-30 days'\)/gi, "CURRENT_TIMESTAMP - INTERVAL '30 days'")
    // Boolean comparison replacements (PostgreSQL boolean columns do not accept integer 1/0)
    .replace(/\bactive\s*=\s*1\b/gi, 'active = TRUE')
    .replace(/\bactive\s*=\s*0\b/gi, 'active = FALSE')
    .replace(/\bread\s*=\s*0\b/gi, 'read = FALSE')
    .replace(/\bread\s*=\s*1\b/gi, 'read = TRUE')
    .replace(/\breview_required\s*=\s*0\b/gi, 'review_required = FALSE')
    .replace(/\breview_required\s*=\s*1\b/gi, 'review_required = TRUE')
    .replace(/\bsafety_flag\s*=\s*0\b/gi, 'safety_flag = FALSE')
    .replace(/\bsafety_flag\s*=\s*1\b/gi, 'safety_flag = TRUE')
    .replace(/\bcitizen_visible\s*=\s*1\b/gi, 'citizen_visible = TRUE')
    .replace(/\bcitizen_visible\s*=\s*0\b/gi, 'citizen_visible = FALSE')
    // SQLite INSERT OR IGNORE translation
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO');

  // Replace ? placeholders with $1, $2, $3...
  let paramIndex = 1;
  pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

  // If was INSERT OR IGNORE and does not have ON CONFLICT, append ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql) && !/ON\s+CONFLICT/i.test(pgSql)) {
    pgSql += ' ON CONFLICT DO NOTHING';
  }

  return pgSql;
}

// --------------------------------------------------------------------------
// Adapter Implementation
// --------------------------------------------------------------------------
let adapter = null;

if (isPostgresConfigured) {
  // PostgreSQL Engine
  console.log('[DB] Connecting to persistent PostgreSQL database...');
  const { Pool, types } = require('pg');
  // Parse int8 (bigint / count(*)) to JavaScript number
  types.setTypeParser(20, (val) => (val === null ? 0 : parseInt(val, 10)));

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1'))
      ? false
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('[DB PG Pool Error]', err.message);
  });

  function sanitizePgParams(params = []) {
    return params.map(p => (p === undefined ? null : p));
  }

  adapter = {
    mode: 'postgres',
    isPostgres: true,
    pool,
    db: pool,

    async query(sql, params = []) {
      const store = asyncLocalStorage.getStore();
      const client = store?.client || pool;
      const pgSql = toPgSql(sql);
      const cleanParams = sanitizePgParams(params);
      return await client.query(pgSql, cleanParams);
    },

    async all(sql, params = []) {
      const res = await this.query(sql, params);
      return res.rows || [];
    },

    async get(sql, params = []) {
      const res = await this.query(sql, params);
      return res.rows && res.rows.length > 0 ? res.rows[0] : null;
    },

    async run(sql, params = []) {
      const res = await this.query(sql, params);
      return {
        changes: res.rowCount || 0,
        rowCount: res.rowCount || 0
      };
    },

    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await asyncLocalStorage.run({ client, isTx: true }, async () => {
          return await fn(client);
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    }
  };

} else {
  // SQLite Engine (Local Development & Test Suites)
  console.log('[DB] Running with local SQLite database engine (better-sqlite3).');
  const Database = require('better-sqlite3');

  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
  }
  const dbPath = path.join(dataDir, 'civic_resolve.db');

  const sqliteDb = new Database(dbPath);
  sqliteDb.pragma('foreign_keys = ON');

  // Ensure production schema additions are present
  try { sqliteDb.exec('ALTER TABLE profiles ADD COLUMN phone TEXT;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE reports ADD COLUMN community_votes INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE reports ADD COLUMN sla_deadline TEXT;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE reports ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE reports ADD COLUMN last_escalated_at TEXT;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE photo_metadata ADD COLUMN vision_clues_json TEXT;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE photo_metadata ADD COLUMN confidence_score INTEGER;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE maintenance_schedules ADD COLUMN assigned_staff_id TEXT;'); } catch (_) {}
  try { sqliteDb.exec('ALTER TABLE maintenance_schedules ADD COLUMN assigned_staff_name TEXT;'); } catch (_) {}

  // Initialize schema if not present
  const schemaSqlPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaSqlPath)) {
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    sqliteDb.exec(schemaSql);
  }

  // Sanitize params for SQLite (convert JS booleans to 1/0, undefined to null)
  function sanitizeSqliteParams(params = []) {
    return params.map(p => {
      if (typeof p === 'boolean') return p ? 1 : 0;
      if (p === undefined) return null;
      return p;
    });
  }

  adapter = {
    mode: 'sqlite',
    isPostgres: false,
    db: sqliteDb,

    all(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      return stmt.all(sanitizeSqliteParams(params));
    },

    get(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      const res = stmt.get(sanitizeSqliteParams(params));
      return res || null;
    },

    run(sql, params = []) {
      const stmt = sqliteDb.prepare(sql);
      return stmt.run(sanitizeSqliteParams(params));
    },

    transaction(fn) {
      sqliteDb.exec('BEGIN');
      let result;
      try {
        result = fn();
        if (result && typeof result.then === 'function') {
          return result.then(val => {
            sqliteDb.exec('COMMIT');
            return val;
          }).catch(err => {
            try { sqliteDb.exec('ROLLBACK'); } catch (_) {}
            throw err;
          });
        }
        sqliteDb.exec('COMMIT');
        return result;
      } catch (err) {
        try { sqliteDb.exec('ROLLBACK'); } catch (_) {}
        throw err;
      }
    },

    close() {
      sqliteDb.close();
    }
  };
}

module.exports = {
  ...adapter,
  supabaseClient,
  isSupabaseConfigured,
  isPostgresConfigured,
  toPgSql
};
