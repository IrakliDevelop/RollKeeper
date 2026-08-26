import { hashCampaignMembershipSecret } from './campaignMembershipToken';

export interface MembershipInvitationInput {
  mutationId: string;
  campaignId: string;
  invitedAccountId: string;
  tokenHash: string;
  expiresAt: string;
  maxUses: number;
  role: 'dm' | 'player';
  legacyPlayerId: string | null;
  guestSubjectId: string | null;
}

interface CampaignMembershipDatabase {
  listMine(): Promise<unknown>;
  issue(input: MembershipInvitationInput): Promise<unknown>;
  accept(input: {
    mutationId: string;
    tokenHash: string;
    decision: 'accepted' | 'refused';
  }): Promise<unknown>;
  linkCharacter(input: {
    mutationId: string;
    campaignId: string;
    characterId: string;
    legacyPlayerId: string | null;
    legacyCharacterId: string | null;
    guestSubjectId: string | null;
  }): Promise<unknown>;
  unlinkCharacter(input: {
    mutationId: string;
    campaignId: string;
    characterId: string;
  }): Promise<unknown>;
  revoke(input: { mutationId: string; invitationId: string }): Promise<unknown>;
}

interface CampaignMembershipServiceOptions {
  enabled: boolean;
  database: CampaignMembershipDatabase;
}

export class CampaignMembershipService {
  constructor(private readonly options: CampaignMembershipServiceOptions) {}

  async listMine() {
    if (!this.options.enabled) return { memberships: [] };
    return this.options.database.listMine();
  }

  async issue(input: {
    mutationId: string;
    tokenHash: string;
    campaignId: string;
    invitedAccountId: string;
    legacyPlayerId: string | null;
    guestSubjectId: string | null;
    expiresAt: string;
    maxUses: number;
    role: 'dm' | 'player';
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    if (!/^[a-f0-9]{64}$/u.test(input.tokenHash)) {
      return { status: 'denied' as const };
    }
    const invitation = await this.options.database.issue({
      mutationId: input.mutationId,
      campaignId: input.campaignId,
      invitedAccountId: input.invitedAccountId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
      role: input.role,
      legacyPlayerId: input.legacyPlayerId,
      guestSubjectId: input.guestSubjectId,
    });
    return { status: 'issued' as const, invitation };
  }

  async respond(input: {
    invitationToken: string;
    mutationId: string;
    decision: 'accepted' | 'refused';
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    if (!/^[a-f0-9]{64}$/u.test(input.invitationToken)) {
      return { status: 'denied' as const };
    }
    return this.options.database.accept({
      mutationId: input.mutationId,
      tokenHash: hashCampaignMembershipSecret(input.invitationToken),
      decision: input.decision,
    });
  }

  async revoke(input: { mutationId: string; invitationId: string }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    return this.options.database.revoke(input);
  }

  async linkCharacter(input: {
    mutationId: string;
    campaignId: string;
    characterId: string;
    legacyPlayerId: string | null;
    legacyCharacterId: string | null;
    guestSubjectId: string | null;
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    return this.options.database.linkCharacter(input);
  }

  async unlinkCharacter(input: {
    mutationId: string;
    campaignId: string;
    characterId: string;
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    return this.options.database.unlinkCharacter(input);
  }
}
