import { describe, expect, it, vi } from 'vitest';

import { hashGuestSecret } from './guestSessionCrypto';
import { GuestSessionService } from './guestSessionService';

function gateway() {
  return {
    authorize: vi.fn(),
    consumeRateLimit: vi.fn().mockResolvedValue(true),
    issue: vi.fn(),
    redeem: vi.fn(),
    rotate: vi.fn(),
  };
}

describe('GuestSessionService', () => {
  it('makes zero database or token calls while disabled', async () => {
    const database = gateway();
    const service = new GuestSessionService({
      enabled: false,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      randomSecret: vi.fn(),
      randomUuid: vi.fn(),
    });

    await expect(
      service.redeem({
        invitationToken: 'a'.repeat(64),
        mutationId: 'mutation-a',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'disabled' });
    expect(database.consumeRateLimit).not.toHaveBeenCalled();
    expect(database.redeem).not.toHaveBeenCalled();
    await expect(
      service.issue({
        campaignId: 'campaign-a',
        legacyPlayerId: null,
        expiresInMinutes: 30,
        maxUses: 1,
      })
    ).resolves.toEqual({ status: 'disabled' });
    await expect(
      service.rotate({
        currentSessionToken: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        mutationId: 'mutation-a',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'disabled' });
  });

  it('issues a hashed invitation and returns the raw secret only once to the caller', async () => {
    const database = gateway();
    database.issue.mockResolvedValue({
      invitationId: 'invitation-a',
      campaignId: 'campaign-a',
      displayCode: 'A1B2C3D4E5F6',
      legacyPlayerId: 'player-a',
      scopes: ['player:sync'],
      expiresAt: '2026-08-19T01:00:00.000Z',
      maxUses: 1,
      useCount: 0,
    });
    const rawToken = 'a'.repeat(64);
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      randomSecret: () => rawToken,
      randomUuid: () => 'mutation-a',
      now: () => new Date('2026-08-19T00:00:00.000Z'),
    });

    await expect(
      service.issue({
        campaignId: 'campaign-a',
        legacyPlayerId: 'player-a',
        expiresInMinutes: 30,
        maxUses: 1,
      })
    ).resolves.toMatchObject({ status: 'issued', invitationToken: rawToken });
    expect(database.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: hashGuestSecret(rawToken),
        legacyPlayerId: 'player-a',
      })
    );
    expect(JSON.stringify(database.issue.mock.calls)).not.toContain(rawToken);
  });

  it('redeems idempotently into a derived session and rate-limits before validation', async () => {
    const database = gateway();
    database.redeem.mockResolvedValue({
      sessionId: 'session-a',
      invitationId: 'invitation-a',
      campaignId: 'campaign-a',
      displayCode: 'A1B2C3D4E5F6',
      subjectId: 'subject-a',
      legacyPlayerId: 'player-a',
      scopes: ['player:sync'],
      expiresAt: '2026-08-19T04:00:00.000Z',
    });
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      randomSecret: () => 'unused',
      randomUuid: vi
        .fn()
        .mockReturnValueOnce('subject-a')
        .mockReturnValueOnce('unused-id'),
      now: () => new Date('2026-08-19T00:00:00.000Z'),
    });
    const input = {
      invitationToken: 'a'.repeat(64),
      mutationId: '10000000-0000-4000-8000-000000000001',
      rateKeyHash: 'b'.repeat(64),
    };

    const first = await service.redeem(input);
    const replay = await service.redeem(input);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ status: 'redeemed', sessionId: 'session-a' });
    expect(database.consumeRateLimit).toHaveBeenNthCalledWith(1, {
      keyHash: 'b'.repeat(64),
      action: 'redeem',
      limit: 10,
      windowSeconds: 60,
    });
    expect(database.redeem).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionExpiresAt: '2026-10-18T00:00:00.000Z',
        tokenHash: hashGuestSecret('a'.repeat(64)),
        sessionTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      })
    );
    expect((first as { sessionToken: string }).sessionToken).toMatch(
      /^[a-f0-9]{64}$/u
    );
  });

  it('records invalid validation attempts and denies an exhausted rate bucket', async () => {
    const database = gateway();
    database.consumeRateLimit.mockResolvedValueOnce(false);
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
    });

    await expect(
      service.redeem({
        invitationToken: 'fabricated',
        mutationId: 'mutation-a',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'rate-limited' });
    expect(database.redeem).not.toHaveBeenCalled();
  });

  it('records a malformed invitation before denying it', async () => {
    const database = gateway();
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
    });
    await expect(
      service.redeem({
        invitationToken: 'fabricated',
        mutationId: 'mutation-a',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'denied' });
    expect(database.consumeRateLimit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'invalid' })
    );
  });

  it('enforces the failed-validation bucket after a rejected token lookup', async () => {
    const database = gateway();
    database.redeem.mockRejectedValue(new Error('denied'));
    database.consumeRateLimit
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
    });

    await expect(
      service.redeem({
        invitationToken: 'a'.repeat(64),
        mutationId: '10000000-0000-4000-8000-000000000010',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'rate-limited' });
  });

  it('rotates the cookie secret and preserves the database-bound identity only', async () => {
    const database = gateway();
    database.authorize.mockResolvedValue({
      sessionId: 'session-a',
      campaignId: 'campaign-a',
      subjectId: 'subject-a',
      legacyPlayerId: 'player-a',
      scopes: ['player:sync'],
      expiresAt: '2026-08-19T04:00:00.000Z',
    });
    database.rotate.mockResolvedValue({
      sessionId: 'session-b',
      invitationId: 'invitation-a',
      campaignId: 'campaign-a',
      displayCode: 'A1B2C3D4E5F6',
      subjectId: 'subject-a',
      legacyPlayerId: 'player-a',
      scopes: ['player:sync'],
      expiresAt: '2026-08-19T05:00:00.000Z',
    });
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      now: () => new Date('2026-08-19T01:00:00.000Z'),
    });

    const result = await service.rotate({
      currentSessionToken: 'a'.repeat(64),
      displayCode: 'A1B2C3D4E5F6',
      mutationId: '10000000-0000-4000-8000-000000000002',
      rateKeyHash: 'b'.repeat(64),
    });
    expect(result).toMatchObject({ status: 'rotated', sessionId: 'session-b' });
    expect((result as { sessionToken: string }).sessionToken).not.toBe(
      'a'.repeat(64)
    );
    expect(database.rotate).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTokenHash: hashGuestSecret('a'.repeat(64)),
        newExpiresAt: '2026-10-18T01:00:00.000Z',
      })
    );
  });

  it('hashes authorization cookies and rate-limits rotation failures', async () => {
    const database = gateway();
    database.authorize.mockResolvedValue({ sessionId: 'session-a' });
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
    });
    await service.authorize({
      sessionToken: 'a'.repeat(64),
      displayCode: 'A1B2C3D4E5F6',
      requiredScope: 'player:read',
    });
    expect(database.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionTokenHash: hashGuestSecret('a'.repeat(64)),
      })
    );

    database.consumeRateLimit.mockResolvedValueOnce(false);
    await expect(
      service.rotate({
        currentSessionToken: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        mutationId: 'mutation-a',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'rate-limited' });
  });

  it('counts a rejected rotation in the invalid-attempt bucket', async () => {
    const database = gateway();
    database.rotate.mockRejectedValue(new Error('denied'));
    const service = new GuestSessionService({
      enabled: true,
      database,
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
    });
    await expect(
      service.rotate({
        currentSessionToken: 'a'.repeat(64),
        displayCode: 'A1B2C3D4E5F6',
        mutationId: 'mutation-a',
        rateKeyHash: 'b'.repeat(64),
      })
    ).resolves.toEqual({ status: 'denied' });
    expect(database.consumeRateLimit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'invalid' })
    );
  });
});
