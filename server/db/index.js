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

// Always maintain SQLite engine for deterministic tests, fast local transactions, and offline demo
const Database = require('better-sqlite3');
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'civic_resolve.db');
const oldDbPath = path.join(dataDir, 'civic_sync.db');
if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(oldDbPath, dbPath);
  } catch (e) {
    console.warn('[DB] Could not copy old db:', e);
  }
}
// On Vercel, copy pre-seeded database into /tmp on cold start if not present
const sourceSeedDb = path.join(__dirname, '..', 'data', 'civic_resolve.db');
if (isVercel && fs.existsSync(sourceSeedDb) && !fs.existsSync(dbPath)) {
  try {
    fs.copyFileSync(sourceSeedDb, dbPath);
  } catch (e) {
    console.warn('[DB] Could not copy seed db to /tmp:', e);
  }
}
db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize schema if not present
const schemaSqlPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
db.exec(schemaSql);

// Ensure production user profile columns exist
try {
  db.exec('ALTER TABLE profiles ADD COLUMN phone TEXT;');
} catch (_) {}

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
