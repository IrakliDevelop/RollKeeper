import { describe, it, expect, beforeEach } from 'vitest';
import { useDmStore } from '@/store/dmStore';
import { createMockCampaignInfo } from '@/test/helpers';

describe('dmStore', () => {
  beforeEach(() => {
    const { setState } = useDmStore;
    setState({
      dmId: 'dm-test-fixed',
      campaigns: [],
    });
  });

  it('has a generated dmId', () => {
    const state = useDmStore.getState();
    expect(state.dmId).toBe('dm-test-fixed');
  });

  it('starts with empty campaigns', () => {
    const state = useDmStore.getState();
    expect(state.campaigns).toEqual([]);
  });

  describe('addCampaign', () => {
    it('appends a campaign', () => {
      const campaign = createMockCampaignInfo({ code: 'AAA111' });
      useDmStore.getState().addCampaign(campaign);

      const state = useDmStore.getState();
      expect(state.campaigns).toHaveLength(1);
      expect(state.campaigns[0]).toEqual(campaign);
    });

    it('appends multiple campaigns', () => {
      const c1 = createMockCampaignInfo({ code: 'AAA111', name: 'First' });
      const c2 = createMockCampaignInfo({ code: 'BBB222', name: 'Second' });

      useDmStore.getState().addCampaign(c1);
      useDmStore.getState().addCampaign(c2);

      const state = useDmStore.getState();
      expect(state.campaigns).toHaveLength(2);
      expect(state.campaigns[0].code).toBe('AAA111');
      expect(state.campaigns[1].code).toBe('BBB222');
    });
  });

  describe('removeCampaign', () => {
    it('removes only the target campaign', () => {
      const c1 = createMockCampaignInfo({ code: 'AAA111' });
      const c2 = createMockCampaignInfo({ code: 'BBB222' });
      useDmStore.getState().addCampaign(c1);
      useDmStore.getState().addCampaign(c2);

      useDmStore.getState().removeCampaign('AAA111');

      const state = useDmStore.getState();
      expect(state.campaigns).toHaveLength(1);
      expect(state.campaigns[0].code).toBe('BBB222');
    });

    it('is a no-op for unknown code', () => {
      const c1 = createMockCampaignInfo({ code: 'AAA111' });
      useDmStore.getState().addCampaign(c1);

      useDmStore.getState().removeCampaign('XXXXXX');

      expect(useDmStore.getState().campaigns).toHaveLength(1);
    });
  });

  describe('getCampaign', () => {
    it('returns the matching campaign', () => {
      const campaign = createMockCampaignInfo({
        code: 'AAA111',
        name: 'My Game',
      });
      useDmStore.getState().addCampaign(campaign);

      const found = useDmStore.getState().getCampaign('AAA111');
      expect(found).toEqual(campaign);
    });

    it('returns undefined for unknown code', () => {
      const found = useDmStore.getState().getCampaign('XXXXXX');
      expect(found).toBeUndefined();
    });
  });
});
