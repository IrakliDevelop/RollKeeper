import type React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDragAndDrop } from '../useDragAndDrop';

function stubEvent(el = document.createElement('li')) {
  const event = {
    preventDefault: vi.fn(),
    dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: '' },
    currentTarget: el,
  };
  return { event: event as unknown as React.DragEvent, raw: event, el };
}

describe('useDragAndDrop', () => {
  it('calls onReorder with the source and drop rows', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onReorder }));

    act(() => result.current.handleDragStart(stubEvent().event, 0));
    act(() => result.current.handleDragOver(stubEvent().event, 2));
    act(() => result.current.handleDrop(stubEvent().event, 2));

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
    expect(result.current.draggedIndex).toBeNull();
    expect(result.current.dragOverIndex).toBeNull();
  });

  it('ignores a drop on the dragged row', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ onReorder }));

    act(() => result.current.handleDragStart(stubEvent().event, 1));
    act(() => result.current.handleDrop(stubEvent().event, 1));

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({ onReorder, disabled: true })
    );
    const over = stubEvent();

    act(() => result.current.handleDragStart(stubEvent().event, 0));
    act(() => result.current.handleDragOver(over.event, 2));
    act(() => result.current.handleDrop(stubEvent().event, 2));

    expect(result.current.draggedIndex).toBeNull();
    expect(over.raw.preventDefault).not.toHaveBeenCalled();
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('marks only the row under the pointer', () => {
    const { result } = renderHook(() => useDragAndDrop({ onReorder: vi.fn() }));

    act(() => result.current.handleDragOver(stubEvent().event, 1));
    expect(result.current.getDragOverStyles(1)).not.toBe('');
    expect(result.current.getDragOverStyles(0)).toBe('');

    act(() => result.current.handleDragLeave());
    expect(result.current.getDragOverStyles(1)).toBe('');
  });

  it("leaves the row's inline style alone", () => {
    const { result } = renderHook(() => useDragAndDrop({ onReorder: vi.fn() }));
    const { event, el } = stubEvent();

    act(() => result.current.handleDragStart(event, 0));
    expect(el.style.opacity).toBe('');
    expect(result.current.getDraggedStyles(0)).not.toBe('');

    act(() => result.current.handleDragEnd(event));
    expect(el.style.opacity).toBe('');
  });
});
