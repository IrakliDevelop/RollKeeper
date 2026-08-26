import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deleteRollkeeperDatabaseForTests,
  openRollkeeperDatabase,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  deviceIdFor,
  normalizeFlatEnrollmentPreview,
  verifyPostgresGenerationParity,
  verifyPreparedGeneration,
} from '../shared';

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

describe('verifyPreparedGeneration', () => {
  const NAMESPACE = 'user:account-1';
  const CAMPAIGN_ID = 'campaign-1';
  const FAMILY_KEY = 'npc';
  const GENERATION = 'run-abc';

  afterEach(async () => {
    await deleteRollkeeperDatabaseForTests(indexedDB);
  });

  async function putState(state: Record<string, unknown> | undefined) {
    const database = await openRollkeeperDatabase();
    try {
      const transaction = database.transaction('meta', 'readwrite');
      if (state !== undefined)
        transaction.objectStore('meta').put({
          key: `migration-state:${NAMESPACE}:${FAMILY_KEY}:${CAMPAIGN_ID}`,
          ...state,
        });
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }

  it('verifies when the state record is IDB_PRIMARY for the exact generation', async () => {
    await putState({ state: 'IDB_PRIMARY', runId: GENERATION });
    const database = await openRollkeeperDatabase();
    try {
      expect(
        await verifyPreparedGeneration(
          database,
          FAMILY_KEY,
          NAMESPACE,
          CAMPAIGN_ID,
          GENERATION
        )
      ).toBe(true);
    } finally {
      database.close();
    }
  });

  it('refuses when no state record exists at all', async () => {
    const database = await openRollkeeperDatabase();
    try {
      expect(
        await verifyPreparedGeneration(
          database,
          FAMILY_KEY,
          NAMESPACE,
          CAMPAIGN_ID,
          GENERATION
        )
      ).toBe(false);
    } finally {
      database.close();
    }
  });

  it('refuses when the state record is for a DIFFERENT generation', async () => {
    await putState({ state: 'IDB_PRIMARY', runId: 'a-different-run' });
    const database = await openRollkeeperDatabase();
    try {
      expect(
        await verifyPreparedGeneration(
          database,
          FAMILY_KEY,
          NAMESPACE,
          CAMPAIGN_ID,
          GENERATION
        )
      ).toBe(false);
    } finally {
      database.close();
    }
  });

  it('refuses when the state record has the right runId but is not IDB_PRIMARY (e.g. still CUTOVER_READY)', async () => {
    await putState({ state: 'CUTOVER_READY', runId: GENERATION });
    const database = await openRollkeeperDatabase();
    try {
      expect(
        await verifyPreparedGeneration(
          database,
          FAMILY_KEY,
          NAMESPACE,
          CAMPAIGN_ID,
          GENERATION
        )
      ).toBe(false);
    } finally {
      database.close();
    }
  });
});

describe('verifyPostgresGenerationParity', () => {
  const localDocuments = [
    {
      legacyId: 'AAA111',
      payloadFingerprint: 'a'.repeat(64),
      schemaVersion: 1,
      tombstoned: false,
    },
  ];
  const matchingPreview = {
    authority: 'postgres' as const,
    epoch: 2,
    recordCount: 1,
    documents: [
      {
        legacyId: 'AAA111',
        serverVersion: 1,
        schemaVersion: 1,
        payloadFingerprint: 'a'.repeat(64),
        tombstoned: false,
      },
    ],
  };

  it('verifies when the epoch matches and every document matches exactly', () => {
    expect(
      verifyPostgresGenerationParity(matchingPreview, 2, localDocuments)
    ).toBe(true);
  });

  it('refuses when the cloud authority is not postgres, even if a stray epoch/documents payload would otherwise satisfy every other check', () => {
    // Deliberately carries the SAME epoch and documents as `matchingPreview`
    // so this can only fail via the `authority` guard specifically — a
    // fixture that also lacked `epoch`/`documents` would let the epoch-type
    // guard mask a deleted authority guard.
    expect(
      verifyPostgresGenerationParity(
        { ...matchingPreview, authority: 'legacy' },
        2,
        localDocuments
      )
    ).toBe(false);
  });

  it('refuses when the epoch does not match the pointer epoch', () => {
    expect(
      verifyPostgresGenerationParity(matchingPreview, 3, localDocuments)
    ).toBe(false);
  });

  it('refuses when the epoch is missing from the preview', () => {
    expect(
      verifyPostgresGenerationParity(
        { ...matchingPreview, epoch: undefined },
        2,
        localDocuments
      )
    ).toBe(false);
  });

  it('refuses when a document fingerprint disagrees', () => {
    expect(
      verifyPostgresGenerationParity(
        {
          ...matchingPreview,
          documents: [
            {
              ...matchingPreview.documents[0],
              payloadFingerprint: 'b'.repeat(64),
            },
          ],
        },
        2,
        localDocuments
      )
    ).toBe(false);
  });
});
