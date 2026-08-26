import { describe, expect, it } from 'vitest';

import { expectLibraryCallSequenceMatches } from './adapterConformance';

/**
 * Fix round 4, item 1: `campaign_settings` calls every wrapped library
 * function exactly once (a single-record family), so its own step-parity
 * run can never produce a sequence longer than 1 and cannot exercise a
 * divergence on a NON-final call end-to-end. These tests exercise
 * `expectLibraryCallSequenceMatches` directly, with constructed multi-call
 * sequences standing in for what a multi-record family's real run looks
 * like (npc/encounter_definition/magic_item/combat_log_archive call some
 * wrapped functions once per document), proving the full-sequence
 * comparison — not just last-call-wins — actually catches a mismatch
 * anywhere in the sequence, not only at the end.
 */
describe('expectLibraryCallSequenceMatches', () => {
  const FN = 'commitSomeFamilyDocument';

  it('passes when every call in the sequence matches', () => {
    const database = { fake: 'db-handle' };
    const cardCalls = {
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 1 } }],
        [database, { legacyId: 'two', payload: { a: 2 } }],
        [database, { legacyId: 'three', payload: { a: 3 } }],
      ],
    };
    const adapterCalls = {
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 1 } }],
        [database, { legacyId: 'two', payload: { a: 2 } }],
        [database, { legacyId: 'three', payload: { a: 3 } }],
      ],
    };
    expect(() =>
      expectLibraryCallSequenceMatches(FN, cardCalls, adapterCalls, 1, [])
    ).not.toThrow();
  });

  it('catches a divergence on the FIRST call of a three-call sequence', () => {
    const database = { fake: 'db-handle' };
    const cardCalls = {
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 1 } }],
        [database, { legacyId: 'two', payload: { a: 2 } }],
        [database, { legacyId: 'three', payload: { a: 3 } }],
      ],
    };
    const adapterCalls = {
      // The adapter's FIRST call silently sent the wrong payload — this is
      // exactly the shape of bug a per-document loop can introduce and a
      // last-call-wins comparison could never see, since the correct final
      // call would still match.
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 999 } }],
        [database, { legacyId: 'two', payload: { a: 2 } }],
        [database, { legacyId: 'three', payload: { a: 3 } }],
      ],
    };
    expect(() =>
      expectLibraryCallSequenceMatches(FN, cardCalls, adapterCalls, 1, [])
    ).toThrow(/call #0/);
  });

  it('catches a divergence on the MIDDLE call of a three-call sequence', () => {
    const database = { fake: 'db-handle' };
    const cardCalls = {
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 1 } }],
        [database, { legacyId: 'two', payload: { a: 2 } }],
        [database, { legacyId: 'three', payload: { a: 3 } }],
      ],
    };
    const adapterCalls = {
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 1 } }],
        [database, { legacyId: 'two', payload: { a: 999 } }],
        [database, { legacyId: 'three', payload: { a: 3 } }],
      ],
    };
    expect(() =>
      expectLibraryCallSequenceMatches(FN, cardCalls, adapterCalls, 1, [])
    ).toThrow(/call #1/);
  });

  it('catches a missing call (length mismatch) rather than silently comparing a shorter sequence', () => {
    const database = { fake: 'db-handle' };
    const cardCalls = {
      [FN]: [
        [database, { legacyId: 'one', payload: { a: 1 } }],
        [database, { legacyId: 'two', payload: { a: 2 } }],
      ],
    };
    const adapterCalls = {
      // The adapter dropped the second document entirely — its one call
      // matches the card's first call exactly, so a naive `[0]`-indexed or
      // last-call-wins comparison would report no divergence at all.
      [FN]: [[database, { legacyId: 'one', payload: { a: 1 } }]],
    };
    expect(() =>
      expectLibraryCallSequenceMatches(FN, cardCalls, adapterCalls, 1, [])
    ).toThrow(/called 1 time\(s\), card called it 2 time\(s\)/);
  });

  it('omits the given keys before comparing each call', () => {
    const database = { fake: 'db-handle' };
    const cardCalls = {
      [FN]: [[database, { legacyId: 'one', now: () => 'card-time' }]],
    };
    const adapterCalls = {
      [FN]: [[database, { legacyId: 'one', now: () => 'adapter-time' }]],
    };
    // `now` is a fresh function reference on each side — `toEqual` would
    // fail on referential inequality if it were not omitted.
    expect(() =>
      expectLibraryCallSequenceMatches(FN, cardCalls, adapterCalls, 1, ['now'])
    ).not.toThrow();
  });
});
