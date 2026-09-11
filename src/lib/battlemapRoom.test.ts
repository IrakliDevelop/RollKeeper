import { describe, expect, it } from 'vitest';

import {
  BATTLE_MAP_RELAY_ROOM_PATTERN,
  battleMapRelayRoom,
} from '@/lib/battlemapRoom';

describe('battleMapRelayRoom', () => {
  it('derives a Fieldnotes-safe room shared by tokens, sockets, and pokes', () => {
    const room = battleMapRelayRoom('ABC123', 'bm-xyz');

    expect(room).toBe('ABC123_bm-xyz');
    expect(room).toMatch(BATTLE_MAP_RELAY_ROOM_PATTERN);
  });

  it.each([
    ['unsafe campaign punctuation', 'ABC:123', 'bm-xyz'],
    ['unsafe map punctuation', 'ABC123', 'bm/xyz'],
    ['a room longer than 64 characters', 'ABC123', `bm-${'x'.repeat(56)}`],
  ])('rejects %s', (_case, campaignCode, battleMapId) => {
    expect(() => battleMapRelayRoom(campaignCode, battleMapId)).toThrow(
      RangeError
    );
  });
});
