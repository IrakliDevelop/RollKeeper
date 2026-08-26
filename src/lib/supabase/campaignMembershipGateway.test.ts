import { describe, expect, it, vi } from 'vitest';

import {
  createCampaignMembershipApplicationGateway,
  createCampaignMembershipUserGateway,
} from './campaignMembershipGateway';

function response(data: unknown, error: unknown = null) {
  return { data, error };
}

describe('campaign membership gateways', () => {
  it('sends only a token hash and account binding to invitation RPCs', async () => {
    const rpc = vi.fn().mockResolvedValue(
      response({
        invitationId: 'invite-a',
        campaignId: 'campaign-a',
        invitedAccountId: 'account-a',
        role: 'player',
        legacyPlayerId: null,
        guestSubjectId: null,
        expiresAt: '2026-08-20T01:00:00.000Z',
        maxUses: 1,
        useCount: 0,
        status: 'pending',
      })
    );
    const gateway = createCampaignMembershipUserGateway({ rpc });
    await gateway.issue({
      mutationId: 'mutation-a',
      campaignId: 'campaign-a',
      invitedAccountId: 'account-a',
      tokenHash: 'a'.repeat(64),
      expiresAt: '2026-08-20T01:00:00.000Z',
      maxUses: 1,
      role: 'player',
      legacyPlayerId: null,
      guestSubjectId: null,
    });
    expect(rpc).toHaveBeenCalledWith('issue_campaign_membership_invitation', {
      p_mutation_id: 'mutation-a',
      p_campaign_id: 'campaign-a',
      p_invited_account_id: 'account-a',
      p_token_hash: `\\x${'a'.repeat(64)}`,
      p_expires_at: '2026-08-20T01:00:00.000Z',
      p_max_uses: 1,
      p_role: 'player',
      p_legacy_player_id: null,
      p_guest_subject_id: null,
    });
  });

  it('validates server authority and safe account principal DTOs', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          campaignId: 'campaign-a',
          ownerId: 'owner-a',
          displayCode: 'A1B2C3D4E5F6',
          authority: 'postgres',
          epoch: 2,
          freezeState: 'postgres',
        })
      )
      .mockResolvedValueOnce(
        response({
          campaignId: 'campaign-a',
          accountId: 'account-a',
          role: 'player',
          status: 'active',
          epoch: 2,
          legacyPlayerId: 'legacy-a',
          legacyCharacterId: 'legacy-char-a',
          characterId: 'cloud-char-a',
        })
      );
    const application = createCampaignMembershipApplicationGateway({ rpc });
    const user = createCampaignMembershipUserGateway({ rpc });
    await expect(
      application.resolveAuthority('A1B2C3D4E5F6')
    ).resolves.toMatchObject({ authority: 'postgres', epoch: 2 });
    await expect(user.authorize('campaign-a', 2)).resolves.toMatchObject({
      accountId: 'account-a',
      characterId: 'cloud-char-a',
    });
  });

  it('returns only safe active membership fields for reload restoration', async () => {
    const rpc = vi.fn().mockResolvedValue(
      response({
        memberships: [
          {
            campaignId: 'campaign-a',
            role: 'player',
            status: 'active',
            epoch: 0,
          },
        ],
      })
    );
    const gateway = createCampaignMembershipUserGateway({ rpc });

    await expect(gateway.listMine()).resolves.toEqual({
      memberships: [
        {
          campaignId: 'campaign-a',
          role: 'player',
          status: 'active',
          epoch: 0,
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith('list_my_campaign_memberships', {});
  });

  it('fails closed on malformed, cross-campaign, or private-field responses', async () => {
    const gateway = createCampaignMembershipApplicationGateway({
      rpc: vi
        .fn()
        .mockResolvedValue(response({ authority: 'legacy', dmId: 'private' })),
    });
    await expect(gateway.resolveAuthority('A1B2C3D4E5F6')).rejects.toThrow(
      /invalid membership authority response/iu
    );
  });

  it('maps not-managed, denied, rate-limit, and generic database errors without leaking details', async () => {
    for (const [error, category] of [
      [{ code: '42501', message: 'private detail' }, 'denied'],
      [
        { code: 'P0001', message: 'membership issuance rate limit exceeded' },
        'rate-limited',
      ],
      [{ code: 'XX000', message: 'database unavailable' }, 'failed'],
    ] as const) {
      const gateway = createCampaignMembershipApplicationGateway({
        rpc: vi.fn().mockResolvedValue(response(null, error)),
      });
      await expect(
        gateway.resolveAuthority('A1B2C3D4E5F6')
      ).rejects.toMatchObject({ category });
    }
    const unmanaged = createCampaignMembershipApplicationGateway({
      rpc: vi.fn().mockResolvedValue(response({ managed: false })),
    });
    await expect(
      unmanaged.resolveAuthority('A1B2C3D4E5F6')
    ).rejects.toMatchObject({ category: 'not-managed' });
  });

  it('rejects invalid hashes and malformed invitation or principal DTOs', async () => {
    const rpc = vi.fn().mockResolvedValue(response({}));
    const gateway = createCampaignMembershipUserGateway({ rpc });
    expect(() =>
      gateway.accept({
        mutationId: 'm',
        tokenHash: 'bad',
        decision: 'accepted',
      })
    ).toThrow(/invalid membership secret hash/iu);
    await expect(
      gateway.issue({
        mutationId: 'm',
        campaignId: 'c',
        invitedAccountId: 'a',
        tokenHash: 'a'.repeat(64),
        expiresAt: 'now',
        maxUses: 1,
        role: 'player',
        legacyPlayerId: null,
        guestSubjectId: null,
      })
    ).rejects.toThrow(/invalid membership invitation response/iu);
    await expect(gateway.authorize('c', 1)).rejects.toThrow(
      /invalid account membership response/iu
    );
  });

  it('forwards acceptance, linking, unlinking, and account authorization with safe scalar fields', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce(response({ status: 'active' }))
      .mockResolvedValueOnce(response({ status: 'active' }))
      .mockResolvedValueOnce(response({ status: 'unlinked' }))
      .mockResolvedValueOnce(response({ status: 'revoked' }))
      .mockResolvedValueOnce(
        response({
          campaignId: 'c',
          accountId: 'a',
          role: 'owner',
          status: 'active',
          epoch: 3,
          legacyPlayerId: null,
          legacyCharacterId: null,
          characterId: null,
        })
      );
    const gateway = createCampaignMembershipUserGateway({ rpc });
    await gateway.accept({
      mutationId: 'm1',
      tokenHash: 'a'.repeat(64),
      decision: 'refused',
    });
    await gateway.linkCharacter({
      mutationId: 'm2',
      campaignId: 'c',
      characterId: 'x',
      legacyPlayerId: 'lp',
      legacyCharacterId: 'lc',
      guestSubjectId: 'g',
    });
    await gateway.unlinkCharacter({
      mutationId: 'm3',
      campaignId: 'c',
      characterId: 'x',
    });
    await gateway.revoke({ mutationId: 'm4', invitationId: 'i' });
    await expect(gateway.authorize('c', 3)).resolves.toMatchObject({
      role: 'owner',
      epoch: 3,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'accept_campaign_membership_invitation',
      'link_campaign_character',
      'unlink_campaign_character',
      'revoke_campaign_membership_invitation',
      'authorize_campaign_membership',
    ]);
  });
});
