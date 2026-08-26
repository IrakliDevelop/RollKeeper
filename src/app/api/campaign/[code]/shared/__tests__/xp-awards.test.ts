import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resetRedis,
  seedRedis,
  seedRedisSet,
  seedRedisList,
  getRedisLists,
  mockRedis,
} from '@/test/mocks/redis';
import { createNextRequest, createRouteParams } from '@/test/helpers';
import { GET, POST, DELETE } from '../route';
import { NextRequest } from 'next/server';
import type { DmXpAward, DmXpAwardEnvelope } from '@/types/sharedState';

const CODE = 'XPTEST';
const DM_ID = 'dm-1';
const PLAYER_ID = 'player-1';
const xpKey = `campaign:${CODE}:xp:${PLAYER_ID}`;

function makeAward(overrides: Partial<DmXpAward> = {}): DmXpAward {
  return {
    id: 'award-1',
    mode: 'add',
    amount: 300,
    awardedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
}

function postXp(award: unknown, playerId = PLAYER_ID, dmId = DM_ID) {
  const req = createNextRequest(`/api/campaign/${CODE}/shared`, {
    method: 'POST',
    body: { feature: 'xp', data: { playerId, award }, dmId },
  });
  return POST(req as NextRequest, createRouteParams({ code: CODE }));
}

function getShared() {
  const req = new NextRequest(
    `http://localhost/api/campaign/${CODE}/shared?role=player&playerId=${PLAYER_ID}`
  );
  return GET(req, createRouteParams({ code: CODE }));
}

function deleteXp(receipt: unknown) {
  const req = createNextRequest(`/api/campaign/${CODE}/shared`, {
    method: 'DELETE',
    body: { playerId: PLAYER_ID, type: 'xp', receipt },
  });
  return DELETE(req as NextRequest, createRouteParams({ code: CODE }));
}

beforeEach(() => {
  resetRedis();
  seedRedis(`campaign:${CODE}`, { dmId: DM_ID, name: 'Test' });
  seedRedisSet(`campaign:${CODE}:players`, [PLAYER_ID]);
});

describe('POST feature=xp', () => {
  it('enqueues a valid award', async () => {
    const res = await postXp(makeAward());
    expect(res.status).toBe(200);
    const list = getRedisLists().get(xpKey)!;
    expect(list).toHaveLength(1);
    expect(JSON.parse(list[0])).toEqual(makeAward());
  });

  it.each([
    ['bad mode', makeAward({ mode: 'grant' as never })],
    ['non-integer amount', makeAward({ amount: 1.5 })],
    ['non-finite amount', makeAward({ amount: Infinity })],
    ['add with 0', makeAward({ amount: 0 })],
    ['set with -1', makeAward({ mode: 'set', amount: -1 })],
    ['empty id', makeAward({ id: '' })],
    ['oversize id', makeAward({ id: 'x'.repeat(65) })],
    ['malformed date', makeAward({ awardedAt: 'not-a-date' })],
    ['oversize date', makeAward({ awardedAt: '2026'.repeat(11) })],
  ])('rejects %s with 400', async (_label, award) => {
    const res = await postXp(award);
    expect(res.status).toBe(400);
    expect(getRedisLists().get(xpKey)).toBeUndefined();
  });

  it('set with 0 is valid', async () => {
    const res = await postXp(makeAward({ mode: 'set', amount: 0 }));
    expect(res.status).toBe(200);
  });

  it('rejects unknown playerId with 400 and creates no key', async () => {
    const res = await postXp(makeAward(), 'stranger');
    expect(res.status).toBe(400);
    expect(getRedisLists().get(`campaign:${CODE}:xp:stranger`)).toBeUndefined();
  });

  it('rejects a non-DM caller with 403', async () => {
    const res = await postXp(makeAward(), PLAYER_ID, 'imposter');
    expect(res.status).toBe(403);
  });

  it('preserves enqueue order and rejects at the cap atomically', async () => {
    seedRedisList(
      xpKey,
      Array.from({ length: 99 }, (_, i) =>
        JSON.stringify(makeAward({ id: `seed-${i}`, amount: 1 }))
      )
    );
    const [a, b] = await Promise.all([
      postXp(makeAward({ id: 'race-a' })),
      postXp(makeAward({ id: 'race-b' })),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]); // exactly one landed
    expect(getRedisLists().get(xpKey)).toHaveLength(100);
  });

  it('responds 500 when the EVAL reply is neither "ok" nor "full"', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockRedis.eval.mockResolvedValueOnce('unexpected-reply' as never);
    const res = await postXp(makeAward());
    expect(res.status).toBe(500);
    expect(getRedisLists().get(xpKey)).toBeUndefined();
    consoleErrorSpy.mockRestore();
  });
});

