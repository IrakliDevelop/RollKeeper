import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const DATABASE_CONTAINER = 'supabase_db_rollkeeper-local';

function runInDatabase(arguments_) {
  return execFileSync('docker', ['exec', DATABASE_CONTAINER, ...arguments_], {
    encoding: 'utf8',
  });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function resetLocalSupabase() {
  execFileSync('npx', ['supabase', 'db', 'reset', '--local'], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

export function fingerprintLocalSupabase() {
  const schema = runInDatabase([
    'pg_dump',
    '--dbname=postgres',
    '--username=postgres',
    '--schema-only',
    '--schema=public',
    '--schema=private',
    '--no-owner',
    '--no-privileges',
  ])
    .split(/\r?\n/u)
    .filter(line => !/^\\(?:un)?restrict\b/u.test(line))
    .join('\n');
  const seed = runInDatabase([
    'psql',
    '--username=postgres',
    '--dbname=postgres',
    '--tuples-only',
    '--no-align',
    '--command',
    `select jsonb_build_object(
      'users', (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'aud', aud,
            'role', role,
            'email', email,
            'email_confirmed_at', email_confirmed_at,
            'raw_app_meta_data', raw_app_meta_data,
            'raw_user_meta_data', raw_user_meta_data,
            'created_at', created_at,
            'updated_at', updated_at
          ) order by id
        )
        from auth.users
        where id in (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000002'
        )
      ),
      'characters', (
        select jsonb_agg(to_jsonb(characters) order by id)
        from public.characters
      )
    )::text;`,
  ]).trim();
  const migrations = runInDatabase([
    'psql',
    '--username=postgres',
    '--dbname=postgres',
    '--tuples-only',
    '--no-align',
    '--command',
    `select version
     from supabase_migrations.schema_migrations
     order by version;`,
  ])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);

  return {
    migrations,
    schemaSha256: sha256(schema),
    seedSha256: sha256(seed),
  };
}
