import { createHash, randomBytes } from 'node:crypto';

const MEMBERSHIP_SECRET_BYTES = 32;

export function generateCampaignMembershipSecret(): string {
  return randomBytes(MEMBERSHIP_SECRET_BYTES).toString('hex');
}

export function hashCampaignMembershipSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}