describe('GET xpAwards', () => {
  it('returns awards with receipts equal to the stored strings, in order', async () => {
    await postXp(makeAward({ id: 'first', mode: 'set', amount: 900 }));
    await postXp(makeAward({ id: 'second', amount: 50 }));
    const res = await getShared();
    const body = await res.json();
    const awards: DmXpAwardEnvelope[] = body.xpAwards;
    expect(awards.map(e => e.award.id)).toEqual(['first', 'second']);
    const stored = getRedisLists().get(xpKey)!;
    expect(awards.map(e => e.receipt)).toEqual(stored);
  });

  it('removes malformed entries during GET and does not return them', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    seedRedisList(xpKey, [
      'not json at all',
      JSON.stringify(makeAward({ id: 'good' })),
    ]);
    const res = await getShared();
    const body = await res.json();
    expect(body.xpAwards.map((e: DmXpAwardEnvelope) => e.award.id)).toEqual([
      'good',
    ]);
    expect(getRedisLists().get(xpKey)).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Removed malformed XP award entry',
      expect.any(Object)
    );
    consoleErrorSpy.mockRestore();
  });

  it('removes parseable JSON entries that fail full award validation', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    seedRedisList(xpKey, [
      JSON.stringify(makeAward({ id: 'bad', amount: 'oops' as never })),
      JSON.stringify(makeAward({ id: 'good' })),
    ]);

    const res = await getShared();
    const body = await res.json();

    expect(body.xpAwards.map((e: DmXpAwardEnvelope) => e.award.id)).toEqual([
      'good',
    ]);
    expect(getRedisLists().get(xpKey)).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Removed malformed XP award entry',
      expect.any(Object)
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns an empty array when no queue exists', async () => {
    const res = await getShared();
    const body = await res.json();
    expect(body.xpAwards).toEqual([]);
  });
});

describe('DELETE type=xp', () => {
  it('removes exactly one matching entry by receipt', async () => {
    await postXp(makeAward({ id: 'a' }));
    await postXp(makeAward({ id: 'b' }));
    const stored = getRedisLists().get(xpKey)!;
    const receiptA = stored[0];
    const res = await deleteXp(receiptA);
    expect(res.status).toBe(200);
    const after = getRedisLists().get(xpKey)!;
    expect(after).toHaveLength(1);
    expect(JSON.parse(after[0]).id).toBe('b');
  });

  it('ack of an already-removed receipt is safe', async () => {
    await postXp(makeAward({ id: 'a' }));
    const receipt = getRedisLists().get(xpKey)![0];
    await deleteXp(receipt);
    const res = await deleteXp(receipt);
    expect(res.status).toBe(200);
  });

  it('leaves the list empty when the queue empties, and refreshes expiry otherwise', async () => {
    await postXp(makeAward({ id: 'a' }));
    await postXp(makeAward({ id: 'b' }));
    const stored = [...getRedisLists().get(xpKey)!];
    mockRedis.expire.mockClear();
    await deleteXp(stored[0]);
    expect(getRedisLists().get(xpKey)).toHaveLength(1);
    expect(mockRedis.expire).toHaveBeenCalledWith(xpKey, expect.any(Number));
    mockRedis.expire.mockClear();
    await deleteXp(stored[1]);
    expect(getRedisLists().get(xpKey)).toHaveLength(0);
    // No explicit DEL on empty (would race a concurrent enqueue) — expiry is
    // simply not refreshed once nothing remains.
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('rejects a missing receipt with 400', async () => {
    const res = await deleteXp(undefined);
    expect(res.status).toBe(400);
  });
});
