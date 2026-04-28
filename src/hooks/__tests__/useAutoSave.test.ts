import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

/**
 * Inject mock action functions into the store so the hook's closures pick them
 * up directly (Zustand stores actions as part of state).
 *
 * The mock `saveCharacter` also sets `hasUnsavedChanges: false` so the effect
 * does not re-fire indefinitely after a successful save.
 */
function setupStore(overrides: Record<string, unknown> = {}) {
  const mockSetSaveStatus = vi.fn();
  const mockMarkSaved = vi.fn();
  // saveCharacter must mirror the real side-effect of clearing unsaved state;
  // otherwise hasUnsavedChanges stays true and the effect keeps re-triggering.
  const mockSaveCharacter = vi.fn(() => {
    useCharacterStore.setState({
      hasUnsavedChanges: false,
      saveStatus: 'saved',
    });
  });

  useCharacterStore.setState({
    character: makeCharacter(),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
    // Replace store actions with mocks so hooks pick them up via subscription
    saveCharacter: mockSaveCharacter,
    setSaveStatus: mockSetSaveStatus,
    markSaved: mockMarkSaved,
    ...overrides,
  });

  return { mockSaveCharacter, mockSetSaveStatus, mockMarkSaved };
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Always start each test with a clean store state so nothing leaks
    setupStore();
  });

  afterEach(() => {
    // Unmount all hooks so their event listeners are removed before the next test
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not auto-save on initial mount', () => {
    const { mockSaveCharacter } = setupStore();

    renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockSaveCharacter).not.toHaveBeenCalled();
  });

  it('triggers debounced save (sets saving status) when hasUnsavedChanges becomes true', () => {
    const { mockSetSaveStatus } = setupStore();

    renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
    });

    // setSaveStatus('saving') called immediately when debouncedSave is invoked
    expect(mockSetSaveStatus).toHaveBeenCalledWith('saving');
  });

  it('calls saveCharacter() after the debounce delay', () => {
    const { mockSaveCharacter } = setupStore();

    renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
    });

    // Not yet — timer has not elapsed
    expect(mockSaveCharacter).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockSaveCharacter).toHaveBeenCalledTimes(1);
  });

  it('calls setSaveStatus("saved") and markSaved() after the delay elapses', () => {
    const { mockSetSaveStatus, mockMarkSaved } = setupStore();

    renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockSetSaveStatus).toHaveBeenCalledWith('saved');
    expect(mockMarkSaved).toHaveBeenCalledTimes(1);
  });

  it('manualSave() saves immediately without waiting for debounce', () => {
    const { mockSaveCharacter } = setupStore({ hasUnsavedChanges: true });

    const { result } = renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      result.current.manualSave();
    });

    // No timer advance required — save happens synchronously
    expect(mockSaveCharacter).toHaveBeenCalledTimes(1);
  });

  it('manualSave() sets saveStatus to saving then saved', () => {
    const { mockSetSaveStatus } = setupStore({ hasUnsavedChanges: true });

    const { result } = renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      result.current.manualSave();
    });

    expect(mockSetSaveStatus).toHaveBeenCalledWith('saving');
    expect(mockSetSaveStatus).toHaveBeenCalledWith('saved');
  });

  it('does not save when enabled: false', () => {
    const { mockSaveCharacter } = setupStore();

    renderHook(() => useAutoSave({ enabled: false, delay: 500 }));

    act(() => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockSaveCharacter).not.toHaveBeenCalled();
  });

  it('does not save when there are no unsaved changes', () => {
    const { mockSaveCharacter } = setupStore({ hasUnsavedChanges: false });

    renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockSaveCharacter).not.toHaveBeenCalled();
  });

  it('manualSave() does not save when there are no unsaved changes', () => {
    const { mockSaveCharacter } = setupStore({ hasUnsavedChanges: false });

    const { result } = renderHook(() => useAutoSave({ delay: 500 }));

    act(() => {
      result.current.manualSave();
    });

    expect(mockSaveCharacter).not.toHaveBeenCalled();
  });

  it('returns saveStatus, hasUnsavedChanges, manualSave, and isAutoSaveEnabled', () => {
    setupStore({ hasUnsavedChanges: false, saveStatus: 'saved' });

    const { result } = renderHook(() => useAutoSave({ enabled: true }));

    expect(result.current).toHaveProperty('saveStatus', 'saved');
    expect(result.current).toHaveProperty('hasUnsavedChanges', false);
    expect(typeof result.current.manualSave).toBe('function');
    expect(result.current).toHaveProperty('isAutoSaveEnabled', true);
  });

  it('isAutoSaveEnabled reflects the enabled option', () => {
    setupStore();

    const { result } = renderHook(() => useAutoSave({ enabled: false }));

    expect(result.current.isAutoSaveEnabled).toBe(false);
  });

  it('reflects updated hasUnsavedChanges in return value', () => {
    setupStore({ hasUnsavedChanges: false });

    const { result } = renderHook(() => useAutoSave());

    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => {
      useCharacterStore.setState({ hasUnsavedChanges: true });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});
