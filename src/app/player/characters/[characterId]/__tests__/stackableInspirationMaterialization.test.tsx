import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { campaignStackableToMaterialize } from '@/utils/inspiration';
import { makeCharacter } from '@/utils/__tests__/test-utils';

/**
 * The character page is far too hook-heavy to render in jsdom, so this mirrors
 * the materialization effect it wires up (resolver + guarded store write) to
 * pin down the behaviour that page depends on.
 */
function useMaterializeCampaignStackable(args: {
  inCampaign: boolean;
  sharedStateLoaded: boolean;
  campaignStackable: boolean | undefined;
}) {
  const character = useCharacterStore(state => state.character);
  const setStackableInspiration = useCharacterStore(
    state => state.setStackableInspiration
  );

  const stackableToMaterialize = campaignStackableToMaterialize(
    args.inCampaign,
    args.sharedStateLoaded,
    args.campaignStackable
  );

  useEffect(() => {
    if (stackableToMaterialize === null) return;
    if (character.stackableInspiration !== stackableToMaterialize) {
      setStackableInspiration(stackableToMaterialize);
    }
  }, [
    stackableToMaterialize,
    character.stackableInspiration,
    setStackableInspiration,
  ]);
}

function seedCharacter(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
  });
}

function readCharacter() {
  return useCharacterStore.getState().character;
}

describe('materializing the campaign stackable-inspiration setting', () => {
  beforeEach(() => {
    seedCharacter({
      stackableInspiration: true,
      heroicInspiration: { count: 3 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('writes the campaign setting onto the character and clamps the stack', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: false,
      })
    );

    expect(readCharacter().stackableInspiration).toBe(false);
    expect(readCharacter().heroicInspiration.count).toBe(1);
  });

  it('treats a campaign with no setting as stacking off', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: undefined,
      })
    );

    expect(readCharacter().stackableInspiration).toBe(false);
  });

  it('leaves the character untouched until shared state has loaded', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: false,
        campaignStackable: false,
      })
    );

    expect(readCharacter().stackableInspiration).toBe(true);
    expect(readCharacter().heroicInspiration.count).toBe(3);
  });

  it('leaves a solo character on its own preference', () => {
    renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: false,
        sharedStateLoaded: true,
        campaignStackable: false,
      })
    );

    expect(readCharacter().stackableInspiration).toBe(true);
    expect(readCharacter().heroicInspiration.count).toBe(3);
  });

  it('does not write when the character already matches the campaign', () => {
    seedCharacter({
      stackableInspiration: false,
      heroicInspiration: { count: 1 },
    });
    const { rerender } = renderHook(() =>
      useMaterializeCampaignStackable({
        inCampaign: true,
        sharedStateLoaded: true,
        campaignStackable: false,
      })
    );
    rerender();

    // The store flips this on every write, so an untouched flag proves the
    // guard skipped the redundant `setStackableInspiration` call.
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(false);
  });
});
