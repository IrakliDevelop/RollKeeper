import { describe, expect, it, vi } from 'vitest';

import {
  accountMembershipMatchesLegacyIds,
  resolveCampaignMembershipRequest,
} from './campaignMembershipAuthority';

const legacy = {
  campaignId: 'campaign-a',
  ownerId: 'owner-a',
  displayCode: 'A1B2C3D4E5F6',
  authority: 'legacy' as const,
  epoch: 0,
  freezeState: 'open' as const,
};

describe('campaign membership authority resolution', () => {
  it('makes zero authority or account calls while the dedicated server gate is disabled', async () => {
    const loadAuthority = vi.fn();
    const authorizeAccount = vi.fn();
    await expect(
      resolveCampaignMembershipRequest({
        enabled: false,
        displayCode: legacy.displayCode,
        mutation: true,
        loadAuthority,
        authorizeAccount,
      })
    ).resolves.toEqual({ mode: 'legacy' });
    expect(loadAuthority).not.toHaveBeenCalled();
    expect(authorizeAccount).not.toHaveBeenCalled();
  });

  it('keeps untouched and hybrid campaigns on the byte-compatible legacy path', async () => {
    const authorizeAccount = vi.fn();
    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: true,
        loadAuthority: vi.fn().mockResolvedValue(legacy),
        authorizeAccount,
      })
    ).resolves.toEqual({ mode: 'legacy', authority: legacy });
    expect(authorizeAccount).not.toHaveBeenCalled();
  });

  it('freezes legacy join/remove mutations without treating Redis or presence as consent', async () => {
    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: true,
        loadAuthority: vi.fn().mockResolvedValue({
          ...legacy,
          freezeState: 'freezing',
        }),
        authorizeAccount: vi.fn(),
      })
    ).resolves.toMatchObject({ mode: 'denied', status: 409 });
  });

  it('uses only an active account membership after cutover and returns its explicit link', async () => {
    const principal = {
      campaignId: 'campaign-a',
      accountId: 'player-account',
      role: 'player' as const,
      status: 'active' as const,
      epoch: 1,
      legacyPlayerId: 'legacy-player-a',
      legacyCharacterId: 'legacy-character-a',
      characterId: 'cloud-character-a',
    };
    const authorizeAccount = vi.fn().mockResolvedValue(principal);
    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: true,
        loadAuthority: vi.fn().mockResolvedValue({
          ...legacy,
          authority: 'postgres',
          epoch: 1,
          freezeState: 'postgres',
        }),
        authorizeAccount,
      })
    ).resolves.toEqual({ mode: 'account', principal });
    expect(authorizeAccount).toHaveBeenCalledWith('campaign-a', 1);
  });

  it('fails closed after cutover on stale, removed, missing, or unavailable account authority', async () => {
    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: false,
        loadAuthority: vi.fn().mockResolvedValue({
          ...legacy,
          authority: 'postgres',
          epoch: 4,
          freezeState: 'postgres',
        }),
        authorizeAccount: vi.fn().mockRejectedValue(new Error('removed')),
      })
    ).resolves.toMatchObject({ mode: 'denied', status: 401 });

    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: false,
        loadAuthority: vi.fn().mockRejectedValue(new Error('database down')),
        authorizeAccount: vi.fn(),
      })
    ).resolves.toEqual({ mode: 'denied', status: 503 });
  });

  it('keeps display codes unknown to Postgres on the legacy path', async () => {
    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: false,
        loadAuthority: vi.fn().mockRejectedValue({ category: 'not-managed' }),
        authorizeAccount: vi.fn(),
      })
    ).resolves.toEqual({ mode: 'legacy' });
  });

  it.each([
    { campaignId: 'other', epoch: 1, status: 'active' as const },
    { campaignId: 'campaign-a', epoch: 2, status: 'active' as const },
  ])('denies mismatched account authority %#', async mismatch => {
    await expect(
      resolveCampaignMembershipRequest({
        enabled: true,
        displayCode: legacy.displayCode,
        mutation: false,
        loadAuthority: vi.fn().mockResolvedValue({
          ...legacy,
          authority: 'postgres',
          epoch: 1,
          freezeState: 'postgres',
        }),
        authorizeAccount: vi.fn().mockResolvedValue({
          ...mismatch,
          accountId: 'account-a',
          role: 'player',
          legacyPlayerId: 'legacy-a',
          legacyCharacterId: 'character-a',
          characterId: 'cloud-a',
        }),
      })
    ).resolves.toEqual({ mode: 'denied', status: 401 });
  });

  it('matches only explicit linked legacy IDs, with owner bypass', () => {
    const principal = {
      campaignId: 'campaign-a',
      accountId: 'account-a',
      role: 'player' as const,
      status: 'active' as const,
      epoch: 1,
      legacyPlayerId: 'legacy-a',
      legacyCharacterId: 'character-a',
      characterId: 'cloud-a',
    };
    expect(
      accountMembershipMatchesLegacyIds(principal, [
        'legacy-a',
        undefined,
        null,
      ])
    ).toBe(true);
    expect(accountMembershipMatchesLegacyIds(principal, ['foreign'])).toBe(
      false
    );
    expect(
      accountMembershipMatchesLegacyIds(
        { ...principal, legacyCharacterId: null },
        []
      )
    ).toBe(false);
    expect(
      accountMembershipMatchesLegacyIds({ ...principal, role: 'owner' }, [
        'foreign',
      ])
    ).toBe(true);
  });
});
