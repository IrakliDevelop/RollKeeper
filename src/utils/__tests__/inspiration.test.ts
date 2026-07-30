import { describe, it, expect } from 'vitest';
import { campaignStackableToMaterialize } from '@/utils/inspiration';

describe('campaignStackableToMaterialize', () => {
  it('returns null for a solo character (never overwrites their preference)', () => {
    expect(campaignStackableToMaterialize(false, true, undefined)).toBeNull();
    expect(campaignStackableToMaterialize(false, false, true)).toBeNull();
  });

  it('returns null in a campaign until shared state has loaded', () => {
    expect(campaignStackableToMaterialize(true, false, undefined)).toBeNull();
  });

  it('defaults to false in a campaign when the DM has set nothing', () => {
    expect(campaignStackableToMaterialize(true, true, undefined)).toBe(false);
  });

  it('reflects the DM setting once loaded', () => {
    expect(campaignStackableToMaterialize(true, true, true)).toBe(true);
    expect(campaignStackableToMaterialize(true, true, false)).toBe(false);
  });
});
