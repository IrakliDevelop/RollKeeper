import type { Redis } from '@upstash/redis';
import { SLIDING_TTL_SECONDS } from '@/lib/redis';
import type { DmXpAward, DmXpAwardEnvelope } from '@/types/sharedState';

export const XP_QUEUE_CAP = 100;
const XP_AWARD_ID_MAX_LENGTH = 64;
const XP_AWARD_DATE_MAX_LENGTH = 40;

// Atomic capped enqueue: cap check, append, and expiry refresh in one script
// so concurrent requests can never both observe length 99 and overshoot.
// KEYS[1] = queue key; ARGV[1] = serialized award; ARGV[2] = cap; ARGV[3] = ttl.
const ENQUEUE_SCRIPT = `
if redis.call('LLEN', KEYS[1]) >= tonumber(ARGV[2]) then
  return 'full'
end
redis.call('RPUSH', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
return 'ok'
`;

/** Serialize ONCE and atomically append; 'full' when the queue is at cap. */
export async function enqueueXpAward(
  redis: Redis,
  key: string,
  award: DmXpAward
): Promise<'ok' | 'full'> {
  const serialized = JSON.stringify(award);
  const result = await redis.eval(
    ENQUEUE_SCRIPT,
    [key],
    [serialized, String(XP_QUEUE_CAP), String(SLIDING_TTL_SECONDS)]
  );
  // Fail loud on anything unexpected — silently treating an unrecognized
  // reply as 'ok' would let the route return 200 while the award was never
  // stored (the caller's try/catch turns this throw into a 500).
  if (result === 'ok' || result === 'full') return result;
  throw new Error(`enqueueXpAward: unexpected EVAL reply: ${String(result)}`);
}

/**
 * Read all queued awards in enqueue order. Each receipt is the exact stored
 * string (requires the raw client — never re-serialize). Malformed entries are
 * removed in place so they don't consume capacity or re-log every poll.
 */
export async function readXpAwards(
  redis: Redis,
  key: string
): Promise<DmXpAwardEnvelope[]> {
  const entries = await redis.lrange<string>(key, 0, -1);
  const envelopes: DmXpAwardEnvelope[] = [];
  for (const receipt of entries) {
    let award: DmXpAward | null = null;
    try {
      const parsed = JSON.parse(receipt) as DmXpAward;
      if (parsed && typeof parsed.id === 'string') award = parsed;
    } catch {
      // fall through to removal
    }
    if (award) {
      envelopes.push({ award, receipt });
    } else {
      await redis.lrem(key, 1, receipt);
      console.error('Removed malformed XP award entry', { key });
    }
  }
  return envelopes;
}

/**
 * Remove exactly one matching entry, then refresh expiry if entries remain.
 *
 * No explicit DEL when the queue empties: LREM → LLEN is not atomic, so a
 * concurrent enqueue landing between them could see remaining === 0 from a
 * list a fresh RPUSH just repopulated, and DEL would destroy that award.
 * Redis already deletes a list key on its own once the last element is
 * removed, so skipping DEL here is both safe and sufficient.
 */
export async function ackXpAward(
  redis: Redis,
  key: string,
  receipt: string
): Promise<void> {
  await redis.lrem(key, 1, receipt);
  const remaining = await redis.llen(key);
  if (remaining > 0) {
    await redis.expire(key, SLIDING_TTL_SECONDS);
  }
}

/** Strict server-side validation. Returns an error message, or null when valid. */
export function validateDmXpAward(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'award must be an object';
  const a = value as Record<string, unknown>;
  if (
    typeof a.id !== 'string' ||
    a.id.length === 0 ||
    a.id.length > XP_AWARD_ID_MAX_LENGTH
  ) {
    return 'award.id must be a non-empty string of at most 64 characters';
  }
  if (a.mode !== 'add' && a.mode !== 'set') {
    return "award.mode must be 'add' or 'set'";
  }
  if (
    typeof a.amount !== 'number' ||
    !Number.isFinite(a.amount) ||
    !Number.isInteger(a.amount)
  ) {
    return 'award.amount must be a finite integer';
  }
  if (a.mode === 'add' && a.amount < 1) {
    return 'add awards require amount >= 1';
  }
  if (a.mode === 'set' && a.amount < 0) {
    return 'set awards require amount >= 0';
  }
  if (
    typeof a.awardedAt !== 'string' ||
    a.awardedAt.length > XP_AWARD_DATE_MAX_LENGTH ||
    Number.isNaN(Date.parse(a.awardedAt))
  ) {
    return 'award.awardedAt must be a valid ISO date string';
  }
  return null;
}
