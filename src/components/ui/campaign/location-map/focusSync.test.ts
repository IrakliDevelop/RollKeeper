import { describe, it, expect, vi } from 'vitest';
import { Camera, toFocusPresence } from '@fieldnotes/core';
import { attachFocusBroadcast, attachFocusReceiver } from './focusSync';

function makeConnection() {
  const handlers: Array<(from: string, data: unknown) => void> = [];
  return {
    sendPresence: vi.fn(),
    onPresence: vi.fn((h: (from: string, data: unknown) => void) => {
      handlers.push(h);
      return () => {};
    }),
    emit: (from: string, data: unknown) => handlers.forEach(h => h(from, data)),
  };
}

/**
 * The minimum a `CameraAnimator` and `RemoteFocusReceiver` (via its private
 * `RemotePingOverlay`) need: a real `Camera`, a real DOM element chain (so
 * `domLayer.parentElement` resolves), `getCanvasSize`, `registerOverlay`,
 * `requestRender`. No `@fieldnotes/core` mocking — the real SDK runs against
 * this stub, matching `selectionEvents.integration.test.tsx`'s approach.
 */
function makeStubViewport() {
  const wrapper = document.createElement('div');
  const domLayer = document.createElement('div');
  wrapper.appendChild(domLayer);
  return {
    camera: new Camera(),
    domLayer,
    getCanvasSize: () => ({ w: 800, h: 600 }),
    getVisibleRect: () => ({ x: 0, y: 0, w: 800, h: 600 }),
    registerOverlay: () => () => {},
    requestRender: () => {},
  };
}

describe('attachFocusBroadcast', () => {
  it('sends one focus presence frame per send call', () => {
    const connection = makeConnection();
    const handle = attachFocusBroadcast(connection);
    handle.send({ x: 0, y: 0, w: 400, h: 300 }, 'players');
    expect(connection.sendPresence).toHaveBeenCalledTimes(1);
    expect(connection.sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'focus', audience: 'players', w: 400 })
    );
  });

  it('sends nothing after dispose', () => {
    const connection = makeConnection();
    const handle = attachFocusBroadcast(connection);
    handle.dispose();
    handle.send({ x: 0, y: 0, w: 400, h: 300 }, 'all');
    expect(connection.sendPresence).not.toHaveBeenCalled();
  });
});

describe('attachFocusReceiver', () => {
  it('applies frames addressed to its role and ignores others', () => {
    const connection = makeConnection();
    const vp = makeStubViewport();
    const { receiver, dispose } = attachFocusReceiver(vp, connection, {
      role: 'player',
    });
    const spy = vi.spyOn(receiver, 'apply');

    connection.emit(
      'dm-1',
      toFocusPresence({ x: 0, y: 0, w: 400, h: 300 }, 'display')
    );
    expect(spy).toHaveReturnedWith(false);

    connection.emit(
      'dm-1',
      toFocusPresence({ x: 0, y: 0, w: 400, h: 300 }, 'players')
    );
    expect(spy).toHaveReturnedWith(true);
    dispose();
  });

  it('dispose unsubscribes from presence', () => {
    // makeConnection()'s onPresence returns a no-op unsubscribe (matching the
    // brief verbatim), so it cannot observe real unsubscription. This stub's
    // onPresence actually removes its handler, so it can.
    const handlers = new Set<(from: string, data: unknown) => void>();
    const connection = {
      sendPresence: vi.fn(),
      onPresence: (h: (from: string, data: unknown) => void) => {
        handlers.add(h);
        return () => handlers.delete(h);
      },
      emit: (from: string, data: unknown) => {
        for (const h of [...handlers]) h(from, data);
      },
    };
    const vp = makeStubViewport();
    const { receiver, dispose } = attachFocusReceiver(vp, connection, {
      role: 'player',
    });
    const spy = vi.spyOn(receiver, 'apply');
    dispose();

    connection.emit(
      'dm-1',
      toFocusPresence({ x: 0, y: 0, w: 400, h: 300 }, 'players')
    );
    expect(spy).not.toHaveBeenCalled();
    expect(handlers.size).toBe(0);
  });

  it('leaves other presence handlers undisturbed', () => {
    const connection = makeConnection();
    const vp = makeStubViewport();
    const { receiver, dispose } = attachFocusReceiver(vp, connection, {
      role: 'player',
    });
    for (const foreign of [
      { kind: 'poke', feature: 'initiative' },
      { kind: 'laser', points: [] },
      { kind: 'ping', x: 1, y: 2 },
    ]) {
      expect(receiver.apply('peer', foreign)).toBe(false);
    }
    dispose();
  });
});
