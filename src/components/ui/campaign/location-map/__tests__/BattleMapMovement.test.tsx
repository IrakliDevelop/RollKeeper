import type { MovementEmission } from '@fieldnotes/vtt';
import { attachPathBroadcast } from '../pathSync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Viewport, SelectTool, createShape } from '@fieldnotes/core';
import type { PointerState } from '@fieldnotes/core';
import { movementRecordId } from '@fieldnotes/vtt';
import { BattleMapMovement } from '../BattleMapMovement';
import { getMovementTracker } from '../movementTracking';
import { getVttGridController } from '@/lib/fieldnotesVtt';
import { PLAYER_TOKEN_KIND } from '../PlayerTokenTool';
import { createMockCharacterState, createMockPlayerData } from '@/test/helpers';
import type { SharedInitiativeState } from '@/types/sharedState';

function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        // Real requestAnimationFrame is stubbed to a manual queue below (so
        // PathTool's raf-coalesced emissions can be flushed deterministically)
        // — that queue also catches the Viewport's own internal render-loop
        // tick, whose Background.render reads `ctx.canvas.width/height`.
        canvas,
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 40 }),
        createLinearGradient: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D);
    }
    return el;
  });
}

function makeViewport(): { vp: Viewport; container: HTMLDivElement } {
  stubCanvas();
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', {
    value: 800,
    configurable: true,
  });
  Object.defineProperty(container, 'clientHeight', {
    value: 600,
    configurable: true,
  });
  document.body.appendChild(container);
  return {
    vp: new Viewport(container, { tools: [new SelectTool()] }),
    container,
  };
}

