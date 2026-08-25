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
    // documentation of the decision (rulings.md R6.6). The real runtime pin
    // against this is the "lists the eight internal families in the product
    // order" test's `toEqual` above, which fixes the exact set.
    expect(DURABLE_FAMILY_REGISTRY.map(entry => entry.family)).not.toContain(
      'deliveries'
    );
    expect(DURABLE_FAMILY_REGISTRY.map(entry => entry.family)).not.toContain(
      'player_deliveries'
    );

    // An assertion that genuinely could fail and does not lean on the type
    // system: `String(entry.family)` produces the exact same runtime value
    // the typed check above already sees (vitest never type-checks), so it
    // adds no discrimination on its own. Scanning `family` AND `label` with
    // a regex survives a bypass of the type system entirely (an `as any`
    // entry, a mistaken literal) in a way the typed assertions cannot.
    for (const entry of DURABLE_FAMILY_REGISTRY) {
      expect(entry.family).not.toMatch(/deliver|player inbox/i);
      expect(entry.label).not.toMatch(/deliver|player inbox/i);
    }
  });

  it('registers exactly the six shipped families', () => {
    expect(registeredAdapters()).toHaveLength(6);
  });

  it('excludes a registered family whose own client flag is off from the enabled set, in the mixed state R13 is defined against', () => {
    // Five families enabled, one (combat_log_archive) off. Every family flag
    // defaults to false in the test env, so a version of this test that
    // leaves the other five unset would only ever see "all six off" or "one
    // family on" — never the mixed 5-of-6 state spec R13's "Available
    // campaign data is synced" claim is actually defined against. Stubbing
    // the other five to 'true' is what makes `enabledAdapters()` length 5
    // (not 0 or 1) the discriminating assertion.
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    vi.stubEnv('NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE', 'true');
    vi.stubEnv('NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE', 'true');
    vi.stubEnv('NEXT_PUBLIC_NPC_SYNC_VISIBLE', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE', 'true');
    vi.stubEnv('NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE', 'false');

    const enabled = enabledAdapters();
    expect(enabled).toHaveLength(5);
    expect(enabled.map(adapter => adapter.family)).not.toContain(
      'combat_log_archive'
    );

    // The disabled family still counts in the registered denominator: this
    // is what lets it block "All campaign data is synced" even though it
    // never runs.
    const registered = registeredAdapters();
    expect(registered).toHaveLength(6);
    expect(registered.map(adapter => adapter.family)).toContain(
      'combat_log_archive'
    );
  });
});
