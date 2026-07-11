import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { TokenPlacementController } from '@/components/ui/campaign/dm-vtt/TokenPlacementController';

import type { MutableRefObject } from 'react';
import type { PendingTokenPlacement } from '@/components/ui/campaign/dm-vtt/TokenPlacementController';
import type { DmTokenConfig } from '@/components/ui/campaign/dm-vtt/combatantToken';

// Faithful stand-in for @fieldnotes/react's useActiveTool: an external store
// read via useSyncExternalStore, so a setTool() inside an effect only becomes
// visible to components on the NEXT render — the exact timing that caused the
// arm→instant-cancel race in production.
const toolStore = {
  current: 'select',
  listeners: new Set<() => void>(),
  set(name: string) {
    toolStore.current = name;
    toolStore.listeners.forEach(l => l());
  },
  reset() {
    toolStore.current = 'select';
    toolStore.listeners.clear();
  },
};

vi.mock('@fieldnotes/react', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useActiveTool: () => {
      const tool = useSyncExternalStore(
        (cb: () => void) => {
          toolStore.listeners.add(cb);
          return () => toolStore.listeners.delete(cb);
        },
        () => toolStore.current
      );
      return [tool, toolStore.set] as const;
    },
  };
});

function makePending(onPlaced: () => void = () => {}): PendingTokenPlacement {
  return {
    entityName: 'Goblin',
    config: { entityId: 'e1', name: 'Goblin', color: '#C0392B', onPlaced },
  };
}

function setup(pending: PendingTokenPlacement | null) {
  const onCancel = vi.fn();
  const configRef: MutableRefObject<DmTokenConfig | null> = {
    current: null,
  };
  const view = render(
    <TokenPlacementController
      pending={pending}
      configRef={configRef}
      onCancel={onCancel}
    />
  );
  const rerenderWith = (p: PendingTokenPlacement | null) =>
    view.rerender(
      <TokenPlacementController
        pending={p}
        configRef={configRef}
        onCancel={onCancel}
      />
    );
  return { onCancel, configRef, rerenderWith };
}

describe('TokenPlacementController', () => {
  beforeEach(() => {
    toolStore.reset();
  });

  it('arming does NOT fire onCancel while the tool switch is still propagating (the race)', () => {
    const { onCancel, configRef } = setup(makePending());
    // Arm effect ran: config loaded, tool switch requested. The steal
    // detector must not misread the not-yet-propagated tool as a steal.
    expect(configRef.current).not.toBeNull();
    expect(toolStore.current).toBe('dmtoken');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('a real steal (user picks another tool after arming took effect) cancels once', () => {
    const { onCancel } = setup(makePending());
    // let the dmtoken activation render land
    act(() => {});
    expect(onCancel).not.toHaveBeenCalled();

    act(() => toolStore.set('pencil'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('successful placement (tool→select + pending cleared together) does not cancel and does not stomp the tool', () => {
    const { onCancel, rerenderWith } = setup(makePending());
    act(() => {});
    // The tool's onPointerUp switches to select and onPlaced clears pending
    // synchronously; both land in one commit.
    act(() => {
      toolStore.set('select');
      rerenderWith(null);
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(toolStore.current).toBe('select');
  });

  it('cancel (pending cleared while tool still armed) returns the tool to select', () => {
    const { configRef, rerenderWith } = setup(makePending());
    act(() => {});
    expect(toolStore.current).toBe('dmtoken');
    act(() => rerenderWith(null));
    expect(toolStore.current).toBe('select');
    expect(configRef.current).toBeNull();
  });

  it('steal-cancel leaves the user’s chosen tool alone after pending clears', () => {
    const { onCancel, rerenderWith } = setup(makePending());
    act(() => {});
    act(() => toolStore.set('pencil'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    // parent reacts to onCancel by clearing pending
    act(() => rerenderWith(null));
    expect(toolStore.current).toBe('pencil');
  });

  it('Escape cancels while pending', () => {
    const { onCancel } = setup(makePending());
    act(() => {});
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape defers to an open dialog (closes it first, does not cancel)', () => {
    const { onCancel } = setup(makePending());
    act(() => {});
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).not.toHaveBeenCalled();
    dialog.remove();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
