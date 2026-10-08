import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementStore, type CanvasElement } from '@fieldnotes/core';
import { SyncClient } from '@fieldnotes/sync';
import { createGrid } from '@fieldnotes/vtt';

import {
  fieldnotesElementRegistry,
  getVttGridController,
} from '@/lib/fieldnotesVtt';
import {
  mountRealViewport,
  type RealViewportHarness,
} from '@/test/realViewport';
import { createDisplayProjection, isTablePhysical } from '../displayProjection';

/** M2: the display mirrors its private synced store minus physical minis. */

const REMOTE = { origin: 'remote' };

function shape(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'shape',
    shape: 'rectangle',
    position: { x: 0, y: 0 },
    size: { w: 10, h: 10 },
    zIndex: 0,
    locked: false,
    layerId: 'annotations',
    ...extra,
  } as unknown as CanvasElement;
}
const token = (id: string, physical: boolean) =>
  shape(id, {
    tokenKind: 'combatant',
    entityId: `member-${id}`,
    sceneMemberId: `member-${id}`,
    ...(physical ? { tableRepresentation: 'physical' } : {}),
  });

function gridEnvelope(cellSize = 50) {
  const adapter = fieldnotesElementRegistry.getAdapter('vtt:grid')!;
  return adapter.wrap(
    createGrid({ gridType: 'square', cellSize, layerId: 'map' })
  ) as unknown as CanvasElement;
}

let source: ElementStore;
let target: ElementStore;
let stop: () => void;
const ids = (store: ElementStore) =>
  store
    .getAll()
    .map(element => element.id)
    .sort();

beforeEach(() => {
  source = new ElementStore(fieldnotesElementRegistry);
  target = new ElementStore(fieldnotesElementRegistry);
  stop = createDisplayProjection(source, target);
});
afterEach(() => {
  stop();
  cleanup();
});

describe('display projection (M2)', () => {
  it('omits physical-tagged elements from the viewport store; keeps them in the source', () => {
    source.add(shape('map-image'), REMOTE);
    source.add(token('a', true), REMOTE);
    source.add(token('b', false), REMOTE);
    expect(ids(source)).toEqual(['a', 'b', 'map-image']);
    expect(ids(target)).toEqual(['b', 'map-image']);
    expect(isTablePhysical(source.getById('a')!)).toBe(true);
    expect(isTablePhysical(source.getById('b')!)).toBe(false);
  });

  it('a field toggle adds/removes the token immediately and mirrors field removals', () => {
    source.add(token('a', false), REMOTE);
    expect(ids(target)).toEqual(['a']);
    source.update('a', { tableRepresentation: 'physical' } as never, REMOTE);
    expect(ids(target)).toEqual([]);
    source.update(
      'a',
      { tableRepresentation: undefined, position: { x: 5, y: 6 } } as never,
      REMOTE
    );
    expect(ids(target)).toEqual(['a']);
    expect(target.getById('a')!.position).toEqual({ x: 5, y: 6 });
    // A key removed upstream (replacement patch) is removed downstream too.
    source.update('a', { entityId: undefined } as never, REMOTE);
    expect(
      (target.getById('a') as unknown as Record<string, unknown>).entityId
    ).toBeUndefined();
    source.remove('a', REMOTE);
    expect(ids(target)).toEqual([]);
  });

  it('mirrors loadSnapshot as one filtered snapshot (clear, then adds)', () => {
    source.add(shape('old'), REMOTE);
    const events: string[] = [];
    target.on('clear', () => events.push('clear'));
    target.on('add', element => events.push(`add:${element.id}`));
    target.on('update', ({ current }) => events.push(`update:${current.id}`));
    source.loadSnapshot(
      [shape('map-image'), token('a', true), token('b', false)],
      REMOTE
    );
    expect(ids(target)).toEqual(['b', 'map-image']);
    expect(events).toEqual(['clear', 'add:map-image', 'add:b']);
  });

  it('treats a batch (coalesced notifications) as a full resync and handles clear', () => {
    source.add(shape('keep'), REMOTE);
    source.add(shape('gone'), REMOTE);
    const batches = vi.fn();
    target.on('batch', batches);
    const controller = source.suspendNotifications();
    source.remove('gone', REMOTE);
    source.add(token('p', true), REMOTE);
    source.add(token('d', false), REMOTE);
    source.update('keep', { position: { x: 9, y: 9 } } as never, REMOTE);
    controller.resume();
    expect(ids(target)).toEqual(['d', 'keep']);
    expect(target.getById('keep')!.position).toEqual({ x: 9, y: 9 });
    expect(batches).toHaveBeenCalledTimes(1);
    source.clear(REMOTE);
    expect(ids(target)).toEqual([]);
  });

  it('starts from the current source contents and stops mirroring after dispose', () => {
    stop();
    source.add(shape('pre'), REMOTE);
    source.add(token('x', true), REMOTE);
    stop = createDisplayProjection(source, target);
    expect(ids(target)).toEqual(['pre']);
    stop();
    source.add(shape('late'), REMOTE);
    expect(ids(target)).toEqual(['pre']);
    stop = () => {};
  });

  it('never writes back: viewport-store writes are not observed by the sync client', () => {
    const sent: string[] = [];
    const client = new SyncClient({
      store: source,
      transport: {
        send: message => sent.push(message),
        onMessage: () => () => {},
        close: () => {},
      },
      clientId: 'display-CAMP1',
      elementRegistry: fieldnotesElementRegistry,
    });
    client.start();
    sent.length = 0;
    // Positive control: a local write to the source store is sent.
    source.add(shape('local-source'));
    const sentForSource = sent.length;
    expect(sentForSource).toBeGreaterThan(0);
    // Remote-applied changes (mirrored) and direct viewport-store writes are not.
    source.add(token('remote', false), REMOTE);
    sent.length = 0;
    target.add(shape('viewport-local'));
    target.update('remote', { position: { x: 1, y: 1 } } as never);
    target.remove('local-source');
    expect(sent).toEqual([]);
    client.dispose();
  });

  it('keeps map, grid and markers unaffected; the real grid controller reads the projection', () => {
    const harness: RealViewportHarness = mountRealViewport({
      elementRegistry: fieldnotesElementRegistry,
    });
    stop();
    stop = createDisplayProjection(source, harness.viewport.store);
    try {
      const grid = getVttGridController(harness.viewport);
      const changes = vi.fn();
      grid.onChange(changes);
      source.add(gridEnvelope(50), REMOTE);
      source.add(shape('marker', { type: 'shape', layerId: 'map' }), REMOTE);
      source.add(token('a', true), REMOTE);
      expect(grid.getInfo()).toMatchObject({
        gridType: 'square',
        cellSize: 50,
      });
      expect(changes).toHaveBeenCalled();
      expect(harness.viewport.store.getById('marker')).toBeDefined();
      expect(harness.viewport.store.getById('a')).toBeUndefined();
    } finally {
      harness.destroy();
    }
  });

  it('a 100-element batch with 50 physical tokens resyncs in well under 100 ms', () => {
    const controller = source.suspendNotifications();
    for (let index = 0; index < 100; index += 1)
      source.add(token(`t${index}`, index % 2 === 0), REMOTE);
    const started = performance.now();
    controller.resume();
    for (let index = 0; index < 100; index += 1)
      source.update(
        `t${index}`,
        { position: { x: index, y: 1 } } as never,
        REMOTE
      );
    const elapsed = performance.now() - started;
    expect(target.count).toBe(50);
    expect(elapsed).toBeLessThan(100);
  });
});
