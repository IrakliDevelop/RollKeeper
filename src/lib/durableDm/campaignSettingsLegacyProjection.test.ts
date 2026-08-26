import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  legacyCampaignSettingsProjectionAllowed,
  parseProjectionAuthorityMarker,
  writeCampaignSettingsProjectionAuthority,
  type ProjectionAuthorityMarker,
} from './campaignSettingsLegacyProjection';

describe('campaign settings legacy projection authority', () => {
  beforeEach(() => localStorage.clear());

  it('is byte-compatible legacy behavior while the client gate is off', () => {
    writeCampaignSettingsProjectionAuthority(localStorage, 'ABC', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId: 'cloud-a',
    });
    expect(legacyCampaignSettingsProjectionAllowed(localStorage, 'ABC')).toBe(
      true
    );
  });

  it('suppresses legacy publication only after a gated Postgres cutover', () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    writeCampaignSettingsProjectionAuthority(localStorage, 'ABC', {
      version: 1,
      authority: 'postgres',
      epoch: 2,
      campaignId: 'cloud-a',
    });
    expect(legacyCampaignSettingsProjectionAllowed(localStorage, 'ABC')).toBe(
      false
    );
    writeCampaignSettingsProjectionAuthority(localStorage, 'ABC', {
      version: 1,
      authority: 'legacy_restored',
      epoch: 3,
      campaignId: 'cloud-a',
    });
    expect(legacyCampaignSettingsProjectionAllowed(localStorage, 'ABC')).toBe(
      true
    );
    vi.unstubAllEnvs();
  });
});

/**
 * Task 18 fix round 2, item 2 (coordinator review): `parseProjectionAuthorityMarker`
 * became a named public export in fix round 1 (Minor 3), shared by the
 * flag-gated `readCampaignSettingsProjectionAuthority` and `/dm`'s
 * flag-independent routed check. Three of its four validation clauses --
 * the `authority` whitelist, the `epoch` type check, and the `campaignId`
 * type check -- had no guard anywhere in the suite before this; each could
 * be turned into a tautology with the entire 6000+-test suite still green.
 * These tests close that gap directly, at the module that owns the parser.
 */
describe('parseProjectionAuthorityMarker', () => {
  const valid: ProjectionAuthorityMarker = {
    version: 1,
    authority: 'postgres',
    epoch: 1,
    campaignId: 'cloud-a',
  };

  it('returns null for a null raw value', () => {
    expect(parseProjectionAuthorityMarker(null)).toBeNull();
  });

  it('returns null for unparseable JSON', () => {
    expect(parseProjectionAuthorityMarker('{not valid json')).toBeNull();
  });

  it('parses a well-formed marker', () => {
    expect(parseProjectionAuthorityMarker(JSON.stringify(valid))).toEqual(
      valid
    );
  });

  it('rejects a marker with an unrecognized version', () => {
    expect(
      parseProjectionAuthorityMarker(JSON.stringify({ ...valid, version: 2 }))
    ).toBeNull();
  });

  it('rejects a marker whose authority is outside the known set', () => {
    expect(
      parseProjectionAuthorityMarker(
        JSON.stringify({ ...valid, authority: 'sqlite' })
      )
    ).toBeNull();
  });

  it('rejects a marker whose epoch is not a number', () => {
    expect(
      parseProjectionAuthorityMarker(JSON.stringify({ ...valid, epoch: '1' }))
    ).toBeNull();
  });

  it('rejects a marker whose campaignId is not a string', () => {
    expect(
      parseProjectionAuthorityMarker(
        JSON.stringify({ ...valid, campaignId: 42 })
      )
    ).toBeNull();
  });
});
