import { describe, expect, it } from 'vitest';

import {
  deriveGuestSessionSecret,
  generateGuestInvitationSecret,
  hashGuestSecret,
} from './guestSessionCrypto';

describe('guest session cryptography', () => {
  it('generates 256-bit opaque invitation secrets without weak identifiers', () => {
    const values = new Set(
      Array.from({ length: 64 }, () => generateGuestInvitationSecret())
    );

    expect(values.size).toBe(64);
    for (const value of values) {
      expect(value).toMatch(/^[a-f0-9]{64}$/u);
      expect(value).not.toContain('campaign');
    }
  });

  it('hashes secrets deterministically without retaining the raw value', () => {
    const raw = 'a'.repeat(64);
    expect(hashGuestSecret(raw)).toBe(hashGuestSecret(raw));
    expect(hashGuestSecret(raw)).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashGuestSecret(raw)).not.toContain(raw);
  });

  it('derives replay-stable but input-separated high-entropy session secrets', () => {
    const first = deriveGuestSessionSecret({
      sourceSecret: 'a'.repeat(64),
      mutationId: '10000000-0000-4000-8000-000000000001',
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      purpose: 'redeem',
    });
    const replay = deriveGuestSessionSecret({
      sourceSecret: 'a'.repeat(64),
      mutationId: '10000000-0000-4000-8000-000000000001',
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      purpose: 'redeem',
    });
    const rotated = deriveGuestSessionSecret({
      sourceSecret: 'a'.repeat(64),
      mutationId: '10000000-0000-4000-8000-000000000002',
      pepper: 'synthetic-server-pepper-at-least-32-bytes',
      purpose: 'rotate',
    });

    expect(first).toBe(replay);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(rotated).not.toBe(first);
  });

  it('rejects a server pepper below the minimum entropy boundary', () => {
    expect(() =>
      deriveGuestSessionSecret({
        sourceSecret: 'a'.repeat(64),
        mutationId: '10000000-0000-4000-8000-000000000001',
        pepper: 'too-short',
        purpose: 'redeem',
      })
    ).toThrow(/at least 32 bytes/u);
  });
});
