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

// ─── Additional action coverage ──────────────────────────────────────────────

describe('dmStore — updateCampaign', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-test-fixed', campaigns: [] });
  });

  it('merges updates into the target campaign', () => {
    const campaign = createMockCampaignInfo({
      code: 'AAA111',
      name: 'Old Name',
    });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().updateCampaign('AAA111', { name: 'New Name' });

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.name).toBe('New Name');
    expect(found?.code).toBe('AAA111');
  });

  it('does not affect other campaigns', () => {
    const c1 = createMockCampaignInfo({ code: 'AAA111', name: 'Campaign 1' });
    const c2 = createMockCampaignInfo({ code: 'BBB222', name: 'Campaign 2' });
    useDmStore.getState().addCampaign(c1);
    useDmStore.getState().addCampaign(c2);

    useDmStore.getState().updateCampaign('AAA111', { name: 'Updated' });

    const found2 = useDmStore.getState().getCampaign('BBB222');
    expect(found2?.name).toBe('Campaign 2');
  });

  it('is a no-op for unknown code', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().updateCampaign('XXXXXX', { name: 'Ghost' });

    expect(useDmStore.getState().campaigns).toHaveLength(1);
    expect(useDmStore.getState().campaigns[0].name).toBe('Test Campaign');
  });
});

describe('dmStore — setCustomCounterLabel', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-test-fixed', campaigns: [] });
  });

  it('sets a custom counter label on the campaign', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setCustomCounterLabel('AAA111', 'Gold Pieces');

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.customCounterLabel).toBe('Gold Pieces');
  });

  it('clears the label when passed undefined', () => {
    const campaign = createMockCampaignInfo({
      code: 'AAA111',
      customCounterLabel: 'Old Label',
    });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setCustomCounterLabel('AAA111', undefined);

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.customCounterLabel).toBeUndefined();
  });
});

describe('dmStore — adjustPlayerCounter', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-test-fixed', campaigns: [] });
  });

  it('increments the counter for a player', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().adjustPlayerCounter('AAA111', 'player-1', 3);

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.playerCounters?.['player-1']).toBe(3);
  });

  it('decrements the counter but clamps to 0', () => {
    const campaign = createMockCampaignInfo({
      code: 'AAA111',
      playerCounters: { 'player-1': 2 },
    });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().adjustPlayerCounter('AAA111', 'player-1', -10);

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.playerCounters?.['player-1']).toBe(0);
  });

  it('starts from 0 when no prior counter exists', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().adjustPlayerCounter('AAA111', 'player-new', 5);

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.playerCounters?.['player-new']).toBe(5);
  });
});

describe('dmStore — setPlayerCounter', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-test-fixed', campaigns: [] });
  });

  it('sets the counter to a specific value', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setPlayerCounter('AAA111', 'player-1', 7);

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.playerCounters?.['player-1']).toBe(7);
  });

  it('clamps negative values to 0', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setPlayerCounter('AAA111', 'player-1', -3);

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.playerCounters?.['player-1']).toBe(0);
  });
});

describe('dmStore — setPlayerColor / getPlayerColor', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-test-fixed', campaigns: [] });
  });

  it('sets a color for a player character', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setPlayerColor('AAA111', 'char-1', '#ff0000');

    expect(useDmStore.getState().getPlayerColor('AAA111', 'char-1')).toBe(
      '#ff0000'
    );
  });

  it('removes a color when passed undefined', () => {
    const campaign = createMockCampaignInfo({
      code: 'AAA111',
      playerColors: { 'char-1': '#ff0000' },
    });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setPlayerColor('AAA111', 'char-1', undefined);

    expect(
      useDmStore.getState().getPlayerColor('AAA111', 'char-1')
    ).toBeUndefined();
  });

  it('getPlayerColor returns undefined for unknown campaign', () => {
    expect(
      useDmStore.getState().getPlayerColor('XXXXXX', 'char-1')
    ).toBeUndefined();
  });

  it('getPlayerColor returns undefined for unknown character in existing campaign', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    expect(
      useDmStore.getState().getPlayerColor('AAA111', 'char-unknown')
    ).toBeUndefined();
  });
});

describe('dmStore — setDmDashboardUi', () => {
  beforeEach(() => {
    useDmStore.setState({ dmId: 'dm-test-fixed', campaigns: [] });
  });

  it('merges playersSectionOpen into the campaign dmDashboardUi', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore
      .getState()
      .setDmDashboardUi('AAA111', { playersSectionOpen: false });

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.dmDashboardUi?.playersSectionOpen).toBe(false);
  });

  it('merges npcSectionOpen without overwriting other fields', () => {
    const campaign = createMockCampaignInfo({
      code: 'AAA111',
      dmDashboardUi: { playersSectionOpen: true },
    });
    useDmStore.getState().addCampaign(campaign);

    useDmStore.getState().setDmDashboardUi('AAA111', { npcSectionOpen: false });

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.dmDashboardUi?.playersSectionOpen).toBe(true);
    expect(found?.dmDashboardUi?.npcSectionOpen).toBe(false);
  });

  it('sets npcCollapsedGroupNames', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore
      .getState()
      .setDmDashboardUi('AAA111', {
        npcCollapsedGroupNames: ['Bandits', 'Guards'],
      });

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.dmDashboardUi?.npcCollapsedGroupNames).toEqual([
      'Bandits',
      'Guards',
    ]);
  });

  it('is a no-op for unknown campaign code', () => {
    const campaign = createMockCampaignInfo({ code: 'AAA111' });
    useDmStore.getState().addCampaign(campaign);

    useDmStore
      .getState()
      .setDmDashboardUi('XXXXXX', { playersSectionOpen: false });

    const found = useDmStore.getState().getCampaign('AAA111');
    expect(found?.dmDashboardUi).toBeUndefined();
  });
});
