import { describe, expect, it } from 'vitest';

import { createCharacterCloudLinkRepository } from './characterCloudLinks';

describe('character cloud-link metadata', () => {
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
});
