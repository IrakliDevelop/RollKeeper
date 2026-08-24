import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deviceIdFor, normalizeFlatEnrollmentPreview } from '../shared';

describe('normalizeFlatEnrollmentPreview', () => {
  it('passes a legacy response through unchanged', () => {
    expect(normalizeFlatEnrollmentPreview({ authority: 'legacy' })).toEqual({
      authority: 'legacy',
    });
  });

  it('reshapes a flat postgres response into a single-document CloudEnrollmentPreview', () => {
    expect(
      normalizeFlatEnrollmentPreview({
        authority: 'postgres',
        epoch: 3,
        previewFingerprint: 'f'.repeat(64),
        legacyId: 'AAA111',
        serverVersion: 2,
        schemaVersion: 1,
        payloadFingerprint: 'a'.repeat(64),
        tombstoned: true,
      })
    ).toEqual({
      authority: 'postgres',
      epoch: 3,
      previewFingerprint: 'f'.repeat(64),
      recordCount: 1,
      documents: [
        {
          legacyId: 'AAA111',
          serverVersion: 2,
          schemaVersion: 1,
          payloadFingerprint: 'a'.repeat(64),
          tombstoned: true,
        },
      ],
    });
  });

  it('defaults an omitted tombstoned flag to false', () => {
    const preview = normalizeFlatEnrollmentPreview({
      authority: 'postgres',
      epoch: 1,
      previewFingerprint: 'f'.repeat(64),
      legacyId: 'AAA111',
      serverVersion: 1,
      schemaVersion: 1,
      payloadFingerprint: 'a'.repeat(64),
    });
    expect(preview).toMatchObject({
      documents: [expect.objectContaining({ tombstoned: false })],
    });
  });
});

describe('deviceIdFor', () => {
  const KEY = 'rollkeeper:test-family-device:account-a:campaign-a';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates and persists a device id on first use', () => {
    expect(localStorage.getItem(KEY)).toBeNull();
    const deviceId = deviceIdFor('test-family', 'account-a', 'campaign-a');
    expect(deviceId.length).toBeGreaterThan(0);
    expect(localStorage.getItem(KEY)).toBe(deviceId);
  });

  it('reuses the persisted device id rather than generating a fresh one', () => {
    localStorage.setItem(KEY, 'existing-device-id');
    expect(deviceIdFor('test-family', 'account-a', 'campaign-a')).toBe(
      'existing-device-id'
    );
  });
});
