import { ElementStore, LayerManager, createShape } from '@fieldnotes/core';
import { describe, expect, it, vi } from 'vitest';

import { PLAYER_BAND_ORDER } from '@/components/ui/campaign/location-map/layerContract';

import { createTableRosterCanvas } from './tableRosterCanvas';

function fakeViewport() {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  const setSelection = vi.fn();
  const viewport = {
    store,
    layerManager,
    toolContext: { marker: 'ctx' },
    toolManager: {
      setTool: vi.fn(),
      getTool: vi.fn(() => ({ setSelection })),
    },
    requestRender: vi.fn(),
  };
  return { viewport, setSelection };
}

const token = (fields: Record<string, unknown> = {}) => ({
  ...createShape({ position: { x: 0, y: 0 }, size: { w: 10, h: 10 } }),
  id: 'token-a',
  tokenKind: 'combatant',
  entityId: 'member-a',
  sceneMemberId: 'member-a',
  layerId: 'layer-annotations',
  ...fields,
});

describe('createTableRosterCanvas', () => {
  it('patches control fields on a live token and reports missing tokens', () => {
    const { viewport } = fakeViewport();
    viewport.store.add(token());
    const canvas = createTableRosterCanvas({
      viewport: viewport as never,
      connection: null,
      onArm: vi.fn(),
    });
    expect(
      canvas.applyTokenPatch('token-a', {
        set: {
          tokenKind: 'player',
          characterId: 'legacy-a',
          layerId: 'player-legacy-a',
        },
        unset: ['entityId'],
      })
    ).toBe(true);
    const patched = JSON.parse(
      JSON.stringify(viewport.store.getById('token-a'))
    ) as Record<string, unknown>;
    expect(patched).toMatchObject({
      tokenKind: 'player',
      characterId: 'legacy-a',
      layerId: 'player-legacy-a',
      sceneMemberId: 'member-a',
    });
    expect(patched).not.toHaveProperty('entityId');
    expect(
      canvas.applyTokenPatch('missing', { set: { a: 1 }, unset: [] })
    ).toBe(false);
  });

  it('publishes the canonical party band once through the DM layer path', () => {
    const { viewport } = fakeViewport();
    const connection = { publishLayerUpsert: vi.fn() };
    const canvas = createTableRosterCanvas({
      viewport: viewport as never,
      connection: connection as never,
      onArm: vi.fn(),
    });
    canvas.ensurePlayerBand('legacy-a', 'Aria');
    canvas.ensurePlayerBand('legacy-a', 'Aria');
    expect(connection.publishLayerUpsert).toHaveBeenCalledTimes(1);
    expect(connection.publishLayerUpsert).toHaveBeenCalledWith({
      id: 'player-legacy-a',
      name: 'Aria',
      visible: true,
      locked: false,
      order: PLAYER_BAND_ORDER,
      opacity: 1,
    });
    expect(viewport.layerManager.getLayer('player-legacy-a')).toBeDefined();
  });

  it('arms placement with the bound token id and Table fields', () => {
    const { viewport } = fakeViewport();
    const onArm = vi.fn();
    const canvas = createTableRosterCanvas({
      viewport: viewport as never,
      connection: null,
      onArm,
    });
    canvas.armPlacement({
      tokenId: 'bound-a',
      sceneMemberId: 'member-a',
      name: 'Aria',
      color: '#12855C',
      tokenCells: 2,
      fields: { tokenKind: 'player', characterId: 'legacy-a' },
    });
    const pending = onArm.mock.calls[0]![0];
    expect(pending).toMatchObject({
      entityName: 'Aria',
      config: {
        entityId: 'member-a',
        tokenId: 'bound-a',
        tokenSize: 2,
        fields: { tokenKind: 'player', characterId: 'legacy-a' },
      },
    });
    pending.config.onPlaced();
    expect(onArm).toHaveBeenLastCalledWith(null);
  });

  it('notifies on membership and control changes but not on movement', () => {
    const { viewport, setSelection } = fakeViewport();
    viewport.store.add(token());
    const canvas = createTableRosterCanvas({
      viewport: viewport as never,
      connection: null,
      onArm: vi.fn(),
    });
    const listener = vi.fn();
    const off = canvas.subscribe(listener);
    viewport.store.update('token-a', { position: { x: 5, y: 5 } });
    expect(listener).not.toHaveBeenCalled();
    viewport.store.update('token-a', {
      sceneMemberId: 'member-b',
    } as never);
    expect(listener).toHaveBeenCalledTimes(1);
    viewport.store.remove('token-a');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    canvas.select(['token-b']);
    expect(viewport.toolManager.setTool).toHaveBeenCalledWith('select', {
      marker: 'ctx',
    });
    expect(setSelection).toHaveBeenCalledWith(['token-b']);
  });
});
