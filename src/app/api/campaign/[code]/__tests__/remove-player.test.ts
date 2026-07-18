import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetRedis,
  seedRedis,
  seedRedisSet,
  getRedisStore,
  getRedisSet,
} from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCampaignData,
  createMockPlayerData,
} from '@/test/helpers';
import { DELETE } from '../players/[playerId]/route';
import { NextRequest } from 'next/server';

function seedCampaignWithPlayers() {
  // createMockCampaignData() has dmId: 'dm-test-123'
  seedRedis('campaign:ABC123', createMockCampaignData());
  seedRedisSet('campaign:ABC123:players', ['player-1', 'player-2']);
  seedRedis('campaign:ABC123:player:player-1', createMockPlayerData());
  seedRedis('campaign:ABC123:messages:player-1', '[]');
  seedRedis('campaign:ABC123:effects:player-1', '[]');
  seedRedis('campaign:ABC123:transfers:player-1', '[]');
}

function removeRequest(body: unknown) {
  return createNextRequest('/api/campaign/ABC123/players/player-1', {
    method: 'DELETE',
    body,
  }) as NextRequest;
}

const routeParams = () =>
  createRouteParams({ code: 'ABC123', playerId: 'player-1' });

describe('DELETE /api/campaign/[code]/players/[playerId]', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('DM removes a player: deletes all per-player keys and sets removal marker', async () => {
    seedCampaignWithPlayers();

    const res = await DELETE(
      removeRequest({ dmId: 'dm-test-123' }),
      routeParams()
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    expect(getRedisSet('campaign:ABC123:players').has('player-1')).toBe(false);
    expect(getRedisSet('campaign:ABC123:players').has('player-2')).toBe(true);
    expect(getRedisStore().has('campaign:ABC123:player:player-1')).toBe(false);
    expect(getRedisStore().has('campaign:ABC123:messages:player-1')).toBe(
      false
    );
    expect(getRedisStore().has('campaign:ABC123:effects:player-1')).toBe(false);
    expect(getRedisStore().has('campaign:ABC123:transfers:player-1')).toBe(
      false
    );
    expect(getRedisStore().has('campaign:ABC123:removed:player-1')).toBe(true);
  });

  it('player removes self when body playerId matches path', async () => {
    seedCampaignWithPlayers();

    const res = await DELETE(
      removeRequest({ playerId: 'player-1' }),
      routeParams()
    );

    expect(res.status).toBe(200);
    expect(getRedisSet('campaign:ABC123:players').has('player-1')).toBe(false);
    expect(getRedisStore().has('campaign:ABC123:removed:player-1')).toBe(true);
  });

  it('returns 403 for wrong dmId', async () => {
    seedCampaignWithPlayers();

    const res = await DELETE(
      removeRequest({ dmId: 'dm-wrong' }),
      routeParams()
    );

    expect(res.status).toBe(403);
    expect(getRedisSet('campaign:ABC123:players').has('player-1')).toBe(true);
  });

  it('returns 403 when body playerId does not match path playerId', async () => {
    seedCampaignWithPlayers();

    const res = await DELETE(
      removeRequest({ playerId: 'player-2' }),
      routeParams()
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when campaign is missing (dm path)', async () => {
    const res = await DELETE(
      removeRequest({ dmId: 'dm-test-123' }),
      routeParams()
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when campaign is missing (self path)', async () => {
    const res = await DELETE(
      removeRequest({ playerId: 'player-1' }),
      routeParams()
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when body has neither dmId nor playerId', async () => {
    seedCampaignWithPlayers();

    const res = await DELETE(removeRequest({}), routeParams());

    expect(res.status).toBe(400);
  });

  it('is idempotent: removing an already-removed player returns 200', async () => {
    seedCampaignWithPlayers();

    const first = await DELETE(
      removeRequest({ dmId: 'dm-test-123' }),
      routeParams()
    );
    expect(first.status).toBe(200);

    const second = await DELETE(
      removeRequest({ dmId: 'dm-test-123' }),
      routeParams()
    );
    expect(second.status).toBe(200);
  });
});
