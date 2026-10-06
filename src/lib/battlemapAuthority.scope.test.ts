import { ElementStore, createShape } from '@fieldnotes/core';
import { FogManager } from '@fieldnotes/vtt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeInstance {
  options: {
    scopeId: string;
    resolveUrl: () => Promise<unknown> | unknown;
  };
  state: {
    status: string;
    document: unknown;
    operations: Array<{ clientOperationId: string; status: string }>;
  };
  listeners: Set<() => void>;
  submit: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  publish(): void;
}

const fake = vi.hoisted(() => ({ instances: [] as FakeInstance[] }));

vi.mock('@fieldnotes/sync', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/sync')>()),
  createManagedAuthorityConnection: (options: FakeInstance['options']) => {
    const instance: FakeInstance = {
      options,
      state: { status: 'connecting', document: null, operations: [] },
      listeners: new Set(),
      submit: vi.fn(() => ({ status: 'admitted', clientOperationId: 'x' })),
      stop: vi.fn(),
      publish() {
        for (const listener of [...this.listeners]) listener();
      },
    };
    fake.instances.push(instance);
    return {
      getState: () => instance.state,
      subscribe: (listener: () => void) => {
        instance.listeners.add(listener);
        return () => instance.listeners.delete(listener);
      },
      stop: instance.stop,
      submit: instance.submit,
      captureBarrier: vi.fn(),
      waitForAcknowledgements: vi.fn(),
      requestCheckpoint: vi.fn(),
      releaseBarrier: vi.fn(),
    };
  },
}));

import { createManagedBattleMapAuthorityConnection } from './battlemapAuthority';

const ROOM_X = '423e4567-e89b-42d3-a456-426614174000';
const ROOM_M = '523e4567-e89b-42d3-a456-426614174000';
const emptyDocument = (elements: unknown[] = []) => ({
  elements,
  layers: [],
  extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
});

function start(
  mint: ReturnType<typeof vi.fn>,
  role: 'player' | 'display' | 'dm' = 'player'
) {
  const store = new ElementStore();
  const fog = new FogManager();
  const onSceneResolved = vi.fn();
  const onSceneChange = vi.fn();
  const onDiagnostic = vi.fn();
  const tokenRequest =
    role === 'player'
      ? { role, battleMapId: 'map-m', playerId: 'legacy-a' }
      : role === 'display'
        ? { role, battleMapId: 'map-m', displayKey: 'key' }
        : { role, battleMapId: 'map-m', dmId: 'dm-a', sceneId: 'scene-x' };
  const connection = createManagedBattleMapAuthorityConnection({
    relayUrl: 'wss://relay.test',
    campaignCode: 'CODE',
    battleMapId: 'map-m',
    store,
    clientId: role === 'dm' ? 'dm-a' : 'legacy-a',
    tokenRequest: tokenRequest as never,
    fog: { manager: fog },
    mint: mint as never,
    onSceneResolved,
    onSceneChange,
    onDiagnostic,
  });
  return {
    store,
    fog,
    connection,
    onSceneResolved,
    onSceneChange,
    onDiagnostic,
  };
}

describe('resolved-scene connection scope (R4 client)', () => {
  beforeEach(() => {
    fake.instances.length = 0;
  });

  it('binds the scope to the resolved adopted scene without a second mint', async () => {
    const mint = vi.fn(async () => ({
      token: 'token-x',
      authority: 1,
      room: ROOM_X,
      sceneId: 'scene-x',
    }));
    const { onSceneResolved, onSceneChange } = start(mint);
    expect(fake.instances).toHaveLength(1);
    expect(fake.instances[0]!.options.scopeId).toBe('CODE:scene:map-m');
    await expect(fake.instances[0]!.options.resolveUrl()).resolves.toBeNull();
    await Promise.resolve();
    expect(fake.instances[0]!.stop).toHaveBeenCalled();
    expect(fake.instances).toHaveLength(2);
    expect(fake.instances[1]!.options.scopeId).toBe(
      `CODE:scene:scene-x:room:${ROOM_X}`
    );
    await expect(fake.instances[1]!.options.resolveUrl()).resolves.toEqual({
      url: `wss://relay.test?room=${ROOM_X}`,
      protocols: expect.any(Array),
    });
    expect(mint).toHaveBeenCalledTimes(1);
    expect(onSceneResolved).toHaveBeenLastCalledWith('scene-x');
    expect(onSceneChange).not.toHaveBeenCalled();
  });

  it('tears down on an M to X switch, discards pending work visibly and never replays it', async () => {
    let current: { room: string; sceneId: string } = {
      room: ROOM_X,
      sceneId: 'scene-x',
    };
    const mint = vi.fn(async () => ({
      token: 'token',
      authority: 1,
      ...current,
    }));
    const { store, connection, onSceneChange, onSceneResolved } = start(mint);
    await fake.instances[0]!.options.resolveUrl();
    await Promise.resolve();
    const live = fake.instances[1]!;
    await live.options.resolveUrl();
    const token = {
      ...createShape({ position: { x: 1, y: 1 }, size: { w: 5, h: 5 } }),
      id: 'scene-x-token',
    };
    live.state = {
      status: 'live',
      document: emptyDocument([token]),
      operations: [],
    };
    live.publish();
    expect(store.getById('scene-x-token')).toBeDefined();
    store.update('scene-x-token', { position: { x: 9, y: 9 } });
    expect(live.submit).toHaveBeenCalledTimes(1);
    live.state = {
      ...live.state,
      operations: [{ clientOperationId: 'pending-move', status: 'pending' }],
    };
    live.publish();

    current = { room: ROOM_M, sceneId: 'map-m' };
    await expect(live.options.resolveUrl()).resolves.toBeNull();
    await Promise.resolve();
    expect(live.stop).toHaveBeenCalled();
    expect(onSceneChange).toHaveBeenCalledWith({
      previousSceneId: 'scene-x',
      sceneId: 'map-m',
      discardedOperationIds: ['pending-move'],
    });
    expect(onSceneResolved).toHaveBeenLastCalledWith('map-m');
    expect(store.getAll()).toEqual([]);
    const replacement = fake.instances.at(-1)!;
    expect(replacement).not.toBe(live);
    expect(replacement.options.scopeId).toBe(`CODE:scene:map-m:room:${ROOM_M}`);
    expect(replacement.submit).not.toHaveBeenCalled();
    connection.stop();
    expect(replacement.stop).toHaveBeenCalled();
  });

  it('keeps the DM on its explicit scene scope', async () => {
    const mint = vi.fn(async () => ({
      token: 'token',
      authority: 1,
      room: ROOM_X,
      sceneId: 'scene-x',
    }));
    const { onSceneChange } = start(mint, 'dm');
    expect(fake.instances).toHaveLength(1);
    await fake.instances[0]!.options.resolveUrl();
    expect(fake.instances).toHaveLength(1);
    expect(onSceneChange).not.toHaveBeenCalled();
  });
});
