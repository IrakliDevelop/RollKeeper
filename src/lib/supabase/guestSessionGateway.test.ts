import { describe, expect, it, vi } from 'vitest';

import {
  createGuestApplicationGateway,
  createGuestOwnerGateway,
} from './guestSessionGateway';

const invitation = {
  invitationId: 'invitation-a',
  campaignId: 'campaign-a',
  displayCode: 'A1B2C3D4E5F6',
  legacyPlayerId: 'player-a',
  scopes: ['player:sync'],
  expiresAt: '2026-08-19T01:00:00.000Z',
  maxUses: 1,
  useCount: 0,
};
const session = {
  sessionId: 'session-a',
  invitationId: 'invitation-a',
  campaignId: 'campaign-a',
  displayCode: 'A1B2C3D4E5F6',
  subjectId: 'subject-a',
  legacyPlayerId: 'player-a',
  scopes: ['player:sync'],
  expiresAt: '2026-08-19T04:00:00.000Z',
};

function result(data: unknown, error: unknown = null) {
  return { data, error };
}

describe('guest session database gateways', () => {
  it('issues only a hash through the authenticated owner RPC', async () => {
    const rpc = vi.fn().mockResolvedValue(result(invitation));
    const gateway = createGuestOwnerGateway({ rpc });

    await expect(
      gateway.issue({
        mutationId: 'mutation-a',
        campaignId: 'campaign-a',
        tokenHash: 'a'.repeat(64),
        expiresAt: '2026-08-19T01:00:00.000Z',
        maxUses: 1,
        legacyPlayerId: 'player-a',
      })
    ).resolves.toEqual(invitation);
    expect(rpc).toHaveBeenCalledWith('issue_campaign_guest_invitation', {
      p_mutation_id: 'mutation-a',
      p_campaign_id: 'campaign-a',
      p_token_hash: `\\x${'a'.repeat(64)}`,
      p_expires_at: '2026-08-19T01:00:00.000Z',
      p_max_uses: 1,
      p_legacy_player_id: 'player-a',
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('raw-token');
  });

  it('uses only private service RPCs for redemption, authorization, rotation, and rate limits', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce(result(session))
      .mockResolvedValueOnce(result(true))
      .mockResolvedValueOnce(result(session))
      .mockResolvedValueOnce(result({ ...session, sessionId: 'session-b' }));
    const gateway = createGuestApplicationGateway({ rpc });

    await gateway.redeem({
      mutationId: 'mutation-a',
      tokenHash: 'a'.repeat(64),
      requestHash: 'b'.repeat(64),
      subjectId: 'subject-a',
      sessionTokenHash: 'c'.repeat(64),
      sessionExpiresAt: '2026-08-19T04:00:00.000Z',
    });
    await expect(
      gateway.consumeRateLimit({
        keyHash: 'd'.repeat(64),
        action: 'redeem',
        limit: 10,
        windowSeconds: 60,
      })
    ).resolves.toBe(true);
    await gateway.authorize({
      sessionTokenHash: 'e'.repeat(64),
      displayCode: 'A1B2C3D4E5F6',
      requiredScope: 'player:sync',
    });
    await gateway.rotate({
      mutationId: 'mutation-b',
      currentTokenHash: 'e'.repeat(64),
      requestHash: 'f'.repeat(64),
      newTokenHash: '1'.repeat(64),
      newExpiresAt: '2026-08-19T05:00:00.000Z',
    });

    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'redeem_campaign_guest_invitation',
      'consume_guest_rate_limit',
      'authorize_campaign_guest_session',
      'rotate_campaign_guest_session',
    ]);
  });

  it('rejects malformed authority responses and exposes only safe errors', async () => {
    const malformed = createGuestApplicationGateway({
      rpc: vi.fn().mockResolvedValue(result({ dmId: 'private' })),
    });
    await expect(
      malformed.authorize({
        sessionTokenHash: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:sync',
      })
    ).rejects.toThrow(/invalid guest authority response/u);

    const denied = createGuestApplicationGateway({
      rpc: vi.fn().mockResolvedValue(
        result(null, {
          code: '42501',
          message: 'guest session is not authorized',
        })
      ),
    });
    await expect(
      denied.authorize({
        sessionTokenHash: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:sync',
      })
    ).rejects.toMatchObject({ category: 'denied' });
  });

  it('rejects malformed hashes, invitation/session DTOs, and rate responses', async () => {
    const owner = createGuestOwnerGateway({
      rpc: vi.fn().mockResolvedValue(result(invitation)),
    });
    await expect(
      owner.issue({
        mutationId: 'mutation-a',
        campaignId: 'campaign-a',
        tokenHash: 'raw-token',
        expiresAt: invitation.expiresAt,
        maxUses: 1,
        legacyPlayerId: null,
      })
    ).rejects.toThrow(/invalid secret hash/iu);

    const malformedOwner = createGuestOwnerGateway({
      rpc: vi.fn().mockResolvedValue(result(null)),
    });
    await expect(
      malformedOwner.issue({
        mutationId: 'mutation-a',
        campaignId: 'campaign-a',
        tokenHash: 'a'.repeat(64),
        expiresAt: invitation.expiresAt,
        maxUses: 1,
        legacyPlayerId: null,
      })
    ).rejects.toThrow(/invalid guest authority response/iu);

    const malformedSession = createGuestApplicationGateway({
      rpc: vi
        .fn()
        .mockResolvedValue(result({ ...session, displayCode: 'bad' })),
    });
    await expect(
      malformedSession.rotate({
        mutationId: 'mutation-a',
        currentTokenHash: 'a'.repeat(64),
        requestHash: 'b'.repeat(64),
        newTokenHash: 'c'.repeat(64),
        newExpiresAt: session.expiresAt,
      })
    ).rejects.toThrow(/invalid guest session response/iu);

    const malformedRate = createGuestApplicationGateway({
      rpc: vi.fn().mockResolvedValue(result('yes')),
    });
    await expect(
      malformedRate.consumeRateLimit({
        keyHash: 'd'.repeat(64),
        action: 'invalid',
        limit: 1,
        windowSeconds: 60,
      })
    ).rejects.toThrow(/invalid rate limit response/iu);
  });

  it('classifies rate-limit and generic RPC failures without exposing authority data', async () => {
    const rateLimited = createGuestApplicationGateway({
      rpc: vi
        .fn()
        .mockResolvedValue(
          result(null, { code: 'P0001', message: 'guest rate limit exceeded' })
        ),
    });
    await expect(
      rateLimited.authorize({
        sessionTokenHash: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:read',
      })
    ).rejects.toMatchObject({ category: 'rate-limited' });

    const failed = createGuestApplicationGateway({
      rpc: vi
        .fn()
        .mockResolvedValue(
          result(null, { code: 'XX000', message: 'application failure' })
        ),
    });
    await expect(
      failed.authorize({
        sessionTokenHash: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        requiredScope: 'player:read',
      })
    ).rejects.toMatchObject({ category: 'failed' });
  });
});
