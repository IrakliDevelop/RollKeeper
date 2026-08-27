import { afterEach, describe, expect, it } from 'vitest';

import {
  createCharacterCloudLinkRepository,
  createMemoryCharacterCloudLinkRepository,
} from './characterCloudLinks';

describe('character cloud-link metadata', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('is stored separately and isolated by account without changing legacy data', () => {
    const legacy = '{"state":{"characters":[{"id":"legacy-a"}]}}';
    localStorage.setItem('rollkeeper-player-data', legacy);
    const repository = createCharacterCloudLinkRepository(localStorage);

    repository.save({
      accountId: 'user-a',
      legacyId: 'legacy-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-a',
    });

    expect(repository.get('user-a', 'legacy-a')?.cloudId).toBe('cloud-a');
    expect(repository.get('user-b', 'legacy-a')).toBeNull();
    expect(localStorage.getItem('rollkeeper-player-data')).toBe(legacy);
  });

  it('removes only the targeted account/legacy link from the storage-backed repository', () => {
    const repository = createCharacterCloudLinkRepository(localStorage);
    repository.save({
      accountId: 'user-a',
      legacyId: 'legacy-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-a',
    });
    repository.save({
      accountId: 'user-a',
      legacyId: 'legacy-b',
      cloudId: 'cloud-b',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-b',
    });
    repository.save({
      accountId: 'user-b',
      legacyId: 'legacy-a',
      cloudId: 'cloud-c',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-c',
    });

    repository.remove('user-a', 'legacy-a');

    expect(repository.get('user-a', 'legacy-a')).toBeNull();
    expect(repository.get('user-a', 'legacy-b')?.cloudId).toBe('cloud-b');
    expect(repository.get('user-b', 'legacy-a')?.cloudId).toBe('cloud-c');
  });

  it('removes only the targeted account/legacy link from the memory repository', () => {
    const repository = createMemoryCharacterCloudLinkRepository();
    repository.save({
      accountId: 'user-a',
      legacyId: 'legacy-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-a',
    });
    repository.save({
      accountId: 'user-a',
      legacyId: 'legacy-b',
      cloudId: 'cloud-b',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-b',
    });

    repository.remove('user-a', 'legacy-a');

    expect(repository.get('user-a', 'legacy-a')).toBeNull();
    expect(repository.get('user-a', 'legacy-b')?.cloudId).toBe('cloud-b');
  });

  it('round-trips pendingMutation.originPlayerBackupRunId and parses legacy links without the field', () => {
    const repository = createCharacterCloudLinkRepository(localStorage);
    repository.save({
      accountId: 'user-a',
      legacyId: 'legacy-a',
      cloudId: 'cloud-a',
      serverVersion: 1,
      contentFingerprint: 'fingerprint-a',
      pendingMutation: {
        mutationId: 'mutation-a',
        contentFingerprint: 'fingerprint-a',
        originPlayerBackupRunId: 'run-a',
      },
    });

    expect(repository.get('user-a', 'legacy-a')?.pendingMutation).toEqual({
      mutationId: 'mutation-a',
      contentFingerprint: 'fingerprint-a',
      originPlayerBackupRunId: 'run-a',
    });

    localStorage.setItem(
      'rollkeeper-character-cloud-links-v1',
      JSON.stringify({
        'user-b:legacy-b': {
          accountId: 'user-b',
          legacyId: 'legacy-b',
          cloudId: 'cloud-b',
          serverVersion: 1,
          contentFingerprint: 'fingerprint-b',
          pendingMutation: {
            mutationId: 'mutation-b',
            contentFingerprint: 'fingerprint-b',
          },
        },
      })
    );

    expect(repository.get('user-b', 'legacy-b')?.pendingMutation).toEqual({
      mutationId: 'mutation-b',
      contentFingerprint: 'fingerprint-b',
    });
  });
});
