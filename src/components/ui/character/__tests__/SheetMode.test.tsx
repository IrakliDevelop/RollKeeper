import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SheetModeProvider,
  useSheetMode,
  useSheetModeState,
} from '../SheetMode';

afterEach(cleanup);

describe('useSheetModeState', () => {
  it('starts in play mode', () => {
    const { result } = renderHook(() => useSheetModeState('c1'));
    expect(result.current.editing).toBe(false);
  });

  it('switches to edit mode and back', () => {
    const { result } = renderHook(() => useSheetModeState('c1'));
    act(() => result.current.setEditing(true));
    expect(result.current.editing).toBe(true);
    act(() => result.current.setEditing(false));
    expect(result.current.editing).toBe(false);
  });

  it('keeps the mode while the character stays the same', () => {
    const { result, rerender } = renderHook(({ id }) => useSheetModeState(id), {
      initialProps: { id: 'c1' },
    });
    act(() => result.current.setEditing(true));
    rerender({ id: 'c1' });
    expect(result.current.editing).toBe(true);
  });

  it('goes back to play mode when the character changes', () => {
    const { result, rerender } = renderHook(({ id }) => useSheetModeState(id), {
      initialProps: { id: 'c1' },
    });
    act(() => result.current.setEditing(true));
    rerender({ id: 'c2' });
    expect(result.current.editing).toBe(false);
  });

  it('keeps setEditing stable for one character', () => {
    const { result, rerender } = renderHook(({ id }) => useSheetModeState(id), {
      initialProps: { id: 'c1' },
    });
    const first = result.current.setEditing;
    rerender({ id: 'c1' });
    expect(result.current.setEditing).toBe(first);
  });

  it('never writes to storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useSheetModeState('c1'));
    act(() => result.current.setEditing(true));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe('useSheetMode', () => {
  it('reads the mode from the provider', () => {
    function Probe() {
      return <span>{useSheetMode().editing ? 'edit' : 'play'}</span>;
    }
    const { getByText } = render(
      <SheetModeProvider value={{ editing: true, setEditing: () => {} }}>
        <Probe />
      </SheetModeProvider>
    );
    expect(getByText('edit')).toBeInTheDocument();
  });

  it('throws outside a provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSheetMode())).toThrow(/SheetModeProvider/);
    error.mockRestore();
  });
});
