import { afterEach, describe, expect, it } from 'vitest';

import {
  isEncounterClientVisible,
  isEncounterServerEnabled,
} from './slice11eFlags';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE;
  delete process.env.SUPABASE_ENCOUNTER_SYNC_ENABLED;
});

describe('Slice 11E flags', () => {
  it('keeps every encounter path disabled by default', () => {
    expect(isEncounterClientVisible()).toBe(false);
    expect(isEncounterServerEnabled()).toBe(false);
  });

  it('requires the exact independent opt-in values', () => {
    process.env.NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE = 'true';
    process.env.SUPABASE_ENCOUNTER_SYNC_ENABLED = 'true';
    expect(isEncounterClientVisible()).toBe(true);
    expect(isEncounterServerEnabled()).toBe(true);
  });

  it('ignores truthy values that are not exactly "true"', () => {
    process.env.NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE = 'TRUE';
    process.env.SUPABASE_ENCOUNTER_SYNC_ENABLED = '1';
    expect(isEncounterClientVisible()).toBe(false);
    expect(isEncounterServerEnabled()).toBe(false);
  });
});
