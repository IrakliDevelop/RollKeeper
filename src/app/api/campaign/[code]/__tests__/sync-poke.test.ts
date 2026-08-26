import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetRedis, seedRedis } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCharacterState,
} from '@/test/helpers';
import { NextRequest } from 'next/server';

vi.mock('@/lib/relayPoke', () => ({
  sendBattleMapPoke: vi.fn(async () => {}),
}));

import { sendBattleMapPoke } from '@/lib/relayPoke';
import { POST } from '../sync/route';

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

describe('POST /api/campaign/[code]/sync — players poke', () => {
  beforeEach(() => {
    resetRedis();
    vi.mocked(sendBattleMapPoke).mockClear();
  });

  it('pokes feature "players" after an accepted write', async () => {
    const res = await push({ ...createMockCharacterState(), revision: 1 });
    expect(res.status).toBe(200);
    expect(sendBattleMapPoke).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendBattleMapPoke).mock.calls[0][0]).toBe('ABC123');
    expect(vi.mocked(sendBattleMapPoke).mock.calls[0][2]).toBe('players');
  });

  it('does not poke on a stale 409 push', async () => {
    await push({ ...createMockCharacterState(), revision: 5 });
    vi.mocked(sendBattleMapPoke).mockClear();
    const res = await push({ ...createMockCharacterState(), revision: 1 });
    expect(res.status).toBe(409);
    expect(sendBattleMapPoke).not.toHaveBeenCalled();
  });

  it('does not poke on 410 (removed player)', async () => {
    seedRedis('campaign:ABC123:removed:player-1', '1');
    const res = await push(createMockCharacterState());
    expect(res.status).toBe(410);
    expect(sendBattleMapPoke).not.toHaveBeenCalled();
  });
});
