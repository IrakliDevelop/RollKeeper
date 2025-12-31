import { pool, testConnection } from './connection';
import fs from 'fs';
import path from 'path';

interface Migration {
  name: string;
  path: string;
}

async function getMigrations(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir);

  return files
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      name: file,
      path: path.join(migrationsDir, file),
    }));
}

async function createMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

async function executeMigration(migration: Migration): Promise<void> {
  const sql = fs.readFileSync(migration.path, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [
      migration.name,
    ]);
    await client.query('COMMIT');
    console.log(`Executed migration: ${migration.name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to execute migration: ${migration.name}`, error);
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...\n');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    await createMigrationsTable();

    const migrations = await getMigrations();
    const executed = await getExecutedMigrations();

    const pending = migrations.filter(m => !executed.includes(m.name));

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):\n`);

    for (const migration of pending) {
      await executeMigration(migration);
    }

    console.log('\nAll migrations completed successfully');
  } catch (error) {
    console.error('\nMigration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
