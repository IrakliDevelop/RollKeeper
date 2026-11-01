/**
 * Keeps every local e2e app server off a remote Redis (PR08 repair 07 CC2).
 *
 * Next loads `.env`/`.env.local` for keys the process does not already
 * define, and a developer's `.env` may point `UPSTASH_REDIS_REST_*` at a
 * real Upstash database. Every Playwright app server therefore sets both
 * keys explicitly: empty (no Redis, the same as CI) or the local
 * serverless-redis-http on :8079 for the relay-backed suites. A non-local
 * URL exported in the shell fails the run before any server starts.
 *
 * The relay (`relay/`, `tsx watch --env-file-if-exists=.env`) gets the same
 * treatment for `REDIS_URL` (DD3): the command sets it to the local Redis,
 * and Node gives the process environment precedence over `--env-file`
 * values (checked: an exported value wins over the file's), so a
 * `relay/.env` cannot point e2e at a remote Redis.
 */

const LOCAL_URL =
  /^(https?|rediss?):\/\/([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/u;

/** Throws when the shell exports a non-local Redis URL under `name`. */
function assertLocalUrl(name: string, url: string | undefined): void {
  if (!url || LOCAL_URL.test(url)) return;
  let host = 'an unparsable URL';
  try {
    host = new URL(url).host;
  } catch {
    // keep the generic description
  }
  throw new Error(
    `e2e refuses a non-local ${name} (${host}). Unset it or point it at localhost.`
  );
}

/** Throws when the shell exports a non-local `UPSTASH_REDIS_REST_URL`. */
export function assertLocalRedis(
  url: string | undefined = process.env.UPSTASH_REDIS_REST_URL
): void {
  assertLocalUrl('UPSTASH_REDIS_REST_URL', url);
}

/**
 * Prefixes an app server command with explicit Redis variables: `none`
 * (empty, like CI) or `local` (serverless-redis-http on localhost:8079).
 */
export function withLocalRedis(
  command: string,
  redis: 'none' | 'local'
): string {
  assertLocalRedis();
  const vars =
    redis === 'local'
      ? 'UPSTASH_REDIS_REST_URL=http://localhost:8079 UPSTASH_REDIS_REST_TOKEN=local_dev_token'
      : 'UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=';
  return `env ${vars} ${command}`;
}

/**
 * Prefixes the relay dev server command with the local Redis (DD3), after
 * refusing a non-local `REDIS_URL` exported in the shell.
 */
export function withLocalRelayRedis(command: string): string {
  assertLocalUrl('REDIS_URL', process.env.REDIS_URL);
  return `env REDIS_URL=redis://localhost:6379 ${command}`;
}
