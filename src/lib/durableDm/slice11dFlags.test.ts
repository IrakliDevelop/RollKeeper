import { afterEach, describe, expect, it } from 'vitest';

import { isNpcClientVisible, isNpcServerEnabled } from './slice11dFlags';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_NPC_SYNC_VISIBLE;
  delete process.env.SUPABASE_NPC_SYNC_ENABLED;
});

describe('Slice 11D flags', () => {
  it('keeps every NPC path disabled by default', () => {
    expect(isNpcClientVisible()).toBe(false);
    expect(isNpcServerEnabled()).toBe(false);
  });

  it('requires the exact independent opt-in values', () => {
    process.env.NEXT_PUBLIC_NPC_SYNC_VISIBLE = 'true';
    process.env.SUPABASE_NPC_SYNC_ENABLED = 'true';
    expect(isNpcClientVisible()).toBe(true);
    expect(isNpcServerEnabled()).toBe(true);
  });

  it('ignores truthy values that are not exactly "true"', () => {
    process.env.NEXT_PUBLIC_NPC_SYNC_VISIBLE = 'TRUE';
    process.env.SUPABASE_NPC_SYNC_ENABLED = '1';
    expect(isNpcClientVisible()).toBe(false);
    expect(isNpcServerEnabled()).toBe(false);
  });
});
