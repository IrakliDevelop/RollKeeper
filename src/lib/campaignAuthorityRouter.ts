export const DM_DURABLE_FAMILIES = [
  'campaign_settings',
  'calendar',
  'magic_item',
  'npc',
  'encounter_definition',
  'location',
  'battle_map',
  'combat_log_archive',
] as const;

export type DmDurableFamily = (typeof DM_DURABLE_FAMILIES)[number];
export type CampaignAuthorityAxis =
  | 'workspace'
  | 'membership'
  | 'durable_family'
  | 'live_runtime';
export type CampaignAuthorityValue =
  | 'authenticated_owner'
  | 'legacy'
  | 'postgres'
  | 'redis_relay';

export interface CampaignAuthorityRecord {
  campaignId: string;
  axis: CampaignAuthorityAxis;
  family: DmDurableFamily | null;
  authority: string;
  epoch: number;
  ownerId: string;
}

export interface CampaignAuthorityRequest {
  campaignId: string;
  actorId: string;
  family: DmDurableFamily;
  expectedMembershipEpoch: number;
  expectedFamilyEpoch: number;
}

export interface ResolvedCampaignAuthority {
  workspace: 'authenticated_owner';
  membership: 'legacy' | 'postgres';
  family: 'legacy' | 'postgres';
  liveRuntime: 'redis_relay';
  ownerAccess: true;
}

export class CampaignAuthorityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignAuthorityError';
  }
}

function exactlyOne(
  records: readonly CampaignAuthorityRecord[],
  label: string
): CampaignAuthorityRecord {
  if (records.length === 0) {
    throw new CampaignAuthorityError(`missing ${label} authority`);
  }
  if (records.length > 1) {
    throw new CampaignAuthorityError(`ambiguous ${label} authority`);
  }
  return records[0];
}

function requireAuthority<T extends CampaignAuthorityValue>(
  record: CampaignAuthorityRecord,
  allowed: readonly T[],
  label: string
): T {
  if (!allowed.includes(record.authority as T)) {
    throw new CampaignAuthorityError(`invalid ${label} authority`);
  }
  return record.authority as T;
}

/**
 * Resolves the four campaign authority axes from explicit durable records.
 * It deliberately has no fallback based on row presence in any datastore.
 */
export class CampaignAuthorityRouter {
  constructor(private readonly records: readonly CampaignAuthorityRecord[]) {}

  resolve(request: CampaignAuthorityRequest): ResolvedCampaignAuthority {
    const campaignRecords = this.records.filter(
      record => record.campaignId === request.campaignId
    );
    const workspace = exactlyOne(
      campaignRecords.filter(
        record => record.axis === 'workspace' && record.family === null
      ),
      'workspace'
    );
    const membership = exactlyOne(
      campaignRecords.filter(
        record => record.axis === 'membership' && record.family === null
      ),
      'membership'
    );
    const family = exactlyOne(
      campaignRecords.filter(
        record =>
          record.axis === 'durable_family' && record.family === request.family
      ),
      'family'
    );
    const liveRuntime = exactlyOne(
      campaignRecords.filter(
        record => record.axis === 'live_runtime' && record.family === null
      ),
      'live runtime'
    );

    if (
      workspace.ownerId !== request.actorId ||
      campaignRecords.some(record => record.ownerId !== workspace.ownerId)
    ) {
      throw new CampaignAuthorityError('workspace owner does not match actor');
    }
    if (membership.epoch !== request.expectedMembershipEpoch) {
      throw new CampaignAuthorityError('stale membership authority');
    }
    if (family.epoch !== request.expectedFamilyEpoch) {
      throw new CampaignAuthorityError('stale family authority');
    }

    return {
      workspace: requireAuthority(
        workspace,
        ['authenticated_owner'],
        'workspace'
      ),
      membership: requireAuthority(
        membership,
        ['legacy', 'postgres'],
        'membership'
      ),
      family: requireAuthority(family, ['legacy', 'postgres'], 'family'),
      liveRuntime: requireAuthority(
        liveRuntime,
        ['redis_relay'],
        'live runtime'
      ),
      ownerAccess: true,
    };
  }
}
