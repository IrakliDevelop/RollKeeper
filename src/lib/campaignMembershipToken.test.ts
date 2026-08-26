import { describe, expect, it } from 'vitest';

import {
  generateCampaignMembershipSecret,
  hashCampaignMembershipSecret,
} from './campaignMembershipToken';

describe('campaign membership invitation secrets', () => {
  it('generates independent 256-bit hex secrets and hashes them deterministically', () => {
    const first = generateCampaignMembershipSecret();
    const second = generateCampaignMembershipSecret();

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).not.toBe(first);
    expect(hashCampaignMembershipSecret(first)).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashCampaignMembershipSecret(first)).toBe(
      hashCampaignMembershipSecret(first)
    );
    expect(hashCampaignMembershipSecret(first)).not.toBe(first);
  });
});
