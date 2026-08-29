import { describe, expect, it } from 'vitest';

import {
  transformCapturedSnapshot,
  validateLegacyEnvelope,
} from '@/lib/indexeddb/migrationValidation';

describe('pure passthrough migration and validation', () => {
  it('is pure and idempotent while preserving unknown fields and explicit nulls', async () => {
    const snapshot = {
      runId: 'run-a',
      key: 'rollkeeper-player-data',
      captureNumber: 1,
      presence: true,
      rawValue:
        '{"state":{"characters":[],"unknown":{"future":null}},"version":1}',
      sha256: 'hash',
      byteCount: 68,
      timestamp: 'now',
    } as const;
    const before = structuredClone(snapshot);

    const first = transformCapturedSnapshot(snapshot, 'guest');
    const second = transformCapturedSnapshot(snapshot, 'guest');

    expect(first).toEqual(second);
    expect(snapshot).toEqual(before);
    expect(first).toMatchObject({
      namespace: 'guest',
      generation: 'run-a',
      key: 'rollkeeper-player-data',
      rawValue: snapshot.rawValue,
      parsed: {
        state: { characters: [], unknown: { future: null } },
        version: 1,
      },
    });
  });

  it.each([
    ['malformed JSON', 'rollkeeper-player-data', '{broken', 'malformed-json'],
    [
      'future persistence version',
      'rollkeeper-player-data',
      '{"state":{},"version":999}',
      'future-version',
    ],
    [
      'invalid Zustand envelope',
      'rollkeeper-player-data',
      '{"version":1,"state":null}',
      'invalid-envelope',
    ],
    [
      'duplicate character IDs',
      'rollkeeper-player-data',
      '{"state":{"characters":[{"id":"a","characterData":{"id":"a"}},{"id":"a","characterData":{"id":"a"}}]},"version":1}',
      'semantic-integrity',
    ],
    [
      'character reference mismatch',
      'rollkeeper-player-data',
      '{"state":{"characters":[{"id":"a","characterData":{"id":"b"}}]},"version":1}',
      'reference-integrity',
    ],
    [
      'incomplete roster character missing tags',
      'rollkeeper-player-data',
      '{"state":{"characters":[{"id":"hero-1","name":"Hero One","characterData":{"id":"hero-1"}}]},"version":1}',
      'semantic-integrity',
    ],
  ])('quarantines %s without activating it', (_label, key, raw, reason) => {
    expect(validateLegacyEnvelope(key, raw)).toMatchObject({
      status: 'quarantined',
      reason,
      rawValue: raw,
    });
  });

  it('accepts supported historical envelopes and opaque retained-only values', () => {
    expect(
      validateLegacyEnvelope(
        'rollkeeper-encounter-data',
        '{"state":{"encounters":[]},"version":1}'
      )
    ).toMatchObject({ status: 'valid', persistenceVersion: 1 });
    expect(
      validateLegacyEnvelope('rollkeeper-unknown', 'opaque bytes')
    ).toMatchObject({ status: 'retained-only', rawValue: 'opaque bytes' });
    expect(
      validateLegacyEnvelope(
        'battlemap-canvas-map-a',
        '{"shapes":[],"unknown":null}'
      )
    ).toMatchObject({
      status: 'valid',
      persistenceVersion: 0,
      parsed: { shapes: [], unknown: null },
    });
  });

  it('rejects a per-character envelope whose key and payload IDs differ', () => {
    expect(
      validateLegacyEnvelope(
        'rollkeeper-character:hero-a',
        '{"state":{"character":{"id":"hero-b"}}}'
      )
    ).toMatchObject({ status: 'quarantined', reason: 'reference-integrity' });
  });

  it('quarantines a per-character envelope with no character payload', () => {
    expect(
      validateLegacyEnvelope(
        'rollkeeper-character:hero-a',
        '{"state":{},"version":0}'
      )
    ).toMatchObject({ status: 'quarantined', reason: 'semantic-integrity' });
  });
});
