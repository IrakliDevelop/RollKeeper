import { describe, expect, it, vi } from 'vitest';

import { hashCampaignMembershipSecret } from './campaignMembershipToken';
import { CampaignMembershipService } from './campaignMembershipService';

function database() {
  return {
    listMine: vi.fn(),
    issue: vi.fn(),
    accept: vi.fn(),
    linkCharacter: vi.fn(),
    unlinkCharacter: vi.fn(),
    revoke: vi.fn(),
  };
}

describe('CampaignMembershipService', () => {
  it('lists only the signed-in account memberships and stays inert while disabled', async () => {
    const db = database();
    db.listMine.mockResolvedValue({
      memberships: [{ campaignId: 'campaign-a' }],
    });
    await expect(
      new CampaignMembershipService({ enabled: true, database: db }).listMine()
    ).resolves.toEqual({ memberships: [{ campaignId: 'campaign-a' }] });
    expect(db.listMine).toHaveBeenCalledOnce();

    db.listMine.mockClear();
    await expect(
      new CampaignMembershipService({ enabled: false, database: db }).listMine()
    ).resolves.toEqual({ memberships: [] });
    expect(db.listMine).not.toHaveBeenCalled();
  });

  it('makes zero token or database calls while disabled', async () => {
    const db = database();
    const service = new CampaignMembershipService({
      enabled: false,
      database: db,
    });
    await expect(
      service.issue({
        mutationId: 'mutation-a',
        tokenHash: 'a'.repeat(64),
        campaignId: 'campaign-a',
        invitedAccountId: 'account-a',
        legacyPlayerId: 'legacy-a',
        guestSubjectId: null,
        expiresAt: '2026-08-20T00:30:00.000Z',
        maxUses: 1,
        role: 'player',
      })
    ).resolves.toEqual({ status: 'disabled' });
    expect(db.issue).not.toHaveBeenCalled();
  });

  it('issues an account-bound invitation from only a client-generated secret hash', async () => {
    const db = database();
    db.issue.mockResolvedValue({
      invitationId: 'invite-a',
      campaignId: 'campaign-a',
      invitedAccountId: 'account-a',
      role: 'player',
      legacyPlayerId: 'legacy-a',
      guestSubjectId: null,
      expiresAt: '2026-08-20T00:30:00.000Z',
      maxUses: 1,
      useCount: 0,
      status: 'pending',
    });
    const rawToken = 'owner-generated-secret';
    const tokenHash = hashCampaignMembershipSecret(rawToken);
    const service = new CampaignMembershipService({
      enabled: true,
      database: db,
    });

    await expect(
      service.issue({
        mutationId: 'mutation-a',
        tokenHash,
        campaignId: 'campaign-a',
        invitedAccountId: 'account-a',
        legacyPlayerId: 'legacy-a',
        guestSubjectId: null,
        expiresAt: '2026-08-20T00:30:00.000Z',
        maxUses: 1,
        role: 'player',
      })
    ).resolves.toMatchObject({ status: 'issued' });
    expect(db.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationId: 'mutation-a',
        tokenHash,
      })
    );
    expect(JSON.stringify(db.issue.mock.calls)).not.toContain(rawToken);
  });

  it('denies a malformed client hash before database access', async () => {
    const db = database();
    const service = new CampaignMembershipService({
      enabled: true,
      database: db,
    });
    await expect(
      service.issue({
        mutationId: 'mutation-a',
        tokenHash: 'raw-secret',
        campaignId: 'campaign-a',
        invitedAccountId: 'account-a',
        legacyPlayerId: null,
        guestSubjectId: null,
        expiresAt: '2026-08-20T00:05:00.000Z',
        maxUses: 1,
        role: 'player',
      })
    ).resolves.toEqual({ status: 'denied' });
    expect(db.issue).not.toHaveBeenCalled();
  });

  it('accepts or refuses explicitly and never uploads or claims a local character', async () => {
    const db = database();
    db.accept.mockResolvedValue({ status: 'active', campaignId: 'campaign-a' });
    const service = new CampaignMembershipService({
      enabled: true,
      database: db,
    });
    await service.respond({
      invitationToken: 'b'.repeat(64),
      mutationId: 'mutation-a',
      decision: 'accepted',
    });
    expect(db.accept).toHaveBeenCalledWith({
      mutationId: 'mutation-a',
      tokenHash: hashCampaignMembershipSecret('b'.repeat(64)),
      decision: 'accepted',
    });
    expect(JSON.stringify(db.accept.mock.calls)).not.toMatch(
      /characterData|payload|localStorage/iu
    );
  });

  it('denies malformed invitation secrets and makes disabled response/link calls inert', async () => {
    const db = database();
    const enabled = new CampaignMembershipService({
      enabled: true,
      database: db,
    });
    await expect(
      enabled.respond({
        invitationToken: 'not-a-token',
        mutationId: 'm',
        decision: 'refused',
      })
    ).resolves.toEqual({ status: 'denied' });
    expect(db.accept).not.toHaveBeenCalled();

    const disabled = new CampaignMembershipService({
      enabled: false,
      database: db,
    });
    await expect(
      disabled.respond({
        invitationToken: 'a'.repeat(64),
        mutationId: 'm',
        decision: 'refused',
      })
    ).resolves.toEqual({ status: 'disabled' });
    await expect(
      disabled.linkCharacter({
        mutationId: 'm',
        campaignId: 'c',
        characterId: 'x',
        legacyPlayerId: null,
        legacyCharacterId: null,
        guestSubjectId: null,
      })
    ).resolves.toEqual({ status: 'disabled' });
    await expect(
      disabled.unlinkCharacter({
        mutationId: 'm',
        campaignId: 'c',
        characterId: 'x',
      })
    ).resolves.toEqual({ status: 'disabled' });
    await expect(
      disabled.revoke({ mutationId: 'm', invitationId: 'i' })
    ).resolves.toEqual({ status: 'disabled' });
    expect(db.accept).not.toHaveBeenCalled();
    expect(db.linkCharacter).not.toHaveBeenCalled();
    expect(db.unlinkCharacter).not.toHaveBeenCalled();
    expect(db.revoke).not.toHaveBeenCalled();
  });

  it('links only an explicitly named cloud character and never sends its payload', async () => {
    const db = database();
    db.linkCharacter.mockResolvedValue({ status: 'active' });
    const service = new CampaignMembershipService({
      enabled: true,
      database: db,
    });
    await service.linkCharacter({
      mutationId: 'mutation-a',
      campaignId: 'campaign-a',
      characterId: 'cloud-character-a',
      legacyPlayerId: 'legacy-player-a',
      legacyCharacterId: 'legacy-character-a',
      guestSubjectId: null,
    });
    expect(db.linkCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: 'cloud-character-a' })
    );
    expect(JSON.stringify(db.linkCharacter.mock.calls)).not.toMatch(
      /payload|characterData|paper/iu
    );
  });

  it('unlinks only the explicit campaign and cloud character IDs', async () => {
    const db = database();
    db.unlinkCharacter.mockResolvedValue({ status: 'unlinked' });
    const service = new CampaignMembershipService({
      enabled: true,
      database: db,
    });
    await expect(
      service.unlinkCharacter({
        mutationId: 'm',
        campaignId: 'c',
        characterId: 'x',
      })
    ).resolves.toEqual({ status: 'unlinked' });
    expect(db.unlinkCharacter).toHaveBeenCalledWith({
      mutationId: 'm',
      campaignId: 'c',
      characterId: 'x',
    });
  });

  it('revokes only an explicitly selected invitation', async () => {
    const db = database();
    db.revoke.mockResolvedValue({ status: 'revoked' });
    const service = new CampaignMembershipService({
      enabled: true,
      database: db,
    });
    await expect(
      service.revoke({ mutationId: 'm', invitationId: 'i' })
    ).resolves.toEqual({ status: 'revoked' });
    expect(db.revoke).toHaveBeenCalledWith({
      mutationId: 'm',
      invitationId: 'i',
    });
  });
});