let vp: Viewport;
let id: string;
const initiative: SharedInitiativeState = {
  encounterId: 'enc',
  isActive: true,
  round: 1,
  currentEntityId: 'entity',
  turnOrder: [
    {
      entityId: 'entity',
      displayName: 'Test Hero',
      type: 'player',
      playerCharacterId: 'pc',
    },
  ],
  enemyHpMode: 'off',
  enemyConditionsMode: 'off',
  updatedAt: '2026-11-01T00:00:00Z',
};
function controls(turn = initiative, dash = false) {
  return (
    <BattleMapMovement
      viewport={vp}
      campaignCode="TEST"
      battleMapId="map"
      characterId="pc"
      initiative={turn}
      dash={dash}
    />
  );
}
function pointer(x: number, y: number): PointerState {
  return { x, y, pressure: 0.5, pointerType: 'mouse', shiftKey: false };
}
function gesture(from: number, to: number) {
  act(() => {
    vp.historyRecorder.begin();
    vp.toolManager.handlePointerDown(pointer(from, 25), vp.toolContext);
    vp.toolManager.handlePointerMove(pointer(to, 25), vp.toolContext);
    vp.toolManager.handlePointerUp(pointer(to, 25), vp.toolContext);
    vp.historyRecorder.commit();
  });
}
beforeEach(() => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vp = makeViewport().vp;
  getVttGridController(vp).add({ gridType: 'square', cellSize: 40 });
  vp.setSnapToGrid(true);
  vp.setTool('select');
  const token = {
    ...createShape({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: vp.layerManager.activeLayerId,
    }),
    tokenKind: PLAYER_TOKEN_KIND,
    characterId: 'pc',
  };
  id = token.id;
  vp.store.add(token);
});
afterEach(() => {
  cleanup();
  getMovementTracker(vp).dispose();
  vp.destroy();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('player turn movement with the real Fieldnotes SDK', () => {
  it('counts multiple select drags and keeps spent feet when Dash is enabled', () => {
    const view = render(controls());
    gesture(25, 105);
    gesture(105, 185);
    expect(getMovementTracker(vp).getMovement(id)).toEqual({
      feet: 20,
      remaining: 10,
    });
    expect(
      screen.getByText('20 ft moved · 10 ft remaining')
    ).toBeInTheDocument();
    view.rerender(controls(initiative, true));
    gesture(185, 345);
    expect(getMovementTracker(vp).getMovement(id)).toEqual({
      feet: 40,
      remaining: 20,
    });
  });
  it('stops counting on another turn and starts a new budget next round', () => {
    const view = render(controls());
    gesture(25, 105);
    view.rerender(controls({ ...initiative, currentEntityId: 'someone-else' }));
    expect(getMovementTracker(vp).isTracked(id)).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Teleport' })
    ).not.toBeInTheDocument();
    gesture(105, 185);
    view.rerender(controls({ ...initiative, round: 2 }));
    expect(getMovementTracker(vp).getMovement(id)).toEqual({
      feet: 0,
      remaining: 30,
    });
    gesture(185, 265);
    expect(getMovementTracker(vp).getMovement(id)?.feet).toBe(10);
  });
  it('teleports within range without spending movement and undoes position and trail together', () => {
    render(controls());
    gesture(25, 105);
    const before = vp.store.getById(id)?.position;
    fireEvent.click(screen.getByRole('button', { name: 'Teleport' }));
    expect(vp.toolManager.activeTool?.name).toBe('vtt-place');
    gesture(260, 260);
    expect(vp.store.getById(id)?.position).not.toEqual(before);
    expect(getMovementTracker(vp).getMovement(id)?.feet).toBe(10);
    expect(vp.toolManager.activeTool?.name).toBe('select');
    act(() => {
      vp.undo();
    });
    expect(vp.store.getById(id)?.position).toEqual(before);
    expect(getMovementTracker(vp).getMovement(id)?.feet).toBe(10);
  });
  it('refuses out-of-range teleports and cancels pending placement at a turn boundary', () => {
    const view = render(controls());
    fireEvent.click(screen.getByRole('button', { name: 'Teleport' }));
    const before = vp.store.getById(id)?.position;
    gesture(1000, 1000);
    expect(vp.store.getById(id)?.position).toEqual(before);
    expect(vp.toolManager.activeTool?.name).toBe('vtt-place');
    view.rerender(controls({ ...initiative, round: 2 }));
    expect(vp.toolManager.activeTool?.name).toBe('select');
    expect(vp.store.getById(movementRecordId(id))).toBeUndefined();
  });
  it('resets movement without moving the token and restores the total on undo', () => {
    render(controls());
    gesture(25, 105);
    const before = vp.store.getById(id)?.position;
    fireEvent.click(screen.getByRole('button', { name: 'Reset movement' }));
    expect(getMovementTracker(vp).getMovement(id)?.feet).toBe(0);
    expect(vp.store.getById(id)?.position).toEqual(before);
    act(() => {
      vp.undo();
    });
    expect(getMovementTracker(vp).getMovement(id)?.feet).toBe(10);
  });
});

it('shares live movement only when enabled and clears immediately when hidden or disabled', () => {
  render(controls());
  const tracker = getMovementTracker(vp);
  let emit: (value: MovementEmission | null) => void = () => {};
  vi.spyOn(tracker, 'onMovement').mockImplementation(listener => {
    emit = listener;
    return () => {};
  });
  const sendPresence = vi.fn();
  let hidden = false;
  const broadcast = attachPathBroadcast(
    { onPath: () => () => {} },
    { sendPresence },
    {
      role: 'dm',
      viewport: vp,
      getElement: key => vp.store.getById(key) ?? null,
      isDmOnlyElement: () => hidden,
    }
  );
  const emission: MovementEmission = {
    elementId: id,
    visibility: 'all',
    model: {
      grid: { type: 'square', cellSize: 40 },
      trail: [],
      path: [
        { x: 20, y: 20 },
        { x: 100, y: 20 },
      ],
      segmentColors: ['#22c55e'],
      cells: [],
      label: '10 ft',
      over: false,
      labelAnchor: { x: 100, y: 0 },
    },
  };
  emit(emission);
  expect(sendPresence).not.toHaveBeenCalled();
  broadcast.setSharing(true);
  emit(emission);
  expect(sendPresence).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: 'movement', elementId: id })
  );
  hidden = true;
  emit(emission);
  expect(sendPresence).toHaveBeenLastCalledWith({
    kind: 'movement',
    cleared: true,
  });
  sendPresence.mockClear();
  emit(emission);
  expect(sendPresence).not.toHaveBeenCalled();
  hidden = false;
  emit(emission);
  broadcast.setSharing(false);
  expect(sendPresence).toHaveBeenLastCalledWith({
    kind: 'movement',
    cleared: true,
  });
  broadcast.dispose();
});

