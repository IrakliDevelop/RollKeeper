import { describe, expect, it } from 'vitest';

import {
  CampaignAuthorityError,
  CampaignAuthorityRouter,
  type CampaignAuthorityRecord,
} from './campaignAuthorityRouter';

const CAMPAIGN_ID = 'campaign-a';
const OWNER_ID = 'owner-a';

function records(
  overrides: Partial<Record<CampaignAuthorityRecord['axis'], string>> = {}
): CampaignAuthorityRecord[] {
  return [
    {
      campaignId: CAMPAIGN_ID,
      axis: 'workspace',
      family: null,
      authority: overrides.workspace ?? 'authenticated_owner',
      epoch: 1,
      ownerId: OWNER_ID,
    },
    {
      campaignId: CAMPAIGN_ID,
      axis: 'membership',
      family: null,
      authority: overrides.membership ?? 'legacy',
      epoch: 0,
      ownerId: OWNER_ID,
    },
    {
      campaignId: CAMPAIGN_ID,
      axis: 'durable_family',
      family: 'campaign_settings',
      authority: overrides.durable_family ?? 'legacy',
      epoch: 0,
      ownerId: OWNER_ID,
    },
    {
      campaignId: CAMPAIGN_ID,
      axis: 'live_runtime',
      family: null,
      authority: overrides.live_runtime ?? 'redis_relay',
      epoch: 0,
      ownerId: OWNER_ID,
    },
  ];
}

describe('CampaignAuthorityRouter', () => {
  it('resolves an owner-only workspace while membership, family, and live runtime remain legacy', () => {
    const resolved = new CampaignAuthorityRouter(records()).resolve({
      campaignId: CAMPAIGN_ID,
      actorId: OWNER_ID,
      family: 'campaign_settings',
      expectedMembershipEpoch: 0,
      expectedFamilyEpoch: 0,
    });

    expect(resolved).toEqual({
      workspace: 'authenticated_owner',
      membership: 'legacy',
      family: 'legacy',
      liveRuntime: 'redis_relay',
      ownerAccess: true,
    });
  });

  it('keeps workspace ownership independent from hybrid and migrated membership states', () => {
    expect(
      new CampaignAuthorityRouter(
        records({ durable_family: 'postgres' })
      ).resolve({
        campaignId: CAMPAIGN_ID,
        actorId: OWNER_ID,
        family: 'campaign_settings',
        expectedMembershipEpoch: 0,
        expectedFamilyEpoch: 0,
      })
    ).toMatchObject({ membership: 'legacy', family: 'postgres' });

    expect(
      new CampaignAuthorityRouter(records({ membership: 'postgres' })).resolve({
        campaignId: CAMPAIGN_ID,
        actorId: OWNER_ID,
        family: 'campaign_settings',
        expectedMembershipEpoch: 0,
        expectedFamilyEpoch: 0,
      })
    ).toMatchObject({ membership: 'postgres', family: 'legacy' });
  });

  it.each([
    ['workspace'],
    ['membership'],
    ['durable_family'],
    ['live_runtime'],
  ] as const)('rejects a missing %s authority instead of guessing', axis => {
    const router = new CampaignAuthorityRouter(
      records().filter(record => record.axis !== axis)
    );

    expect(() =>
      router.resolve({
        campaignId: CAMPAIGN_ID,
        actorId: OWNER_ID,
        family: 'campaign_settings',
        expectedMembershipEpoch: 0,
        expectedFamilyEpoch: 0,
      })
    ).toThrow(CampaignAuthorityError);
  });

  it('rejects stale epochs, wrong owners, contradictory records, and unrelated families', () => {
    const request = {
      campaignId: CAMPAIGN_ID,
      actorId: OWNER_ID,
      family: 'campaign_settings' as const,
      expectedMembershipEpoch: 0,
      expectedFamilyEpoch: 0,
    };

    expect(() =>
      new CampaignAuthorityRouter(records()).resolve({
        ...request,
        expectedFamilyEpoch: 1,
      })
    ).toThrow(/stale family authority/u);
    expect(() =>
      new CampaignAuthorityRouter(records()).resolve({
        ...request,
        expectedMembershipEpoch: 1,
      })
    ).toThrow(/stale membership authority/u);
    expect(() =>
      new CampaignAuthorityRouter(records()).resolve({
        ...request,
        actorId: 'wrong-owner',
      })
    ).toThrow(/workspace owner/u);
    expect(() =>
      new CampaignAuthorityRouter([...records(), records()[0]]).resolve(request)
    ).toThrow(/ambiguous workspace authority/u);
    expect(() =>
      new CampaignAuthorityRouter(
        records().map(record =>
          record.axis === 'durable_family'
            ? { ...record, family: 'calendar' }
            : record
        )
      ).resolve(request)
    ).toThrow(/missing family authority/u);
    expect(() =>
      new CampaignAuthorityRouter(
        records({ live_runtime: 'postgres' })
      ).resolve(request)
    ).toThrow(/invalid live runtime authority/u);
  });
});
