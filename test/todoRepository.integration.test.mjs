import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import test from 'node:test';

import { createTodoRepository } from '../src/db/todoRepository.js';

const migrationPath = path.join(process.cwd(), 'db', 'migrations', '001_create_todos.sql');

function isLocalDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch (_error) {
    return false;
  }
}

function withDatabasePool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    return null;
  }

  if (!isLocalDatabaseUrl(databaseUrl)) {
    return null;
  }

  return new Pool({ connectionString: databaseUrl });
}

async function runMigration(pool) {
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query('BEGIN');
  try {
    await pool.query(migrationSql);
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

test('postgres-backed repository persists data across reads', async () => {
  const pool = withDatabasePool();
  if (!pool) {
    test.skip('DATABASE_URL is not configured for integration tests.');
    return;
  }

  await runMigration(pool);
  await pool.query('TRUNCATE todos RESTART IDENTITY');

  const repository = createTodoRepository({ pool });
  const created = await repository.create('  Integration title  ');
  const beforeRead = await repository.list();
  const repositoryAfterReconnect = createTodoRepository({ pool });
  const afterRead = await repositoryAfterReconnect.list();

  assert.equal(created.title, 'Integration title');
  assert.equal(created.complete, false);
  assert.equal(beforeRead.length, 1);
  assert.equal(beforeRead[0].title, 'Integration title');
  assert.deepEqual(beforeRead, afterRead);
  assert.equal(afterRead[0].title, 'Integration title');

  await repository.updateComplete(created.id, true);
  const edited = await repository.updateTitle(created.id, '  Integration updated  ');
  const finalRows = await repositoryAfterReconnect.list();

  assert.equal(edited.title, 'Integration updated');
  assert.equal(finalRows.length, 1);
  assert.equal(finalRows[0].title, 'Integration updated');
  assert.equal(finalRows[0].complete, true);

  await repository.delete(created.id);
  const emptied = await repositoryAfterReconnect.list();
  assert.equal(emptied.length, 0);
  await pool.end();
});
