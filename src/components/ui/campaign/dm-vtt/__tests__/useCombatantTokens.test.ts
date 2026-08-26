import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  combatantTokenIndex,
  useCombatantTokens,
  selectedEntityId,
} from '@/components/ui/campaign/dm-vtt/useCombatantTokens';

import type { CanvasElement, ElementStore } from '@fieldnotes/core';

type Listener = (data: CanvasElement | null) => void;

function fakeStore(initial: CanvasElement[] = []) {
  const elements = new Map(initial.map(el => [el.id, el]));
  const listeners = new Map<string, Set<Listener>>();
  const emit = (event: string, data: CanvasElement | null) =>
    listeners.get(event)?.forEach(l => l(data));
  const store = {
    getAll: () => [...elements.values()],
    getById: (id: string) => elements.get(id),
    on: vi.fn((event: string, listener: Listener) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)!.delete(listener);
    }),
  } as unknown as ElementStore;
  return {
    store,
    addEl(el: CanvasElement) {
      elements.set(el.id, el);
      emit('add', el);
    },
    removeEl(id: string) {
      const el = elements.get(id)!;
      elements.delete(id);
      emit('remove', el);
    },
    listeners,
  };
}

const token = (id: string, entityId: string): CanvasElement =>
  ({
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    entityId,
    tokenKind: 'combatant',
  }) as unknown as CanvasElement;

const plain = (id: string): CanvasElement =>
  ({
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
  }) as unknown as CanvasElement;

describe('combatantTokenIndex', () => {
  it('indexes only combatant tokens, grouped by entityId', () => {
    const { store } = fakeStore([
      token('t1', 'e1'),
      token('t2', 'e1'),
      plain('p1'),
    ]);
    const index = combatantTokenIndex(store);
    expect(index.get('e1')).toEqual(['t1', 't2']);
    expect(index.size).toBe(1);
  });
});

describe('useCombatantTokens', () => {
  it('returns a live index that updates on add and remove', () => {
    const f = fakeStore();
    const { result } = renderHook(() => useCombatantTokens(f.store));
    expect(result.current.size).toBe(0);

    act(() => f.addEl(token('t1', 'e1')));
    expect(result.current.get('e1')).toEqual(['t1']);

    act(() => f.removeEl('t1'));
    expect(result.current.size).toBe(0);
  });

  it('subscribes to add/remove/clear but NOT update (drags stay cheap)', () => {
    const f = fakeStore();
    renderHook(() => useCombatantTokens(f.store));
    const events = (f.store.on as ReturnType<typeof vi.fn>).mock.calls.map(
      c => c[0]
    );
    expect(events).toContain('add');
    expect(events).toContain('remove');
    expect(events).toContain('clear');
    expect(events).not.toContain('update');
  });

  it('null store yields an empty index', () => {
    const { result } = renderHook(() => useCombatantTokens(null));
    expect(result.current.size).toBe(0);
  });
});

describe('selectedEntityId', () => {
  it('maps the first combatant token in the selection to its entity', () => {
    const { store } = fakeStore([token('t1', 'e1'), plain('p1')]);
    expect(selectedEntityId(['p1', 't1'], store)).toBe('e1');
  });
  it('returns null when nothing selected carries an entity', () => {
    const { store } = fakeStore([plain('p1')]);
    expect(selectedEntityId(['p1'], store)).toBeNull();
    expect(selectedEntityId([], store)).toBeNull();
  });
});
