import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isCombatLogArchiveClientVisible,
  isCombatLogArchiveServerEnabled,
} from './slice11fFlags';

describe('slice11fFlags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the server flag off unless it is exactly "true"', () => {
    vi.stubEnv('SUPABASE_COMBAT_LOG_SYNC_ENABLED', '');
    expect(isCombatLogArchiveServerEnabled()).toBe(false);
    vi.stubEnv('SUPABASE_COMBAT_LOG_SYNC_ENABLED', 'TRUE');
    expect(isCombatLogArchiveServerEnabled()).toBe(false);
    vi.stubEnv('SUPABASE_COMBAT_LOG_SYNC_ENABLED', 'true');
    expect(isCombatLogArchiveServerEnabled()).toBe(true);
  });

  it('keeps the client flag off unless it is exactly "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', '1');
    expect(isCombatLogArchiveClientVisible()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'true');
    expect(isCombatLogArchiveClientVisible()).toBe(true);
  });
});
