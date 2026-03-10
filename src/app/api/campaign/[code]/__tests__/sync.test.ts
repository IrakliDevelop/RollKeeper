import { describe, it, expect, beforeEach } from 'vitest';
import { resetRedis, getRedisStore, getRedisSet } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCharacterState,
} from '@/test/helpers';
import { POST } from '../sync/route';
import { NextRequest } from 'next/server';

describe('POST /api/campaign/[code]/sync', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('syncs player data and returns success', async () => {
    const charData = createMockCharacterState();
    const req = createNextRequest('/api/campaign/ABC123/sync', {
      method: 'POST',
      body: {
        playerId: 'player-1',
        playerName: 'Alice',
        characterId: 'char-1',
        characterName: 'Thorn',
        characterData: charData,
      },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.lastSynced).toBeDefined();

    const stored = getRedisStore().get('campaign:ABC123:player:player-1');
    expect(stored).toBeDefined();

    const playerSet = getRedisSet('campaign:ABC123:players');
    expect(playerSet.has('player-1')).toBe(true);
  });

  it('works even when campaign key is missing (resilient)', async () => {
    const req = createNextRequest('/api/campaign/MISSING/sync', {
      method: 'POST',
      body: {
        playerId: 'player-1',
        characterData: createMockCharacterState(),
      },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'MISSING' })
    );
    expect(res.status).toBe(200);

    const stored = getRedisStore().get('campaign:MISSING:player:player-1');
    expect(stored).toBeDefined();
  });

  it('returns 400 when playerId is missing', async () => {
    const req = createNextRequest('/api/campaign/ABC123/sync', {
      method: 'POST',
      body: { characterData: createMockCharacterState() },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when characterData is missing', async () => {
    const req = createNextRequest('/api/campaign/ABC123/sync', {
      method: 'POST',
      body: { playerId: 'player-1' },
    });

    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    expect(res.status).toBe(400);
  });

  it('defaults playerName to "Unknown Player" when not provided', async () => {
    const req = createNextRequest('/api/campaign/ABC123/sync', {
      method: 'POST',
      body: {
        playerId: 'player-1',
        characterData: createMockCharacterState(),
      },
    });

    await POST(req as NextRequest, createRouteParams({ code: 'ABC123' }));

    const stored = getRedisStore().get('campaign:ABC123:player:player-1');
    const parsed = JSON.parse(stored!);
    expect(parsed.playerName).toBe('Unknown Player');
  });
});
