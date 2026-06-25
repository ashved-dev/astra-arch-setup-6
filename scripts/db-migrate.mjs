import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDatabaseUrl } from '../src/db/todoRepository.js';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), '..');
const migrationPath = path.join(repoRoot, 'db', 'migrations', '001_create_todos.sql');

async function runMigration() {
  const databaseUrl = ensureDatabaseUrl();
  const migrationSql = await fs.readFile(migrationPath, 'utf8');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query('BEGIN');
    try {
      await pool.query(migrationSql);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } finally {
    await pool.end();
  }
}

await runMigration();
