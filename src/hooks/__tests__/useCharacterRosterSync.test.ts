import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCharacterRosterSync } from '../useCharacterRosterSync';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

type Props = Parameters<typeof useCharacterRosterSync>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  const rosterData = makeCharacter({ id: 'char-1' });
  return {
    playerCharacter: { characterData: rosterData },
    hasHydrated: true,
    characterId: 'char-1',
    character: makeCharacter({ id: 'unloaded' }),
    loadCharacterState: vi.fn(),
    updateCharacterData: vi.fn(),
    ...overrides,
  };
}

describe('useCharacterRosterSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the roster character into the store exactly once per characterId', () => {
    const rosterData = makeCharacter({ id: 'char-1' });
    const loadCharacterState = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      loadCharacterState,
    });

    const { rerender } = renderHook(p => useCharacterRosterSync(p), {
      initialProps: props,
    });

    expect(loadCharacterState).toHaveBeenCalledTimes(1);
    expect(loadCharacterState).toHaveBeenCalledWith(rosterData);

    // Re-render with the same characterId — must not reload.
    rerender({ ...props, character: rosterData });
    expect(loadCharacterState).toHaveBeenCalledTimes(1);
  });

  it('does not write back to the roster during the initial-load guard window', () => {
    const rosterData = makeCharacter({
      id: 'char-1',
      hitPoints: { ...makeCharacter().hitPoints, current: 44 },
    });
    const updateCharacterData = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      character: rosterData,
      updateCharacterData,
    });

    const { rerender } = renderHook(p => useCharacterRosterSync(p), {
      initialProps: props,
    });

    // Character changes immediately after load, before the 50ms guard clears.
    const damaged: CharacterState = {
      ...rosterData,
      hitPoints: { ...rosterData.hitPoints, current: 30 },
    };
    rerender({ ...props, character: damaged });

    expect(updateCharacterData).not.toHaveBeenCalled();
  });

  it('writes live character changes back to the roster once past the guard window', () => {
    const rosterData = makeCharacter({ id: 'char-1' });
    const updateCharacterData = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      character: rosterData,
      updateCharacterData,
    });

    const { rerender } = renderHook(p => useCharacterRosterSync(p), {
      initialProps: props,
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const damaged: CharacterState = {
      ...rosterData,
      hitPoints: { ...rosterData.hitPoints, current: 30 },
    };
    rerender({ ...props, character: damaged });

    expect(updateCharacterData).toHaveBeenCalledTimes(1);
    expect(updateCharacterData).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({
        hitPoints: expect.objectContaining({ current: 30 }),
      })
    );
  });

  it('skips redundant writes when the character has not actually changed', () => {
    const rosterData = makeCharacter({ id: 'char-1' });
    const updateCharacterData = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      character: rosterData,
      updateCharacterData,
    });

    const { rerender } = renderHook(p => useCharacterRosterSync(p), {
      initialProps: props,
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    // Same character reference/content re-rendered — no real change.
    rerender({ ...props, character: { ...rosterData } });

    expect(updateCharacterData).not.toHaveBeenCalled();
  });

  it('fires onLoad synchronously with the freshly loaded character data', () => {
    const rosterData = makeCharacter({ id: 'char-1' });
    const onLoad = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      onLoad,
    });

    renderHook(p => useCharacterRosterSync(p), { initialProps: props });

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(rosterData);
  });

  it('does not load a stale roster blob over fresher store state', () => {
    const rosterData = makeCharacter({ id: 'char-1', revision: 5 });
    const liveCharacter = makeCharacter({ id: 'char-1', revision: 10 });
    const loadCharacterState = vi.fn();
    const onLoad = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      character: liveCharacter,
      loadCharacterState,
      onLoad,
    });

    renderHook(p => useCharacterRosterSync(p), { initialProps: props });

    expect(loadCharacterState).not.toHaveBeenCalled();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('still loads a newer roster blob', () => {
    const rosterData = makeCharacter({ id: 'char-1', revision: 12 });
    const liveCharacter = makeCharacter({ id: 'char-1', revision: 10 });
    const loadCharacterState = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      character: liveCharacter,
      loadCharacterState,
    });

    renderHook(p => useCharacterRosterSync(p), { initialProps: props });

    expect(loadCharacterState).toHaveBeenCalledTimes(1);
    expect(loadCharacterState).toHaveBeenCalledWith(rosterData);
  });

  it('still writes fresher store state back to the roster when a stale load is skipped', () => {
    const rosterData = makeCharacter({ id: 'char-1', revision: 5 });
    const liveCharacter = makeCharacter({ id: 'char-1', revision: 10 });
    const updateCharacterData = vi.fn();
    const props = makeProps({
      playerCharacter: { characterData: rosterData },
      character: liveCharacter,
      updateCharacterData,
    });

    const { rerender } = renderHook(p => useCharacterRosterSync(p), {
      initialProps: props,
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const updatedLive = { ...liveCharacter, revision: 11 };
    rerender({ ...props, character: updatedLive });

    expect(updateCharacterData).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ revision: 11 })
    );
  });
});
