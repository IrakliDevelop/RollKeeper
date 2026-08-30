import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { getLocalSupabaseTestConfig } from './local-supabase-env.mjs';

// Same local Supabase Postgres container used by scripts/local-supabase-env.mjs
// for other direct-SQL admin fixtures.
const DATABASE_CONTAINER = 'supabase_db_rollkeeper-local';
const USER_A_ID = '10000000-0000-4000-8000-000000000001';
const DUMP_PATH = path.join(os.tmpdir(), 'rollkeeper-nightly-dump.sql');
const LEGACY_CLIENT_ID_PREFIX = 'nightly-backup-drill-';

const DRILL_ROWS = [
  {
    id: 'b0000000-0000-4000-8000-000000000101',
    legacyClientId: `${LEGACY_CLIENT_ID_PREFIX}1`,
    name: 'Nightly Backup Drill One',
    payload: { drill: 'nightly-backup-restore', nonce: 'a17f2c9d-drill-one' },
  },
  {
    id: 'b0000000-0000-4000-8000-000000000102',
    legacyClientId: `${LEGACY_CLIENT_ID_PREFIX}2`,
    name: 'Nightly Backup Drill Two',
    payload: { drill: 'nightly-backup-restore', nonce: 'a17f2c9d-drill-two' },
  },
  {
    id: 'b0000000-0000-4000-8000-000000000103',
    legacyClientId: `${LEGACY_CLIENT_ID_PREFIX}3`,
    name: 'Nightly Backup Drill Three',
    payload: {
      drill: 'nightly-backup-restore',
      nonce: 'a17f2c9d-drill-three',
    },
  },
];

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createUserJwt(secret, userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtPart({
    aud: 'authenticated',
    exp: now + 300,
    iat: now,
    iss: 'supabase-demo',
    role: 'authenticated',
    sub: userId,
  });
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function requireLocalSupabaseRunning() {
  try {
    return getLocalSupabaseTestConfig();
  } catch (error) {
    throw new Error(
      'Local Supabase does not appear to be running. Start it with ' +
        '`npm run db:start` before running the nightly backup/restore drill. ' +
        `Underlying error: ${error.message}`
    );
  }
}

// Every direct-SQL admin fixture in this repo (see local-supabase-env.mjs)
// talks to Postgres through `docker exec ... psql` rather than a host `psql`
// binary, because the host running these tests has no Postgres client
// installed. We follow the same pattern here for seeding, truncating, and
// restoring.
function runSql(sql) {
  execFileSync(
    'docker',
    [
      'exec',
      DATABASE_CONTAINER,
      'psql',
      '--username=postgres',
      '--dbname=postgres',
      '--set=ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { stdio: 'pipe' }
  );
}

// Restores a `supabase db dump` file by piping it into `psql` running inside
// the database container's stdin, since the dump lives on the host
// filesystem and the container has no bind mount for it.
function restoreDump(dumpPath) {
  const dumpContents = fs.readFileSync(dumpPath);
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DATABASE_CONTAINER,
      'psql',
      '--username=postgres',
      '--dbname=postgres',
    ],
    { input: dumpContents, stdio: ['pipe', 'pipe', 'pipe'] }
  );
}

function insertSqlValue(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function seedDrillRows() {
  const values = DRILL_ROWS.map(row => {
    const jsonLiteral = JSON.stringify(row.payload).replaceAll("'", "''");

    return `(${insertSqlValue(row.id)}, ${insertSqlValue(USER_A_ID)}, ${insertSqlValue(
      row.legacyClientId
    )}, ${insertSqlValue(row.name)}, '${jsonLiteral}'::jsonb, 1, 1, 1)`;
  }).join(',\n    ');

  runSql(`
    insert into public.characters
      (id, owner_id, legacy_client_id, name, payload, schema_version, client_revision, server_version)
    values
      ${values};
  `);
}

function deleteDrillRows() {
  runSql(
    `delete from public.characters where legacy_client_id like '${LEGACY_CLIENT_ID_PREFIX}%';`
  );
}

async function fetchDrillRows(config, token) {
  const response = await fetch(
    `${config.restUrl}/characters?legacy_client_id=like.${LEGACY_CLIENT_ID_PREFIX}*&order=id.asc`,
    {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  assert.equal(
    response.status,
    200,
    `unexpected REST status reading drill rows: ${response.status}`
  );

  return response.json();
}

test('nightly database backup/restore drill restores seeded rows byte-identically', async t => {
  const config = requireLocalSupabaseRunning();
  const token = createUserJwt(config.jwtSecret, USER_A_ID);

  t.after(() => {
    try {
      deleteDrillRows();
    } catch {
      // best-effort cleanup; a failed drill may have already removed these
    }
    fs.rmSync(DUMP_PATH, { force: true });
  });

  // 1. Seed distinctive rows and capture their canonical JSON via REST.
  seedDrillRows();
  const seeded = await fetchDrillRows(config, token);
  assert.equal(
    seeded.length,
    DRILL_ROWS.length,
    'expected all drill rows to be seeded'
  );
  const canonicalSeeded = structuredClone(seeded);

  // 2. Dump local Supabase data.
  execFileSync(
    'npx',
    ['supabase', 'db', 'dump', '--local', '--data-only', '-f', DUMP_PATH],
    { stdio: 'pipe' }
  );
  assert.ok(fs.existsSync(DUMP_PATH), 'expected the dump file to be written');

  // 3. Destroy local data via the project's standard reset workflow and
  // confirm the drill rows are gone.
  execFileSync('npm', ['run', 'db:reset'], { stdio: 'pipe' });
  const afterReset = await fetchDrillRows(config, token);
  assert.deepEqual(
    afterReset,
    [],
    'expected drill rows to be gone after db:reset'
  );

  // 4. `db:reset` re-applies supabase/seed.sql, which recreates the fixed
  // baseline auth.users/characters rows that were also present (and thus
  // captured) when we took the dump. `supabase db dump` batches each
  // table's data into a single multi-row INSERT statement, so restoring
  // that INSERT on top of the freshly reseeded baseline would collide on
  // primary key and roll back the *entire* statement -- including our
  // drill rows bundled into the same INSERT. Clearing the tables the dump
  // will repopulate avoids that collision and mirrors restoring onto an
  // empty database, which is the real-world backup/restore scenario.
  runSql('truncate table public.characters, auth.users cascade;');

  // 5. Restore from the dump.
  restoreDump(DUMP_PATH);

  // 6. Read back and assert restored rows are byte-identical to what was
  // captured before the dump.
  const restored = await fetchDrillRows(config, token);
  assert.deepEqual(
    restored,
    canonicalSeeded,
    'restored drill rows must exactly match the pre-dump snapshot'
  );
});
