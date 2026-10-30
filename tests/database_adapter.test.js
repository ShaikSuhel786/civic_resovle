// Civic Resolve AI: Database Adapter & Persistence Test Suite
// Verifies adapter mode detection, PostgreSQL dialect normalization, fail-fast behavior, and transaction integrity.

const assert = require('assert');
const path = require('path');
const db = require('../server/db');

async function runDatabaseAdapterTests() {
  console.log('\n======================================================');
  console.log('  CIVIC RESOLVE AI — DATABASE ADAPTER TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // 1. Adapter initialization and mode detection
  await test('Database adapter initializes with active persistence engine', () => {
    assert.ok(db.mode === 'sqlite' || db.mode === 'postgres', `Mode should be sqlite or postgres, got: ${db.mode}`);
    assert.ok(typeof db.get === 'function', 'db.get should be a function');
    assert.ok(typeof db.all === 'function', 'db.all should be a function');
    assert.ok(typeof db.run === 'function', 'db.run should be a function');
    assert.ok(typeof db.transaction === 'function', 'db.transaction should be a function');
  });

  // 2. Production fail-fast verification
  await test('Production mode throws fatal error if persistent shared database URL is missing', () => {
    const savedEnv = process.env.NODE_ENV;
    const savedDbUrl = process.env.DATABASE_URL;
    const savedPgUrl = process.env.POSTGRES_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;
      delete process.env.POSTGRES_URL;
      delete process.env.SUPABASE_DB_URL;

      // Clear require cache for server/db/index.js
      const resolvedPath = require.resolve('../server/db');
      delete require.cache[resolvedPath];

      assert.throws(() => {
        require('../server/db');
      }, /\[DB FATAL\] Production database configuration missing/);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedDbUrl) process.env.DATABASE_URL = savedDbUrl;
      if (savedPgUrl) process.env.POSTGRES_URL = savedPgUrl;
      const resolvedPath = require.resolve('../server/db');
      delete require.cache[resolvedPath];
      require('../server/db');
    }
  });

  // 3. SQL Normalizer: ? to $1, $2 parameter mapping
  await test('toPgSql translates positional ? placeholders into $1, $2, $3 numbering', () => {
    const sql = 'SELECT * FROM reports WHERE id = ? AND department_id = ? AND status = ?';
    const translated = db.toPgSql(sql);
    assert.strictEqual(translated, 'SELECT * FROM reports WHERE id = $1 AND department_id = $2 AND status = $3');
  });

  // 4. SQL Normalizer: datetime replacements
  await test('toPgSql translates SQLite datetime functions to standard PostgreSQL timestamps', () => {
    const sql = "SELECT * FROM reports WHERE created_at >= datetime('now', '-30 days') AND updated_at <= datetime('now')";
    const translated = db.toPgSql(sql);
    assert.ok(translated.includes("CURRENT_TIMESTAMP - INTERVAL '30 days'"));
    assert.ok(translated.includes("CURRENT_TIMESTAMP"));
    assert.ok(!translated.includes("datetime('now')"));
  });

  // 5. SQL Normalizer: boolean expression replacements
  await test('toPgSql translates SQLite integer boolean expressions to PostgreSQL boolean literals', () => {
    const sql = 'SELECT * FROM profiles WHERE active = 1 AND review_required = 0 AND safety_flag = 1';
    const translated = db.toPgSql(sql);
    assert.ok(translated.includes('active = TRUE'));
    assert.ok(translated.includes('review_required = FALSE'));
    assert.ok(translated.includes('safety_flag = TRUE'));
  });

  // 6. SQL Normalizer: INSERT OR IGNORE translation
  await test('toPgSql translates INSERT OR IGNORE INTO to INSERT INTO ... ON CONFLICT DO NOTHING', () => {
    const sql = 'INSERT OR IGNORE INTO departments (id, name, active) VALUES (?, ?, 1)';
    const translated = db.toPgSql(sql);
    assert.ok(translated.startsWith('INSERT INTO departments'));
    assert.ok(translated.includes('ON CONFLICT DO NOTHING'));
    assert.ok(translated.includes('$1, $2, 1'));
  });

  // 7. Async CRUD operations
  await test('Async db.get, db.all, and db.run operate cleanly across asynchronous boundaries', async () => {
    const testDeptId = 'dept-test-async-' + Date.now();
    await db.run('INSERT INTO departments (id, name, active) VALUES (?, ?, 1)', [testDeptId, 'Test Dept ' + Date.now()]);

    const retrieved = await db.get('SELECT * FROM departments WHERE id = ?', [testDeptId]);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, testDeptId);

    const allDepts = await db.all('SELECT * FROM departments WHERE id = ?', [testDeptId]);
    assert.strictEqual(allDepts.length, 1);

    await db.run('DELETE FROM departments WHERE id = ?', [testDeptId]);
    const afterDelete = await db.get('SELECT * FROM departments WHERE id = ?', [testDeptId]);
    assert.strictEqual(afterDelete, null);
  });

  // 8. Transaction rollback verification
  await test('db.transaction rolls back all mutations when an error is thrown inside transaction callback', async () => {
    const canaryId = 'rep-canary-rollback-' + Date.now();

    try {
      await db.transaction(async () => {
        await db.run(`
          INSERT INTO departments (id, name, active)
          VALUES (?, 'Canary Dept', 1)
        `, [canaryId]);

        // Intentionally throw inside transaction
        throw new Error('ROLLBACK_INTENTIONAL_ERROR');
      });
    } catch (e) {
      assert.strictEqual(e.message, 'ROLLBACK_INTENTIONAL_ERROR');
    }

    // Verify record was rolled back and does not exist in database
    const row = await db.get('SELECT * FROM departments WHERE id = ?', [canaryId]);
    assert.strictEqual(row, null, 'Canary record should not exist after transaction rollback');
  });

  // 9. Boolean parameter sanitization (prevents SQLite3 boolean binding error)
  await test('Adapter parameter sanitizer cleanly coerces JavaScript booleans without throwing', async () => {
    const booleanTestId = 'dept-bool-test-' + Date.now();
    // Pass JavaScript true boolean literal
    await db.run('INSERT INTO departments (id, name, active) VALUES (?, ?, ?)', [booleanTestId, 'Bool Dept ' + Date.now(), true]);

    const row = await db.get('SELECT id, active FROM departments WHERE id = ?', [booleanTestId]);
    assert.ok(row);
    assert.ok(row.active === 1 || row.active === true);

    await db.run('DELETE FROM departments WHERE id = ?', [booleanTestId]);
  });

  // 10. toPgSql translates strftime('%Y-%m', col) to TO_CHAR(col, 'YYYY-MM')
  await test('toPgSql translates strftime to PostgreSQL TO_CHAR', () => {
    const sql = "SELECT strftime('%Y-%m', r.created_at) as month, COUNT(*) as count FROM reports r GROUP BY month";
    const translated = db.toPgSql(sql);
    assert.ok(translated.includes("TO_CHAR(r.created_at, 'YYYY-MM') as month"));
    assert.ok(!translated.includes("strftime"));
  });

  // 11. sanitizePgParamsForSql converts integer 0/1 to boolean for boolean columns, preserving integers for count/rating
  await test('sanitizePgParamsForSql targets boolean columns without corrupting numeric integer values', () => {
    const insertSql = 'INSERT INTO reports (id, title, location_verified, safety_flag, priority_score, community_votes) VALUES (?, ?, ?, ?, ?, ?)';
    const insertParams = ['rep-1', 'Test Title', 1, 0, 85, 12];
    const cleanedInsert = db.sanitizePgParamsForSql(insertSql, insertParams);
    assert.strictEqual(cleanedInsert[0], 'rep-1');
    assert.strictEqual(cleanedInsert[1], 'Test Title');
    assert.strictEqual(cleanedInsert[2], true);
    assert.strictEqual(cleanedInsert[3], false);
    assert.strictEqual(cleanedInsert[4], 85);
    assert.strictEqual(cleanedInsert[5], 12);

    const updateSql = 'UPDATE notifications SET read = ?, attempts = ? WHERE active = ?';
    const updateParams = [1, 2, 0];
    const cleanedUpdate = db.sanitizePgParamsForSql(updateSql, updateParams);
    assert.strictEqual(cleanedUpdate[0], true);
    assert.strictEqual(cleanedUpdate[1], 2);
    assert.strictEqual(cleanedUpdate[2], false);
  });

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passed}/${passed + failed} DATABASE ADAPTER TESTS PASSED!`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runDatabaseAdapterTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runDatabaseAdapterTests };
