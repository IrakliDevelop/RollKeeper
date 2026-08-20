export interface CampaignMembershipAuthority {
  campaignId: string;
  ownerId: string;
  displayCode: string;
  authority: 'legacy' | 'postgres';
  epoch: number;
  freezeState:
    | 'open'
    | 'freezing'
    | 'postgres'
    | 'rollback_freezing'
    | 'legacy_restored';
}

export interface CampaignMembershipPrincipal {
  campaignId: string;
  accountId: string;
  role: 'owner' | 'dm' | 'player';
  status: 'active';
  epoch: number;
  legacyPlayerId: string | null;
  legacyCharacterId: string | null;
  characterId: string | null;
}

interface ResolveCampaignMembershipOptions {
  enabled: boolean;
  displayCode: string;
  mutation: boolean;
  loadAuthority(displayCode: string): Promise<CampaignMembershipAuthority>;
  authorizeAccount(
    campaignId: string,
    expectedEpoch: number
  ): Promise<CampaignMembershipPrincipal>;
}

export type CampaignMembershipResolution =
  | { mode: 'legacy'; authority?: CampaignMembershipAuthority }
  | { mode: 'account'; principal: CampaignMembershipPrincipal }
  | { mode: 'denied'; status: 401 | 409 | 503 };

export async function resolveCampaignMembershipRequest(
  options: ResolveCampaignMembershipOptions
): Promise<CampaignMembershipResolution> {
  if (!options.enabled) return { mode: 'legacy' };

  let authority: CampaignMembershipAuthority;
  try {
    authority = await options.loadAuthority(options.displayCode);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'category' in error &&
      error.category === 'not-managed'
    ) {
      return { mode: 'legacy' };
    }
    return { mode: 'denied', status: 503 };
  }

  if (authority.authority === 'legacy') {
    if (
      options.mutation &&
      (authority.freezeState === 'freezing' ||
        authority.freezeState === 'rollback_freezing')
    ) {
      return { mode: 'denied', status: 409 };
    }
    return { mode: 'legacy', authority };
  }

  try {
    const principal = await options.authorizeAccount(
      authority.campaignId,
      authority.epoch
    );
    if (
      principal.campaignId !== authority.campaignId ||
      principal.epoch !== authority.epoch ||
      principal.status !== 'active'
    ) {
      return { mode: 'denied', status: 401 };
    }
    return { mode: 'account', principal };
  } catch {
    return { mode: 'denied', status: 401 };
  }
}

export function accountMembershipMatchesLegacyIds(
  principal: CampaignMembershipPrincipal,
  assertedIds: readonly unknown[]
): boolean {
  if (principal.role === 'owner') return true;
  if (!principal.legacyPlayerId || !principal.legacyCharacterId) return false;
  return assertedIds.every(
    value =>
      value === undefined ||
      value === null ||
      value === principal.legacyPlayerId ||
      value === principal.legacyCharacterId
  );
}
