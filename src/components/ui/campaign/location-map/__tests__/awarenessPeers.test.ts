import { describe, it, expect } from 'vitest';
import type { Peer } from '@fieldnotes/core';
import { summarizePeers } from '../awarenessPeers';

function peer(p: Partial<Peer> & { from: string; id: string }): Peer {
  return { cursor: null, selection: [], tool: null, ...p };
}

describe('summarizePeers', () => {
  it('dedupes by id preferring the newest row (later socket wins) and keeps hasCursor from it', () => {
    const rows = [
      peer({
        from: 'c1',
        id: 'char-a',
        name: 'Old',
        role: 'player',
        cursor: { x: 1, y: 1 },
      }),
      peer({ from: 'c7', id: 'char-a', name: 'New', role: 'player' }),
    ];
    const out = summarizePeers(rows, new Set(['char-a']));
    expect(out).toEqual([
      {
        id: 'char-a',
        name: 'New',
        role: 'player',
        hasCursor: false,
        verified: true,
      },
    ]);
  });

  it('sorts dm → players by name → display, marks unknown player ids unverified, and never invents names', () => {
    const rows = [
      peer({
        from: 'c3',
        id: 'display-X',
        name: 'TV display',
        role: 'display',
      }),
      peer({ from: 'c2', id: 'char-z', name: 'Zed', role: 'player' }),
      peer({ from: 'c5', id: 'char-q', role: 'player' }),
      peer({ from: 'c1', id: 'dm-1', name: 'DM', role: 'dm' }),
      peer({ from: 'c9', id: 'ghost', name: 'x', role: 'admin' }),
    ];
    const out = summarizePeers(rows, new Set(['char-z']));
    expect(out.map(s => [s.id, s.role, s.verified, s.name])).toEqual([
      ['dm-1', 'dm', true, 'DM'],
      ['char-q', 'player', false, ''],
      ['char-z', 'player', true, 'Zed'],
      ['display-X', 'display', true, 'TV display'],
      ['ghost', 'unknown', true, 'x'],
    ]);
  });

  it('with no directory (null) every player row is unverified', () => {
    const out = summarizePeers(
      [peer({ from: 'c1', id: 'char-a', role: 'player' })],
      null
    );
    expect(out[0]?.verified).toBe(false);
  });
});
