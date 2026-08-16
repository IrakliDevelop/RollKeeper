import { describe, expect, it } from 'vitest';

import { resolvePersistenceBootstrapMode } from '@/lib/indexeddb/characterBootstrapRouting';

describe('persistence bootstrap feature routing', () => {
  it('preserves the disabled-by-default Slice 7 path without letting it override an explicit Slice 8 participant', () => {
    expect(
      resolvePersistenceBootstrapMode({
        characterParticipant: false,
        slice7Enabled: false,
      })
    ).toBe('legacy');
    expect(
      resolvePersistenceBootstrapMode({
        characterParticipant: false,
        slice7Enabled: true,
      })
    ).toBe('slice7');
    expect(
      resolvePersistenceBootstrapMode({
        characterParticipant: true,
        slice7Enabled: true,
      })
    ).toBe('character');
  });
});
