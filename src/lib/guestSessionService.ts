import { createHmac, randomUUID } from 'node:crypto';

import {
  deriveGuestSessionSecret,
  generateGuestInvitationSecret,
  hashGuestSecret,
} from './guestSessionCrypto';
import type {
  GuestInvitationRecord,
  GuestSessionPrincipal,
  GuestSessionRecord,
} from './supabase/guestSessionGateway';

interface GuestSessionDatabase {
  issue(input: {
    mutationId: string;
    campaignId: string;
    tokenHash: string;
    expiresAt: string;
    maxUses: number;
    legacyPlayerId: string | null;
  }): Promise<GuestInvitationRecord>;
  redeem(input: {
    mutationId: string;
    tokenHash: string;
    requestHash: string;
    subjectId: string;
    sessionTokenHash: string;
    sessionExpiresAt: string;
  }): Promise<GuestSessionRecord>;
  authorize(input: {
    sessionTokenHash: string;
    displayCode: string;
    requiredScope: string;
  }): Promise<GuestSessionPrincipal>;
  rotate(input: {
    mutationId: string;
    currentTokenHash: string;
    requestHash: string;
    newTokenHash: string;
    newExpiresAt: string;
  }): Promise<GuestSessionRecord>;
  consumeRateLimit(input: {
    keyHash: string;
    action: 'issue' | 'redeem' | 'rotate' | 'invalid';
    limit: number;
    windowSeconds: number;
  }): Promise<boolean>;
}

interface GuestSessionServiceOptions {
  enabled: boolean;
  database: GuestSessionDatabase;
  pepper: string;
  randomSecret?: () => string;
  randomUuid?: () => string;
  now?: () => Date;
}

function stableUuid(value: string, pepper: string): string {
  const hex = createHmac('sha256', pepper)
    .update('rollkeeper-guest-subject-v1\0', 'utf8')
    .update(value, 'utf8')
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  const raw = hex.join('');
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function requestHash(value: unknown): string {
  return hashGuestSecret(JSON.stringify(value));
}

export class GuestSessionService {
  private readonly randomSecret: () => string;
  private readonly randomUuid: () => string;
  private readonly now: () => Date;

  constructor(private readonly options: GuestSessionServiceOptions) {
    this.randomSecret = options.randomSecret ?? generateGuestInvitationSecret;
    this.randomUuid = options.randomUuid ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async issue(input: {
    campaignId: string;
    legacyPlayerId: string | null;
    expiresInMinutes: number;
    maxUses: number;
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    const invitationToken = this.randomSecret();
    const invitation = await this.options.database.issue({
      mutationId: this.randomUuid(),
      campaignId: input.campaignId,
      tokenHash: hashGuestSecret(invitationToken),
      expiresAt: new Date(
        this.now().valueOf() + input.expiresInMinutes * 60_000
      ).toISOString(),
      maxUses: input.maxUses,
      legacyPlayerId: input.legacyPlayerId,
    });
    return { status: 'issued' as const, invitationToken, invitation };
  }

  async redeem(input: {
    invitationToken: string;
    mutationId: string;
    rateKeyHash: string;
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    const allowed = await this.options.database.consumeRateLimit({
      keyHash: input.rateKeyHash,
      action: 'redeem',
      limit: 10,
      windowSeconds: 60,
    });
    if (!allowed) return { status: 'rate-limited' as const };
    if (!/^[a-f0-9]{64}$/u.test(input.invitationToken)) {
      return (await this.recordInvalid(input.rateKeyHash))
        ? { status: 'denied' as const }
        : { status: 'rate-limited' as const };
    }

    const sessionToken = deriveGuestSessionSecret({
      sourceSecret: input.invitationToken,
      mutationId: input.mutationId,
      pepper: this.options.pepper,
      purpose: 'redeem',
    });
    const tokenHash = hashGuestSecret(input.invitationToken);
    const subjectId = stableUuid(
      `${tokenHash}:${input.mutationId}`,
      this.options.pepper
    );
    const sessionExpiresAt = new Date(
      this.now().valueOf() + 4 * 60 * 60_000
    ).toISOString();
    const hash = requestHash({ tokenHash, subjectId });
    try {
      const session = await this.options.database.redeem({
        mutationId: input.mutationId,
        tokenHash,
        requestHash: hash,
        subjectId,
        sessionTokenHash: hashGuestSecret(sessionToken),
        sessionExpiresAt,
      });
      return {
        status: 'redeemed' as const,
        sessionToken,
        ...session,
      };
    } catch {
      return (await this.recordInvalid(input.rateKeyHash))
        ? { status: 'denied' as const }
        : { status: 'rate-limited' as const };
    }
  }

  authorize(input: {
    sessionToken: string;
    displayCode: string;
    requiredScope: string;
  }): Promise<GuestSessionPrincipal> {
    return this.options.database.authorize({
      sessionTokenHash: hashGuestSecret(input.sessionToken),
      displayCode: input.displayCode,
      requiredScope: input.requiredScope,
    });
  }

  async rotate(input: {
    currentSessionToken: string;
    displayCode: string;
    mutationId: string;
    rateKeyHash: string;
  }) {
    if (!this.options.enabled) return { status: 'disabled' as const };
    const allowed = await this.options.database.consumeRateLimit({
      keyHash: input.rateKeyHash,
      action: 'rotate',
      limit: 5,
      windowSeconds: 60,
    });
    if (!allowed) return { status: 'rate-limited' as const };
    try {
      const sessionToken = deriveGuestSessionSecret({
        sourceSecret: input.currentSessionToken,
        mutationId: input.mutationId,
        pepper: this.options.pepper,
        purpose: 'rotate',
      });
      const newExpiresAt = new Date(
        this.now().valueOf() + 4 * 60 * 60_000
      ).toISOString();
      const currentTokenHash = hashGuestSecret(input.currentSessionToken);
      const hash = requestHash({
        currentTokenHash,
        displayCode: input.displayCode,
      });
      const rotated = await this.options.database.rotate({
        mutationId: input.mutationId,
        currentTokenHash,
        requestHash: hash,
        newTokenHash: hashGuestSecret(sessionToken),
        newExpiresAt,
      });
      return { status: 'rotated' as const, sessionToken, ...rotated };
    } catch {
      return (await this.recordInvalid(input.rateKeyHash))
        ? { status: 'denied' as const }
        : { status: 'rate-limited' as const };
    }
  }

  async recordInvalid(keyHash: string): Promise<boolean> {
    return this.options.database.consumeRateLimit({
      keyHash,
      action: 'invalid',
      limit: 20,
      windowSeconds: 60,
    });
  }
}
