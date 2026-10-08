import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  tableAuthorityChallengeKey,
  tableAuthorityRoomKeys,
  tableCampaignTag,
  tableCompatibilityKey,
  tableControlKey,
  tableDisplayAckKey,
  tableDisplaySessionKey,
  tableLedgerKey,
  tableLedgerOrderKey,
  tableRegistryKey,
} from './keys';
import { authorityRoomKeys as relayAuthorityRoomKeys } from '../../../relay/src/authority-keys';

const VECTORS = [
  [
    'ABC123',
    'e0bebd22819993425814866b62701e2919ea26f1370499c1037b53b9d49c2c8a',
  ],
  [
    'abc_123-X',
    'e4138db1fe4e00d87d47ec20d2fd83b596cea1c9a1d06e3b7dbc167354751442',
  ],
] as const;

describe('Table v1 campaign keys', () => {
  it.each(VECTORS)(
    'uses the canonical exact-byte SHA-256 tag for %s',
    (code, hash) => {
      expect(tableCampaignTag(code)).toBe(`{rk-table-v1:${hash}}`);
      expect(hash).toBe(
        createHash('sha256').update(Buffer.from(code, 'utf8')).digest('hex')
      );
    }
  );

  it('does not trim or case-fold and rejects invalid campaign codes', () => {
    expect(tableCampaignTag('ABC123')).not.toBe(tableCampaignTag('abc123'));
    expect(() => tableCampaignTag(' ABC123')).toThrow();
    expect(() => tableCampaignTag('ABC123 ')).toThrow();
    expect(() => tableCampaignTag('')).toThrow();
    expect(() => tableCampaignTag('a'.repeat(65))).toThrow();
    expect(() => tableCampaignTag('café')).toThrow();
  });

  it('puts every current app-side Table key in the same hash tag', () => {
    const tag = tableCampaignTag('ABC123');
    const keys = [
      tableControlKey('ABC123'),
      tableRegistryKey('ABC123'),
      tableLedgerKey('ABC123'),
      tableLedgerOrderKey('ABC123'),
      tableAuthorityChallengeKey(
        'ABC123',
        '123e4567-e89b-42d3-a456-426614174000'
      ),
      tableCompatibilityKey('ABC123', 'initiative'),
      tableCompatibilityKey('ABC123', 'battlemap'),
      tableCompatibilityKey('ABC123', 'initiativeRequest'),
      tableDisplaySessionKey('ABC123'),
      tableDisplayAckKey('ABC123'),
      ...Object.values(
        tableAuthorityRoomKeys('ABC123', '123e4567-e89b-42d3-a456-426614174000')
      ),
    ];
    expect(keys).toHaveLength(new Set(keys).size);
    expect(keys.every(key => key.includes(tag))).toBe(true);
  });

  it('names the PR05 display binding and ACK keys in the campaign slot', () => {
    const tag = tableCampaignTag('ABC123');
    expect(tableDisplaySessionKey('ABC123')).toBe(
      `campaign:${tag}:display-session`
    );
    expect(tableDisplayAckKey('ABC123')).toBe(`campaign:${tag}:display-ack`);
    expect(() => tableDisplaySessionKey('bad code')).toThrow();
  });

  it('uses a validated UUID-addressed same-slot authority challenge key', () => {
    const challengeId = '123e4567-e89b-42d3-a456-426614174000';
    const tag = tableCampaignTag('ABC123');
    expect(tableAuthorityChallengeKey('ABC123', challengeId)).toBe(
      `campaign:${tag}:table-authority-challenge:${challengeId}`
    );
    expect(() => tableAuthorityChallengeKey('ABC123', 'not-a-uuid')).toThrow();
  });

  it('is byte-identical to the relay authority-room contract for every suffix', () => {
    const code = 'ABC123';
    const room = '123e4567-e89b-42d3-a456-426614174000';
    const tag = tableCampaignTag(code);
    const expected = {
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
    };
    expect(tableAuthorityRoomKeys(code, room)).toEqual(expected);
    expect(relayAuthorityRoomKeys(code, room)).toEqual(expected);
  });
});