it('tracks a Table party token from its scene adapter without legacy encounter state', () => {
  const listeners = new Set<() => void>();
  let epoch: string | null = 'run-table:1:1:public-member';
  const adapter = {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getMovementTurn: () =>
      epoch ? { epoch, entityIds: ['public-member'], playerIds: ['pc'] } : null,
    getBattleMap: () => ({ dmOnlyElements: { [id]: true } }),
    resolveMovement: () => ({
      name: 'Synthetic party',
      walkFeet: 45,
      entityId: 'public-member',
    }),
  } as unknown as import('@/lib/table/sceneAdapter').TableSceneAdapter;
  const view = render(
    <BattleMapMovement
      viewport={vp}
      campaignCode="TEST"
      battleMapId="table-scene"
      sceneAdapter={adapter}
      dash={false}
    />
  );
  gesture(25, 105);
  expect(getMovementTracker(vp).getMovement(id)).toEqual({
    feet: 10,
    remaining: 35,
  });
  const record = vp.store.getById(movementRecordId(id)) as unknown as {
    data: { epoch: string; visibility: string };
  };
  expect(record.data).toMatchObject({ epoch, visibility: 'dm' });
  act(() => {
    epoch = 'run-table:2:1:public-member';
    listeners.forEach(listener => listener());
  });
  expect(getMovementTracker(vp).getMovement(id)).toEqual({
    feet: 0,
    remaining: 45,
  });
  act(() => {
    epoch = null;
    listeners.forEach(listener => listener());
  });
  expect(getMovementTracker(vp).isTracked(id)).toBe(false);
  expect(
    screen.queryByRole('button', { name: 'Teleport' })
  ).not.toBeInTheDocument();
  view.unmount();
  expect(listeners.size).toBe(0);
});

it('uses the same generation-aware public epoch for a Table player and resets on restart', () => {
  const view = render(controls({ ...initiative, combatGeneration: 1 }));
  gesture(25, 105);
  expect(
    (
      vp.store.getById(movementRecordId(id)) as unknown as {
        data: { epoch: string };
      }
    ).data.epoch
  ).toBe('enc:1:1:entity');
  view.rerender(controls({ ...initiative, combatGeneration: 2 }));
  expect(getMovementTracker(vp).getMovement(id)).toEqual({
    feet: 0,
    remaining: 30,
  });
});

it('uses authorized live player walking speed and active buffs for a Table turn', () => {
  const adapter = {
    subscribe: () => () => {},
    getMovementTurn: () => ({
      epoch: 'run:1:1:member',
      entityIds: ['member'],
      playerIds: ['pc'],
    }),
    getBattleMap: () => ({ dmOnlyElements: {} }),
    resolveMovement: () => ({
      name: 'Cached',
      walkFeet: 20,
      entityId: 'member',
    }),
  } as unknown as import('@/lib/table/sceneAdapter').TableSceneAdapter;
  const player = createMockPlayerData({
    playerId: 'pc',
    characterId: 'pc',
    characterData: createMockCharacterState({
      speed: 35,
      temporaryBuffs: [
        {
          id: 'speed-buff',
          name: 'Speed',
          effects: [
            { id: 'speed-effect', targetStat: 'speed', mode: 'add', value: 10 },
          ],
          isActive: true,
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
    }),
  });
  render(
    <BattleMapMovement
      viewport={vp}
      campaignCode="TEST"
      battleMapId="scene"
      sceneAdapter={adapter}
      tablePlayers={[player]}
      dash={false}
    />
  );
  gesture(25, 105);
  expect(getMovementTracker(vp).getMovement(id)).toEqual({
    feet: 10,
    remaining: 35,
  });
});
