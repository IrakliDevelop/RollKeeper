import { describe, expect, it } from 'vitest';

import {
  applyCanonicalRemaining,
  sanitizePublicMarkers,
} from './sanitizePublicMarkers';

import type {
  MarkerLootLedgerEntry,
  PublicMarkerDetail,
} from '@/types/battlemap';

const validMarker = {
  id: 'marker-1',
  title: 'A Chest',
  body: 'It is closed.',
  status: 'closed',
};

describe('sanitizePublicMarkers — adversarial private-field stripping', () => {
  it('strips a smuggled portal field', () => {
    const input = Object.freeze([
      Object.freeze({
        ...validMarker,
        portal: { v: 1, kind: 'battlemap', id: 'SMUGGLED-PORTAL-TARGET' },
      }),
    ]);

    expect(() => sanitizePublicMarkers(input)).not.toThrow();
    const result = sanitizePublicMarkers(input);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect('portal' in result![0]).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SMUGGLED-PORTAL-TARGET');
    // Input untouched.
    expect((input[0] as { portal?: unknown }).portal).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'SMUGGLED-PORTAL-TARGET',
    });
  });

  it('strips a smuggled dmNotes field', () => {
    const input = [{ ...validMarker, dmNotes: 'SECRET-DM-NOTES' }];

    const result = sanitizePublicMarkers(input);

    expect(result).not.toBeNull();
    expect('dmNotes' in result![0]).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SECRET-DM-NOTES');
  });

  it('strips unknown target, pathname, campaignCode, and externalUrl fields', () => {
    const input = [
      {
        ...validMarker,
        target: 'SMUGGLED-TARGET',
        pathname: '/dm/campaign/SMUGGLED-CODE/battlemaps/SMUGGLED-MAP-ID',
        campaignCode: 'SMUGGLED-CAMPAIGN-CODE',
        externalUrl: 'https://evil.example/SMUGGLED-URL',
      },
    ];

    const result = sanitizePublicMarkers(input);

    expect(result).not.toBeNull();
    expect(Object.keys(result![0]).sort()).toEqual([
      'body',
      'id',
      'status',
      'title',
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('SMUGGLED-TARGET');
    expect(serialized).not.toContain('SMUGGLED-CODE');
    expect(serialized).not.toContain('SMUGGLED-MAP-ID');
    expect(serialized).not.toContain('SMUGGLED-CAMPAIGN-CODE');
    expect(serialized).not.toContain('SMUGGLED-URL');
  });

  it('strips a smuggled item definition inside a loot entry', () => {
    const input = [
      {
        ...validMarker,
        loot: [
          {
            id: 'entry-1',
            name: 'Potion',
            itemKind: 'inventory',
            quantity: 1,
            remainingQuantity: 1,
            item: { id: 'PRIVATE-ITEM-ID', name: 'Potion', tags: ['SECRET'] },
          },
        ],
      },
    ];

    const result = sanitizePublicMarkers(input);

    expect(result).not.toBeNull();
    expect('item' in (result![0].loot?.[0] ?? {})).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('PRIVATE-ITEM-ID');
    expect(serialized).not.toContain('SECRET');
  });

  it('does not mutate its input while stripping', () => {
    const input = Object.freeze([
      Object.freeze({
        ...validMarker,
        portal: { v: 1, kind: 'location', id: 'target-1' },
        dmNotes: 'notes',
        unknownFutureField: 'unknown',
      }),
    ]);

    expect(() => sanitizePublicMarkers(input)).not.toThrow();
    // Re-run against the same frozen input to double-check no first-call
    // side effect changed its shape for a second read.
    const first = sanitizePublicMarkers(input);
    const second = sanitizePublicMarkers(input);
    expect(first).toEqual(second);
  });
});

