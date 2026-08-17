import { execFileSync } from 'node:child_process';

const DATABASE_CONTAINER = 'supabase_db_rollkeeper-local';

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Local Supabase status did not provide ${name}`);
  }

  return value;
}

export function getLocalSupabaseTestConfig() {
  const output = execFileSync(
    'npx',
    ['supabase', 'status', '--output', 'json'],
    { encoding: 'utf8' }
  );
  const jsonStart = output.indexOf('{');

  if (jsonStart < 0) {
    throw new Error('Local Supabase status did not return JSON');
  }

  const status = JSON.parse(output.slice(jsonStart));

  return {
    apiUrl: requireString(status.API_URL, 'API_URL'),
    anonKey: requireString(status.ANON_KEY, 'ANON_KEY'),
    jwtSecret: requireString(status.JWT_SECRET, 'JWT_SECRET'),
    mailpitUrl: requireString(
      status.MAILPIT_URL ?? status.INBUCKET_URL,
      'MAILPIT_URL'
    ),
    publishableKey: requireString(
      status.PUBLISHABLE_KEY ?? status.ANON_KEY,
      'PUBLISHABLE_KEY'
    ),
    restUrl: requireString(status.REST_URL, 'REST_URL'),
  };
}

export function expireLocalEmailOtp(email) {
  if (!/^[^@\s]+@[^@\s]+$/u.test(email)) {
    throw new Error('Invalid local Auth fixture email');
  }

  execFileSync(
    'docker',
    [
      'exec',
      DATABASE_CONTAINER,
      'psql',
      '--username=postgres',
      '--dbname=postgres',
      '--command',
      `update auth.users
       set confirmation_sent_at = now() - interval '11 minutes'
       where email = '${email.replaceAll("'", "''")}';`,
    ],
    { stdio: 'pipe' }
  );
}

export function setLocalCharacterTombstone(characterId, deletedAt) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(characterId)) {
    throw new Error('Invalid local fixture character ID');
  }

  const timestamp = new Date(deletedAt);
  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error('Invalid local fixture tombstone timestamp');
  }

  execFileSync(
    'docker',
    [
      'exec',
      DATABASE_CONTAINER,
      'psql',
      '--username=postgres',
      '--dbname=postgres',
      '--command',
      `update public.characters
       set deleted_at = '${timestamp.toISOString()}'::timestamptz
       where id = '${characterId}'::uuid;`,
    ],
    { stdio: 'pipe' }
  );
}

export function provisionLocalWorkspaceClaim({
  authorizationId,
  claimantId,
  sourceFingerprint,
  token,
}) {
  const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
  if (!uuidPattern.test(authorizationId) || !uuidPattern.test(claimantId)) {
    throw new Error('Invalid local workspace claim fixture ID');
  }
  if (!/^[a-f0-9]{64}$/u.test(sourceFingerprint) || token.length < 16) {
    throw new Error('Invalid local workspace claim fixture proof');
  }

  execFileSync(
    'docker',
    [
      'exec',
      DATABASE_CONTAINER,
      'psql',
      '--username=postgres',
      '--dbname=postgres',
      '--command',
      `insert into private.workspace_claim_authorizations (
         id, claimant_id, legacy_source_fingerprint, token_hash, expires_at
       ) values (
         '${authorizationId}'::uuid,
         '${claimantId}'::uuid,
         '${sourceFingerprint}',
         extensions.digest('${token.replaceAll("'", "''")}', 'sha256'),
         statement_timestamp() + interval '1 hour'
       );`,
    ],
    { stdio: 'pipe' }
  );
}
