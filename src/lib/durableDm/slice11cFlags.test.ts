import { afterEach, describe, expect, it } from 'vitest';

import {
  isMagicItemClientVisible,
  isMagicItemServerEnabled,
} from './slice11cFlags';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE;
  delete process.env.SUPABASE_MAGIC_ITEM_SYNC_ENABLED;
});

describe('Slice 11C flags', () => {
  it('keeps every magic item path disabled by default', () => {
    expect(isMagicItemClientVisible()).toBe(false);
    expect(isMagicItemServerEnabled()).toBe(false);
  });

  it('requires the exact independent opt-in values', () => {
    process.env.NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE = 'true';
    process.env.SUPABASE_MAGIC_ITEM_SYNC_ENABLED = 'true';
    expect(isMagicItemClientVisible()).toBe(true);
    expect(isMagicItemServerEnabled()).toBe(true);
  });

  it('ignores truthy values that are not exactly "true"', () => {
    process.env.NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE = 'TRUE';
    process.env.SUPABASE_MAGIC_ITEM_SYNC_ENABLED = '1';
    expect(isMagicItemClientVisible()).toBe(false);
    expect(isMagicItemServerEnabled()).toBe(false);
  });
});
