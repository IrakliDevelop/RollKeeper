import { createHash, createHmac, randomBytes } from 'node:crypto';

const SECRET_BYTES = 32;
const MIN_PEPPER_BYTES = 32;

export type GuestSessionDerivationPurpose = 'redeem' | 'rotate';

export function generateGuestInvitationSecret(): string {
  return randomBytes(SECRET_BYTES).toString('hex');
}

export function hashGuestSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function deriveGuestSessionSecret(input: {
  sourceSecret: string;
  mutationId: string;
  pepper: string;
  purpose: GuestSessionDerivationPurpose;
}): string {
  if (Buffer.byteLength(input.pepper, 'utf8') < MIN_PEPPER_BYTES) {
    throw new Error('Guest session pepper must contain at least 32 bytes');
  }

  return createHmac('sha256', input.pepper)
    .update('rollkeeper-guest-session-v1\0', 'utf8')
    .update(input.purpose, 'utf8')
    .update('\0', 'utf8')
    .update(input.mutationId, 'utf8')
    .update('\0', 'utf8')
    .update(input.sourceSecret, 'utf8')
    .digest('hex');
}
