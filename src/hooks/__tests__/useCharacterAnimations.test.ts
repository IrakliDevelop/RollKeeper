import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useCharacterAnimations } from '@/hooks/useCharacterAnimations';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function setupStores({
  enableDeathAnimation = true,
  enableLevelUpAnimation = true,
  characterOverrides = {},
}: {
  enableDeathAnimation?: boolean;
  enableLevelUpAnimation?: boolean;
  characterOverrides?: Record<string, unknown>;
} = {}) {
  const mockTriggerDeathAnimation = vi.fn();
  const mockTriggerLevelUpAnimation = vi.fn();

  useCharacterStore.setState({
    character: makeCharacter(characterOverrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
    triggerDeathAnimation: mockTriggerDeathAnimation,
    triggerLevelUpAnimation: mockTriggerLevelUpAnimation,
  });

  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: {
      enableDeathAnimation,
      enableLevelUpAnimation,
      enableCombatStartBanner: false,
    },
    lastSelectedCharacterId: null,
  });

  return { mockTriggerDeathAnimation, mockTriggerLevelUpAnimation };
}

describe('useCharacterAnimations', () => {
  beforeEach(() => {
    setupStores();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not fire any animation on initial mount', () => {
    const { mockTriggerDeathAnimation, mockTriggerLevelUpAnimation } =
      setupStores();

    renderHook(() => useCharacterAnimations());

    expect(mockTriggerDeathAnimation).not.toHaveBeenCalled();
    expect(mockTriggerLevelUpAnimation).not.toHaveBeenCalled();
  });

  it('triggers the death animation when hit points transition into dead', () => {
    const { mockTriggerDeathAnimation } = setupStores({
      characterOverrides: {
        hitPoints: {
          current: 0,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
          deathSaves: { successes: 0, failures: 0, isStabilized: false },
        },
      },
    });

    renderHook(() => useCharacterAnimations());
    expect(mockTriggerDeathAnimation).not.toHaveBeenCalled();

    act(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          hitPoints: {
            ...state.character.hitPoints,
            deathSaves: { successes: 0, failures: 3, isStabilized: false },
          },
        },
      }));
    });

    expect(mockTriggerDeathAnimation).toHaveBeenCalledTimes(1);
  });

  it('does not trigger the death animation when the setting is disabled', () => {
    const { mockTriggerDeathAnimation } = setupStores({
      enableDeathAnimation: false,
      characterOverrides: {
        hitPoints: {
          current: 0,
          max: 44,
          temporary: 0,
          calculationMode: 'auto' as const,
          deathSaves: { successes: 0, failures: 0, isStabilized: false },
        },
      },
    });

    renderHook(() => useCharacterAnimations());

    act(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          hitPoints: {
            ...state.character.hitPoints,
            deathSaves: { successes: 0, failures: 3, isStabilized: false },
          },
        },
      }));
    });

    expect(mockTriggerDeathAnimation).not.toHaveBeenCalled();
  });

  it('triggers the level-up animation when total level increases', () => {
    const { mockTriggerLevelUpAnimation } = setupStores({
      characterOverrides: { level: 5, totalLevel: 5 },
    });

    renderHook(() => useCharacterAnimations());
    expect(mockTriggerLevelUpAnimation).not.toHaveBeenCalled();

    act(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          level: 6,
          totalLevel: 6,
        },
      }));
    });

    expect(mockTriggerLevelUpAnimation).toHaveBeenCalledTimes(1);
    expect(mockTriggerLevelUpAnimation).toHaveBeenCalledWith(6);
  });

  it('does not trigger the level-up animation when the setting is disabled', () => {
    const { mockTriggerLevelUpAnimation } = setupStores({
      enableLevelUpAnimation: false,
      characterOverrides: { level: 5, totalLevel: 5 },
    });

    renderHook(() => useCharacterAnimations());

    act(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          level: 6,
          totalLevel: 6,
        },
      }));
    });

    expect(mockTriggerLevelUpAnimation).not.toHaveBeenCalled();
  });

  it('does not trigger the level-up animation when level decreases', () => {
    const { mockTriggerLevelUpAnimation } = setupStores({
      characterOverrides: { level: 6, totalLevel: 6 },
    });

    renderHook(() => useCharacterAnimations());

    act(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          level: 5,
          totalLevel: 5,
        },
      }));
    });

    expect(mockTriggerLevelUpAnimation).not.toHaveBeenCalled();
  });

  it('resets baselines without firing when switching to a different character', () => {
    const { mockTriggerDeathAnimation, mockTriggerLevelUpAnimation } =
      setupStores({
        characterOverrides: {
          id: 'char-a',
          level: 5,
          totalLevel: 5,
          hitPoints: {
            current: 0,
            max: 44,
            temporary: 0,
            calculationMode: 'auto' as const,
            deathSaves: { successes: 0, failures: 0, isStabilized: false },
          },
        },
      });

    renderHook(() => useCharacterAnimations());

    // Switching to a brand-new (already-dead, higher-level) character must
    // not retroactively fire animations for the previous character's deltas.
    act(() => {
      useCharacterStore.setState(state => ({
        character: {
          ...state.character,
          id: 'char-b',
          level: 10,
          totalLevel: 10,
          hitPoints: {
            ...state.character.hitPoints,
            deathSaves: { successes: 0, failures: 3, isStabilized: false },
          },
        },
      }));
    });

    expect(mockTriggerDeathAnimation).not.toHaveBeenCalled();
    expect(mockTriggerLevelUpAnimation).not.toHaveBeenCalled();
  });
});
