import { describe, it, expect, vi } from 'vitest';

import { handleEncounterPoke } from '../EncounterView';

describe('handleEncounterPoke', () => {
  it('calls refresh on a players poke', () => {
    const refresh = vi.fn();
    handleEncounterPoke('players', refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignores an initiative poke — EncounterView authors initiative', () => {
    const refresh = vi.fn();
    handleEncounterPoke('initiative', refresh);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores unknown feature strings', () => {
    const refresh = vi.fn();
    handleEncounterPoke('something-else', refresh);
    expect(refresh).not.toHaveBeenCalled();
  });
});
