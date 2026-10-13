import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableCanvasCheckpointV1 } from '@/lib/table/schema';

import { useSceneCheckpointActions } from './useSceneCheckpointActions';

const checkpoint: TableCanvasCheckpointV1 = {
  protocolVersion: 1,
  generation: 'saved-gen',
  revision: 1,
  capturedAt: '2026-10-13T00:00:00.000Z',
  state: {
    cursor: { generation: 'saved-gen', revision: 1 },
    elements: [],
    layers: [],
    extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
  },
};

/** A restore whose provision answer is held until `release()`. */
function heldRestoreFetch() {
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/checkpoint'))
      return Response.json({ generation: 'room-gen', casToken: 'cas' });
    await held;
    return Response.json({ status: 'provisioned', generation: 'new-gen' });
  });
  return { fetchMock, release };
}

afterEach(() => vi.unstubAllGlobals());

describe('useSceneCheckpointActions restore (review S4)', () => {
  const render = (sceneId: string) =>
    renderHook(
      (props: { sceneId: string }) =>
        useSceneCheckpointActions({
          repository: null,
          adapter: null,
          connection: null,
          campaignCode: 'CAMP',
          dmId: 'dm-1',
          sceneId: props.sceneId,
        }),
      { initialProps: { sceneId } }
    );

  it('counts a restore and reports it for the scene that is still mounted', async () => {
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = render('scene-a');
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.restore(checkpoint, 'checkpoint');
    });
    release();
    await act(async () => pending);
    expect(result.current.restoredCount).toBe(1);
    expect(result.current.saveMessage).toBe('Checkpoint restored.');
  });

  it('ignores a restore that finishes after another scene was mounted', async () => {
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = render('scene-a');
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.restore(checkpoint, 'checkpoint');
    });
    rerender({ sceneId: 'scene-b' });
    const before = result.current.saveMessage;
    release();
    await act(async () => pending);
    // No remount of scene B's canvas and no message about scene A on it.
    expect(result.current.restoredCount).toBe(0);
    expect(result.current.saveMessage).toBe(before);
    expect(result.current.recoveryBusy).toBe(false);
  });
});
