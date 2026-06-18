import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockRedis,
  resetRedis,
  seedRedis,
  seedRedisSet,
} from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCampaignData,
  createMockPlayerData,
} from '@/test/helpers';
import { GET } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@upstash/redis', () => ({ Redis: vi.fn(() => mockRedis) }));

describe('GET /api/campaign/[code]/party-hp', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('returns 404 when campaign does not exist', async () => {
    const req = createNextRequest('/api/campaign/MISSING/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'MISSING' })
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Campaign not found');
  });

  it('returns empty members array when campaign has no players', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', []);

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toEqual([]);
  });

  it('returns empty members array when only __init__ is present', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['__init__']);

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toEqual([]);
  });

  it('returns HP data for all players in campaign', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['__init__', 'player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        playerId: 'player-1',
        playerName: 'Alice',
        characterId: 'char-1',
        characterName: 'Elara',
        characterData: {
          ...createMockPlayerData().characterData,
          hitPoints: {
            current: 30,
            max: 44,
            temporary: 5,
            calculationMode: 'auto',
          },
          armorClass: 16,
          isTempACActive: false,
          isWearingShield: false,
          shieldBonus: 2,
        },
        lastSynced: '2025-01-01T12:00:00.000Z',
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(1);
    const member = data.members[0];
    expect(member.characterId).toBe('char-1');
    expect(member.characterName).toBe('Elara');
    expect(member.playerName).toBe('Alice');
    expect(member.hitPoints).not.toBeNull();
    expect(member.hitPoints.current).toBe(30);
    expect(member.hitPoints.max).toBe(44);
    expect(member.hitPoints.temporary).toBe(5);
    expect(member.armorClass).toBe(16);
    expect(member.lastSynced).toBe('2025-01-01T12:00:00.000Z');
  });

  it('returns HP data for multiple players sorted by character name', async () => {
    seedRedis('campaign:MULTI', createMockCampaignData());
    seedRedisSet('campaign:MULTI:players', ['player-1', 'player-2']);
    seedRedis(
      'campaign:MULTI:player:player-1',
      createMockPlayerData({
        playerId: 'player-1',
        playerName: 'Bob',
        characterId: 'char-b',
        characterName: 'Zephyr',
      })
    );
    seedRedis(
      'campaign:MULTI:player:player-2',
      createMockPlayerData({
        playerId: 'player-2',
        playerName: 'Carol',
        characterId: 'char-c',
        characterName: 'Aria',
      })
    );

    const req = createNextRequest('/api/campaign/MULTI/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'MULTI' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(2);
    // Should be sorted alphabetically by characterName
    expect(data.members[0].characterName).toBe('Aria');
    expect(data.members[1].characterName).toBe('Zephyr');
  });

  it('hides HP when shareHpWithParty is false', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          shareHpWithParty: false,
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(1);
    expect(data.members[0].hitPoints).toBeNull();
  });

  it('shows HP when shareHpWithParty is true', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          shareHpWithParty: true,
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(1);
    expect(data.members[0].hitPoints).not.toBeNull();
  });

  it('shows HP by default when shareHpWithParty is undefined', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          shareHpWithParty: undefined,
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members[0].hitPoints).not.toBeNull();
  });

  it('stacks temp AC on base AC when isTempACActive is true', async () => {
    // Matches the canonical calculateCharacterArmorClass / character-sheet
    // behavior: temp AC is additive (base 14 + temp 20 = 34), not a replacement.
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          armorClass: 14,
          isTempACActive: true,
          tempArmorClass: 20,
          isWearingShield: false,
          shieldBonus: 2,
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members[0].armorClass).toBe(34);
  });

  it('adds shield bonus to AC when isWearingShield is true', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          armorClass: 16,
          isTempACActive: false,
          tempArmorClass: 0,
          isWearingShield: true,
          shieldBonus: 2,
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members[0].armorClass).toBe(18);
  });

  it('includes active AC buffs (e.g. Haste +2) in the reported AC', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          armorClass: 16,
          isTempACActive: false,
          tempArmorClass: 0,
          isWearingShield: false,
          shieldBonus: 2,
          temporaryBuffs: [
            {
              id: 'buff-haste',
              name: 'Haste',
              effects: [
                {
                  id: 'eff-1',
                  targetStat: 'ac',
                  mode: 'add',
                  value: 2,
                },
              ],
              isActive: true,
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members[0].armorClass).toBe(18);
  });

  it('uses multiclass level sum when classes array is present', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    seedRedisSet('campaign:ABC123:players', ['player-1']);
    seedRedis(
      'campaign:ABC123:player:player-1',
      createMockPlayerData({
        characterData: {
          ...createMockPlayerData().characterData,
          level: 5,
          classes: [
            { className: 'Fighter', level: 3, isCustom: false, hitDie: 10 },
            { className: 'Rogue', level: 2, isCustom: false, hitDie: 8 },
          ],
        },
      })
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members[0].level).toBe(5);
    expect(data.members[0].className).toBe('Fighter');
  });

  it('handles missing player data gracefully (null pipeline result)', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    // player-1 is in the set but has no corresponding data key
    seedRedisSet('campaign:ABC123:players', ['player-1', 'player-2']);
    seedRedis(
      'campaign:ABC123:player:player-2',
      createMockPlayerData({
        playerId: 'player-2',
        playerName: 'Dave',
        characterId: 'char-2',
        characterName: 'Gandalf',
      })
    );
    // player-1 has no data — pipeline will return null for it

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    // Only player-2 should appear; null result for player-1 is skipped
    expect(data.members).toHaveLength(1);
    expect(data.members[0].playerName).toBe('Dave');
  });

  it('returns 500 on Redis error', async () => {
    seedRedis('campaign:ABC123', createMockCampaignData());
    mockRedis.smembers.mockRejectedValueOnce(
      new Error('Redis connection failed')
    );

    const req = createNextRequest('/api/campaign/ABC123/party-hp');
    const res = await GET(
      req as NextRequest,
      createRouteParams({ code: 'ABC123' })
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch party HP data');
  });
});
