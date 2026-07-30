import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useMaterializeCampaignStackable } from '@/hooks/useMaterializeCampaignStackable';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useMaterializeCampaignStackable', () => {
  let setStackableInspiration: Mock<(value: boolean) => void>;

  beforeEach(() => {
    setStackableInspiration = vi.fn<(value: boolean) => void>();
  });

  it('writes the campaign setting when it differs from the character', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: false,
        currentStackable: true,
        setStackableInspiration,
      })
    );

    expect(setStackableInspiration).toHaveBeenCalledTimes(1);
    expect(setStackableInspiration).toHaveBeenCalledWith(false);
  });

  it('treats a campaign with no setting as stacking off', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: undefined,
        currentStackable: true,
        setStackableInspiration,
      })
    );

    expect(setStackableInspiration).toHaveBeenCalledWith(false);
  });

  it('does not write for a solo character', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: false,
        sharedStateLoaded: true,
        campaignStackable: false,
        currentStackable: true,
        setStackableInspiration,
      })
    );

    expect(setStackableInspiration).not.toHaveBeenCalled();
  });

  it('does not write until the shared state has loaded', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: false,
        campaignStackable: false,
        currentStackable: true,
        setStackableInspiration,
      })
    );

    expect(setStackableInspiration).not.toHaveBeenCalled();
  });

  it('does not write when the character already matches the campaign', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: false,
        currentStackable: false,
        setStackableInspiration,
      })
    );

    expect(setStackableInspiration).not.toHaveBeenCalled();
  });

  it('stays silent across re-renders when the value already matches', () => {
    const params = {
      inCampaign: true,
      sharedStateLoaded: true,
      campaignStackable: false,
      currentStackable: false,
      setStackableInspiration,
    };
    const { rerender } = renderHook(() =>
      useMaterializeCampaignStackable(params)
    );
    rerender();
    rerender();

    expect(setStackableInspiration).toHaveBeenCalledTimes(0);
  });

  it('writes only once across re-renders with identical props', () => {
    const params = {
      inCampaign: true,
      sharedStateLoaded: true,
      campaignStackable: false,
      currentStackable: true,
      setStackableInspiration,
    };
    const { rerender } = renderHook(() =>
      useMaterializeCampaignStackable(params)
    );
    rerender();
    rerender();

    expect(setStackableInspiration).toHaveBeenCalledTimes(1);
  });

  it('clamps an existing stack when wired to the real store action', () => {
    useCharacterStore.setState({
      character: makeCharacter({
        stackableInspiration: true,
        heroicInspiration: { count: 3 },
      }),
      hasUnsavedChanges: false,
      saveStatus: 'saved',
    });

    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: false,
        currentStackable: true,
        setStackableInspiration:
          useCharacterStore.getState().setStackableInspiration,
      })
    );

    const character = useCharacterStore.getState().character;
    expect(character.stackableInspiration).toBe(false);
    expect(character.heroicInspiration.count).toBe(1);
  });
});
