import { describe, it, expect, beforeEach } from 'vitest';
import { resetRedis, getRedisStore } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCharacterState,
} from '@/test/helpers';
import { POST } from '../sync/route';
import { NextRequest } from 'next/server';

/**
 * Redis writes are revision-gated: a push whose characterData.revision is
 * OLDER than the stored blob's is rejected with 409 + the current blob
 * (the pusher was a stale tab — it must adopt, not clobber).
 */

async function push(characterData: unknown) {
  const req = createNextRequest('/api/campaign/ABC123/sync', {
    method: 'POST',
    body: {
      playerId: 'player-1',
      playerName: 'Alice',
      characterId: 'char-1',
      characterName: 'Thorn',
      characterData,
    },
  });
  return POST(req as NextRequest, createRouteParams({ code: 'ABC123' }));
}

function storedCharacter() {
  return JSON.parse(getRedisStore().get('campaign:ABC123:player:player-1')!)
    .characterData;
}

describe('POST /api/campaign/[code]/sync — revision gating', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('rejects a stale full-blob push with 409 and keeps the newer state', async () => {
    const base = createMockCharacterState();

    // Battlemap tab: cast a spell + took damage, pushed fresh state.
    const fresh = {
      ...base,
      revision: 2,
      spellSlots: { ...base.spellSlots, 1: { max: 2, used: 1 } },
      hitPoints: { ...base.hitPoints, current: 30, max: 44 },
    };
    const freshRes = await push(fresh);
    expect(freshRes.status).toBe(200);

    // Sheet tab: pre-combat stale copy pushes after an unrelated edit.
    const stale = {
      ...base,
      revision: 1,
      spellSlots: { ...base.spellSlots, 1: { max: 2, used: 0 } },
      hitPoints: { ...base.hitPoints, current: 44, max: 44 },
    };
    const staleRes = await push(stale);

    expect(staleRes.status).toBe(409);
    const body = await staleRes.json();
    expect(body.error).toBe('stale');
    expect(body.current.characterData.revision).toBe(2);

    expect(storedCharacter().spellSlots[1].used).toBe(1);
    expect(storedCharacter().hitPoints.current).toBe(30);
  });

  it('accepts an equal-revision re-push (idempotent retry)', async () => {
    const base = createMockCharacterState();
    await push({ ...base, revision: 3 });
    const res = await push({
      ...base,
      revision: 3,
      hitPoints: { ...base.hitPoints, current: 20, max: 44 },
    });
    expect(res.status).toBe(200);
    expect(storedCharacter().hitPoints.current).toBe(20);
  });

  it('accepts a payload with no revision when nothing is stored', async () => {
    const res = await push(createMockCharacterState());
    expect(res.status).toBe(200);
  });

  it('treats a missing incoming revision as 0 against a versioned blob', async () => {
    const base = createMockCharacterState();
    await push({ ...base, revision: 2 });
    const res = await push({ ...base }); // no revision → 0 < 2 → stale
    expect(res.status).toBe(409);
    expect(storedCharacter().revision).toBe(2);
  });
});
