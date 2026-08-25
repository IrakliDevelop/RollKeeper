import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DURABLE_FAMILY_REGISTRY,
  enabledAdapters,
  registeredAdapters,
} from '../familyRegistry';

describe('DURABLE_FAMILY_REGISTRY', () => {
  // R9.3: the env stub this suite sets in the last test MUST be restored, or
  // the leak reaches every later test in this worker — including the
  // "registers exactly the six shipped families" test above it, if vitest
  // ever reorders execution.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists the eight internal families in the product order', () => {
    expect(DURABLE_FAMILY_REGISTRY.map(entry => entry.family)).toEqual([
      'campaign_settings',
      'calendar',
      'magic_item',
      'npc',
      'encounter_definition',
      'combat_log_archive',
      'location',
      'battle_map',
    ]);
  });

  it('marks the two unshipped campaign-data categories planned, with no adapter', () => {
    const planned = DURABLE_FAMILY_REGISTRY.filter(
      entry => entry.status === 'planned'
    );
    expect(planned.map(entry => entry.family)).toEqual([
      'location',
      'battle_map',
    ]);
    for (const entry of planned) expect('adapter' in entry).toBe(false);
  });

  it('does not misrepresent the membership-dependent Player inbox as campaign data', () => {
    // These two assertions can never fail: `family` is a closed eight-name
    // union that does not include 'deliveries' or 'player_deliveries', so a
    // correctly-typed registry cannot produce either value here. Kept as
    // documentation of the decision (rulings.md R6.6).
    expect(DURABLE_FAMILY_REGISTRY.map(entry => entry.family)).not.toContain(
      'deliveries'
    );
    expect(DURABLE_FAMILY_REGISTRY.map(entry => entry.family)).not.toContain(
      'player_deliveries'
    );

    // Runtime assertion that could actually fail: widen to plain strings
    // first so a future author who bypasses the type system (an `as any`
    // registry entry, a typo'd literal) is still caught.
    const familyNames: string[] = DURABLE_FAMILY_REGISTRY.map(entry =>
      String(entry.family)
    );
    expect(familyNames).not.toContain('deliveries');
    expect(familyNames).not.toContain('player_deliveries');
  });

  it('registers exactly the six shipped families', () => {
    expect(registeredAdapters()).toHaveLength(6);
  });

  it('excludes a registered family whose own client flag is off from the enabled set', () => {
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'false');
    expect(enabledAdapters().map(adapter => adapter.family)).not.toContain(
      'combat_log_archive'
    );
    expect(registeredAdapters().map(adapter => adapter.family)).toContain(
      'combat_log_archive'
    );
  });
});