describe('sanitizePublicMarkers — validation', () => {
  it('rejects a non-array value', () => {
    expect(sanitizePublicMarkers({ id: 'not-an-array' })).toBeNull();
    expect(sanitizePublicMarkers(null)).toBeNull();
    expect(sanitizePublicMarkers(undefined)).toBeNull();
  });

  it('rejects an array containing a non-object entry', () => {
    expect(sanitizePublicMarkers([validMarker, 'not-an-object'])).toBeNull();
  });

  it('rejects a marker missing required string fields', () => {
    expect(sanitizePublicMarkers([{ title: 'x', body: 'y' }])).toBeNull();
  });

  it('rejects a marker with an unrecognized status', () => {
    expect(
      sanitizePublicMarkers([{ ...validMarker, status: 'not-a-status' }])
    ).toBeNull();
  });

  it('accepts a valid marker with no status and no loot', () => {
    const result = sanitizePublicMarkers([{ id: 'm1', title: 't', body: 'b' }]);
    expect(result).toEqual([{ id: 'm1', title: 't', body: 'b' }]);
  });

  it('drops malformed loot entries but keeps the marker', () => {
    const result = sanitizePublicMarkers([
      {
        ...validMarker,
        loot: [
          { id: 'bad-entry' /* missing name/itemKind/quantities */ },
          {
            id: 'entry-1',
            name: 'Potion',
            itemKind: 'inventory',
            quantity: 1,
            remainingQuantity: 1,
          },
        ],
      },
    ]);

    expect(result![0].loot).toEqual([
      {
        id: 'entry-1',
        name: 'Potion',
        itemKind: 'inventory',
        quantity: 1,
        remainingQuantity: 1,
      },
    ]);
  });
});

describe('PublicMarkerDetail — portal is structurally unassignable (type-level)', () => {
  it('rejects a portal value at compile time; a stripped runtime shape still type-checks (positive control)', () => {
    const smuggled: PublicMarkerDetail = {
      id: 'marker-1',
      title: 'Chest',
      body: 'body',
      // @ts-expect-error PublicMarkerDetail.portal is `never` — DM-only
      // portal navigation data must never type-check onto the public
      // projection. If a future edit widens `portal` back to an optional
      // type, this directive stops being an error and `npm run type-check`
      // fails with "Unused '@ts-expect-error' directive" — a loud,
      // build-breaking signal rather than a silent regression. See
      // markerPortal.ts's "Deferred follow-ups" note and
      // src/types/battlemap.ts's `portal?: never` doc comment.
      portal: { v: 1, kind: 'battlemap', id: 'SMUGGLED-MAP-ID' },
    };
    expect(smuggled).toBeDefined();

    // Positive control: proves the assignment above fails BECAUSE of
    // `portal`, not for some unrelated reason (e.g. a missing required
    // field) — the identical object minus `portal` type-checks cleanly.
    const clean: PublicMarkerDetail = {
      id: 'marker-1',
      title: 'Chest',
      body: 'body',
    };
    expect(clean).toBeDefined();
  });
});

describe('applyCanonicalRemaining', () => {
  it('re-derives remainingQuantity from the ledger and never emits portal or dmNotes', () => {
    const markers: PublicMarkerDetail[] = [
      {
        id: 'marker-1',
        title: 'Chest',
        body: 'body',
        loot: [
          {
            id: 'entry-1',
            name: 'Potion',
            itemKind: 'inventory',
            quantity: 5,
            remainingQuantity: 999, // caller-claimed count must be ignored
          },
        ],
      },
    ];
    const ledger: MarkerLootLedgerEntry[] = [
      {
        markerId: 'marker-1',
        id: 'entry-1',
        itemKind: 'inventory',
        item: {
          id: 'item-1',
          name: 'Potion',
          category: 'consumable',
          quantity: 5,
          location: 'Backpack',
          tags: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        quantity: 5,
        claimedQuantity: 2,
      },
    ];

    const result = applyCanonicalRemaining(markers, ledger);

    expect(result[0].loot?.[0].remainingQuantity).toBe(3);
    expect('portal' in result[0]).toBe(false);
    expect('dmNotes' in result[0]).toBe(false);
    expect(Object.keys(result[0]).sort()).toEqual([
      'body',
      'id',
      'loot',
      'title',
    ]);
  });

  it('never mutates the input markers array', () => {
    const markers: PublicMarkerDetail[] = Object.freeze([
      Object.freeze({
        id: 'marker-1',
        title: 'Chest',
        body: 'body',
      }),
    ]) as unknown as PublicMarkerDetail[];

    expect(() => applyCanonicalRemaining(markers, [])).not.toThrow();
  });
});
