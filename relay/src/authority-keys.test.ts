import { describe, expect, it } from 'vitest';

import {
  authorityRoomKeys,
  tableAuthorityChallengeKey,
  tableCampaignTag,
  tableControlKey,
  tableRegistryKey,
} from './authority-keys.js';

describe('relay Table v1 key parity', () => {
  it('matches the app fixed vectors', () => {
    expect(tableCampaignTag('ABC123')).toBe(
      '{rk-table-v1:e0bebd22819993425814866b62701e2919ea26f1370499c1037b53b9d49c2c8a}'
    );
    expect(tableCampaignTag('abc_123-X')).toBe(
      '{rk-table-v1:e4138db1fe4e00d87d47ec20d2fd83b596cea1c9a1d06e3b7dbc167354751442}'
    );
  });

  it('declares a unique, single-tag full authority key set', () => {
    const campaign = 'ABC123';
    const room = '123e4567-e89b-42d3-a456-426614174000';
    const keys = [
      tableControlKey(campaign),
      tableRegistryKey(campaign),
      ...Object.values(authorityRoomKeys(campaign, room)),
    ];
    const tag = tableCampaignTag(campaign);
    expect(keys).toHaveLength(new Set(keys).size);
    expect(keys.every(key => key.includes(tag))).toBe(true);
  });

  it('matches the canonical fixed room suffix vector byte-for-byte', () => {
    const campaign = 'ABC123';
    const room = '123e4567-e89b-42d3-a456-426614174000';
    const tag = tableCampaignTag(campaign);
    expect(authorityRoomKeys(campaign, room)).toEqual({
      fogMeta: `campaign:${tag}:room:${room}:fog:meta`,
      fogTiles: `campaign:${tag}:room:${room}:fog:tiles`,
      meta: `campaign:${tag}:room:${room}:meta`,
      elements: `campaign:${tag}:room:${room}:elements`,
      ownership: `campaign:${tag}:room:${room}:ownership`,
      layers: `campaign:${tag}:room:${room}:layers`,
      dedupe: `campaign:${tag}:room:${room}:dedupe`,
      dedupeOrder: `campaign:${tag}:room:${room}:dedupe-order`,
      receipts: `campaign:${tag}:room:${room}:receipts`,
      history: `campaign:${tag}:room:${room}:history`,
      evidence: `campaign:${tag}:room:${room}:evidence`,
      outbox: `campaign:${tag}:room:${room}:outbox`,
      outboxClaims: `campaign:${tag}:room:${room}:outbox-claims`,
      playerRate: `campaign:${tag}:room:${room}:player-rate`,
    });
  });

  it('matches the app UUID-addressed authority challenge key', () => {
    const campaign = 'ABC123';
    const challengeId = '123e4567-e89b-42d3-a456-426614174000';
    expect(tableAuthorityChallengeKey(campaign, challengeId)).toBe(
      `campaign:${tableCampaignTag(campaign)}:table-authority-challenge:${challengeId}`
    );
    expect(() => tableAuthorityChallengeKey(campaign, 'not-a-uuid')).toThrow();
  });
});
