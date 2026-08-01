import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { CHARACTER_ACTION_CLASSIFICATION } from '@/store/characterActionClassification';

describe('character action classification', () => {
  it('every store function is classified — new actions must be added to the table', () => {
    const state = useCharacterStore.getState() as unknown as Record<
      string,
      unknown
    >;
    const unclassified = Object.entries(state)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .filter(name => !(name in CHARACTER_ACTION_CLASSIFICATION));
    expect(unclassified).toEqual([]);
  });
});
