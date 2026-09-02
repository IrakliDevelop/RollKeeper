import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Viewport, createShape, toPathPresence } from '@fieldnotes/core';
import type {
  CanvasElement,
  PathEmission,
  PathTool,
  PointerState,
  ToolContext,
} from '@fieldnotes/core';

import { createMovementPathTool } from '../movementTool';
import { applyMovementCommit } from '../movementCommit';
import { attachPathBroadcast, attachRemotePaths } from '../pathSync';
import { attachRemoteLaserTrails } from '../laserSync';
import { attachRemotePings } from '../pingSync';
import { attachRemoteMeasurements } from '../measureSync';
import { attachFocusReceiver } from '../focusSync';
import { resolveDmMovement, logDmMovement } from '../movementLogging';
import { COMBATANT_TOKEN_KIND } from '../tokenIdentity';

import { useEncounterStore } from '@/store/encounterStore';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useBattleMapStore } from '@/store/battleMapStore';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';
import type { BattleMap } from '@/types/battlemap';

/**
 * Whole-feature integration suite for movement paths: a REAL `Viewport`, a
 * REAL `PathTool` (via `createMovementPathTool`), and REAL Zustand stores
 * throughout — only the canvas 2D `getContext` seam is stubbed (jsdom has no
 * live rendering pipeline). No `@fieldnotes` module is mocked anywhere in
 * this file. Every module-level unit is exercised in isolation elsewhere
 * (movementTool.test.tsx, movementCommit.test.tsx, pathSync.test.ts,
 * movementLogging.test.ts, movementSpeed.test.ts); this file proves they
 * cooperate correctly wired together, end to end.
 */

// --- Canvas + Viewport scaffolding (verbatim pattern from
// selectionEvents.integration.test.tsx) ---------------------------------

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
  return { vp: new Viewport(container), container };
}

function tokenAt(x: number, y: number, entityId: string) {
  return {
    ...createShape({
      position: { x, y },
      size: { w: 40, h: 40 },
      shape: 'ellipse',
      strokeColor: '#000',
      strokeWidth: 1,
      fillColor: '#c0392b',
    }),
    zIndex: 1000,
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId,
  };
}

// --- Real PathTool gesture driving (direct method calls, identity camera,
// deterministic raf — mirrors laserSync.test.ts / measureSync.test.ts,
// which drive their SDK tools the same way rather than through DOM events) --

let rafCallbacks: FrameRequestCallback[];

beforeEach(() => {
  rafCallbacks = [];
  let id = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++id;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function flushFrame(): void {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  for (const cb of cbs) cb(0);
}

function pt(x: number, y: number): PointerState {
  return { x, y, pressure: 0.5, pointerType: 'mouse', shiftKey: false };
}

/** Identity camera + a captured 40px square grid — matches the 40x40 tokens
 * below, so the SDK's own cell-center snap leaves round pointer coordinates
 * unchanged (100 and 340 already land on cell centers). */
function pathCtx(vp: Viewport): ToolContext {
  return {
    camera: { screenToWorld: (p: { x: number; y: number }) => ({ ...p }) },
    store: vp.store,
    requestRender: vi.fn(),
    gridSize: 40,
    gridType: 'square',
  } as unknown as ToolContext;
}

/** Opens a path on the token at `origin`, drags to `to`, and commits by
 * tapping again on the last waypoint (within-commit-radius finish). */
function driveCommit(
  tool: PathTool,
  ctx: ToolContext,
  origin: { x: number; y: number },
  to: { x: number; y: number }
): void {
  tool.onPointerDown(pt(origin.x, origin.y), ctx);
  tool.onPointerMove(pt(to.x, to.y), ctx);
  tool.onPointerUp(pt(to.x, to.y), ctx);
  tool.onPointerDown(pt(to.x, to.y), ctx);
  tool.onPointerUp(pt(to.x, to.y), ctx);
}

// --- Store fixtures -------------------------------------------------------

function resetStores(): void {
  useEncounterStore.setState({ encounters: [], activeEncounterId: null });
  useCombatLogStore.setState({
    encounters: {},
    combatLogTombstones: {},
    activeArchiveId: null,
    lastAdmissionError: null,
  });
  useBattleMapStore.setState({ battleMaps: {} });
}

const CAMPAIGN = 'CODE01';
const MAP_ID = 'map-1';

function seedBattleMap(dmOnlyElements: Record<string, boolean>): void {
  const map: BattleMap = {
    id: MAP_ID,
    campaignCode: CAMPAIGN,
    name: 'Test Map',
    mapImageUrl: '',
    mapImageSize: { w: 0, h: 0 },
    canvasState: '',
    dmOnlyElements,
    gridEnabled: true,
    linkedEncounterIds: ['enc-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  useBattleMapStore.getState().addBattleMap(CAMPAIGN, map);
}

function seedGoblinEncounter(): void {
  useEncounterStore.setState({
    encounters: [
      createMockEncounter({
        id: 'enc-1',
        entities: [
          createMockEncounterEntity({
            id: 'e-1',
            name: 'Goblin',
            monsterStatBlock: { speed: '30 ft.' } as never,
          }),
        ],
      }),
    ],
  });
}

// --- A minimal presence connection: sendPresence recorder plus
// onPresence/onPresenceLeave registries (the brief's "FakeConnection = the
// connection() recorder from Task 7 plus onPresence/onPresenceLeave
// registries" — this satisfies every *PresenceConnection interface in the
// feature, so ONE fake can feed every receiver at once for Area 3). ---------

function fakeConnection() {
  const sent: unknown[] = [];
  const presenceHandlers = new Set<(from: string, data: unknown) => void>();
  const leaveHandlers = new Set<(from: string) => void>();
  return {
    sent,
    sendPresence: (data: unknown) => sent.push(data),
    onPresence(handler: (from: string, data: unknown) => void) {
      presenceHandlers.add(handler);
      return () => presenceHandlers.delete(handler);
    },
    onPresenceLeave(handler: (from: string) => void) {
      leaveHandlers.add(handler);
      return () => leaveHandlers.delete(handler);
    },
    emit(from: string, data: unknown) {
      for (const h of [...presenceHandlers]) h(from, data);
    },
    emitLeave(from: string) {
      for (const h of [...leaveHandlers]) h(from);
    },
  };
}

const clearedPayload = toPathPresence(null);

describe('movement feature integration (real Viewport + real PathTool + real stores)', () => {
  beforeEach(() => {
    resetStores();
  });

  // === Area 1: commit round-trip through the real store ===================
  describe('commit round-trip through the real store', () => {
    it('a combatant on a square grid: real gesture, real resolveDmMovement, one position update, one undo step, one logged movement event', () => {
      const { vp, container } = makeViewport();
      seedGoblinEncounter();
      const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: identity => resolveDmMovement(identity, ['enc-1']),
        isDashActive: () => false,
      });
      tool.onCommit(emission => {
        applyMovementCommit(emission, {
          viewport: vp,
          role: 'dm',
          resolveMovement: identity => resolveDmMovement(identity, ['enc-1']),
          logMovement: payload => logDmMovement(['enc-1'], payload),
        });
      });

      const transactionSpy = vi.spyOn(vp, 'transaction');
      const ctx = pathCtx(vp);
      // Token centre (100,100) -> 6 cells east (340,100): 30 ft at 5 ft/cell.
      driveCommit(tool, ctx, { x: 100, y: 100 }, { x: 340, y: 100 });

      // Position update.
      expect(vp.store.getById(token.id)?.position).toEqual({ x: 320, y: 80 });

      // Exactly one transaction; one undo restores the original position.
      expect(transactionSpy).toHaveBeenCalledTimes(1);
      vp.undo();
      expect(vp.store.getById(token.id)?.position).toEqual({ x: 80, y: 80 });
      vp.redo();
      expect(vp.store.getById(token.id)?.position).toEqual({ x: 320, y: 80 });

      // One movement event, feet/cells echoed from the real path measurement.
      const events = useCombatLogStore.getState().getEvents(archiveId);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'movement',
        entityId: 'e-1',
        entityName: 'Goblin',
        feet: 30,
        cells: 6,
        from: { x: 100, y: 100 },
        to: { x: 340, y: 100 },
      });

      vp.destroy();
      container.remove();
    });
  });

  // === Area 2: anchor fail-closed end-to-end ===============================
  describe('anchor fail-closed end-to-end (real dmOnlyElements + real vp.store)', () => {
    function attachRealBroadcast(
      vp: Viewport,
      tool: PathTool,
      conn: ReturnType<typeof fakeConnection>
    ) {
      return attachPathBroadcast(tool, conn, {
        role: 'dm',
        // The REAL live-read predicate and REAL vp.store.getById lookup —
        // Task 9's exact wiring shape (DmBattleMapCanvas.hooks.ts), not a
        // fixture Map like pathSync.test.ts's unit coverage.
        isDmOnlyElement: id =>
          !!useBattleMapStore.getState().battleMaps[CAMPAIGN]?.[MAP_ID]
            ?.dmOnlyElements[id],
        getElement: id => vp.store.getById(id) ?? null,
      });
    }

    it('DM-only from the start blocks broadcast; flipping it live re-enables broadcast on the next frame (live read, not a snapshot)', () => {
      const { vp, container } = makeViewport();
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);
      seedBattleMap({ [token.id]: true });

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: () => null,
        isDashActive: () => false,
      });
      const conn = fakeConnection();
      const handle = attachRealBroadcast(vp, tool, conn);
      handle.setSharing(true);

      const ctx = pathCtx(vp);
      tool.onPointerDown(pt(100, 100), ctx);
      tool.onPointerMove(pt(340, 100), ctx);
      flushFrame();
      expect(conn.sent).toEqual([]);

      useBattleMapStore.getState().setDmOnly(CAMPAIGN, MAP_ID, token.id, false);
      tool.onPointerMove(pt(340, 180), ctx);
      flushFrame();
      expect(conn.sent).toHaveLength(1);

      handle.dispose();
      vp.destroy();
      container.remove();
    });

    it('anchor turning DM-only mid-path (real store) sends exactly one cleared frame, then nothing further', () => {
      const { vp, container } = makeViewport();
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);
      seedBattleMap({});

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: () => null,
        isDashActive: () => false,
      });
      const conn = fakeConnection();
      const handle = attachRealBroadcast(vp, tool, conn);
      handle.setSharing(true);

      const ctx = pathCtx(vp);
      tool.onPointerDown(pt(100, 100), ctx);
      tool.onPointerMove(pt(340, 100), ctx);
      flushFrame();
      expect(conn.sent).toHaveLength(1);

      useBattleMapStore.getState().setDmOnly(CAMPAIGN, MAP_ID, token.id, true);
      tool.onPointerMove(pt(340, 180), ctx);
      flushFrame();
      expect(conn.sent).toHaveLength(2);
      expect(conn.sent[1]).toEqual(clearedPayload);

      tool.onPointerMove(pt(340, 260), ctx);
      flushFrame();
      expect(conn.sent).toHaveLength(2);

      handle.dispose();
      vp.destroy();
      container.remove();
    });

    it('deleting the token from the real vp.store mid-path sends exactly one cleared frame', () => {
      const { vp, container } = makeViewport();
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);
      seedBattleMap({});

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: () => null,
        isDashActive: () => false,
      });
      const conn = fakeConnection();
      const handle = attachRealBroadcast(vp, tool, conn);
      handle.setSharing(true);

      const ctx = pathCtx(vp);
      tool.onPointerDown(pt(100, 100), ctx);
      tool.onPointerMove(pt(340, 100), ctx);
      flushFrame();
      expect(conn.sent).toHaveLength(1);

      vp.store.remove(token.id);
      tool.onPointerMove(pt(340, 180), ctx);
      flushFrame();
      expect(conn.sent).toHaveLength(2);
      expect(conn.sent[1]).toEqual(clearedPayload);

      handle.dispose();
      vp.destroy();
      container.remove();
    });
  });

  // === Area 3: remote overlay coexistence ===================================
  describe('remote overlay coexistence over one connection', () => {
    it('laser + ping + measure + focus + path presence over ONE connection: the path overlay applies only kind:path, siblings undisturbed', () => {
      const { vp, container } = makeViewport();
      const conn = fakeConnection();

      const laserDispose = attachRemoteLaserTrails(vp, conn);
      const pings = attachRemotePings(vp, conn);
      const measures = attachRemoteMeasurements(vp, conn);
      const focus = attachFocusReceiver(vp, conn, { role: 'player' });
      const paths = attachRemotePaths(vp, conn);
      const focusApplySpy = vi.spyOn(focus.receiver, 'apply');

      const pathEmission = {
        anchorKey: 'anchor-1',
        waypoints: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
        cursor: null,
        segments: [{ cells: 1, feet: 5 }],
        totalCells: 1,
        totalFeet: 5,
        color: '#EF4444',
        rangeBands: [],
      } as unknown as PathEmission;

      conn.emit('peer-1', {
        kind: 'laser',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        color: '#F4C430',
        width: 3,
        fadeMs: 900,
      });
      conn.emit('peer-1', {
        kind: 'ping',
        x: 5,
        y: 5,
        color: '#3b82f6',
        durationMs: 900,
        radius: 20,
      });
      conn.emit('peer-1', {
        kind: 'measure',
        start: { x: 0, y: 0 },
        end: { x: 40, y: 0 },
        worldDistance: 40,
        cells: 1,
        feet: 5,
        color: '#FF5722',
      });
      conn.emit('peer-1', {
        kind: 'focus',
        x: 0,
        y: 0,
        w: 400,
        h: 300,
        audience: 'players',
      });

      // Four foreign frames in: the path overlay picked up nothing.
      expect(paths.overlay.activeSenderCount).toBe(0);

      conn.emit('peer-1', toPathPresence(pathEmission));

      // The path frame landed, and picking it up did not disturb the
      // siblings that already applied their own frame.
      expect(paths.overlay.activeSenderCount).toBe(1);
      expect(pings.overlay.activeSenderCount).toBe(1);
      expect(measures.overlay.activeSenderCount).toBe(1);
      expect(focusApplySpy).toHaveReturnedWith(true);

      // And the reverse: a path payload is not a foreign kind ANY sibling
      // (here, focus) will accept.
      expect(focus.receiver.apply('peer-1', toPathPresence(pathEmission))).toBe(
        false
      );

      laserDispose();
      pings.dispose();
      measures.dispose();
      focus.dispose();
      paths.dispose();
      vp.destroy();
      container.remove();
    });
  });

  // === Area 4: ephemerality =================================================
  describe('ephemerality: path traffic never touches elements, history, or canvasState', () => {
    it('mid-gesture emissions, a remote path, and a commit leave the store holding only the token — never a path element', () => {
      const { vp, container } = makeViewport();
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
        isDashActive: () => false,
      });
      tool.onCommit(emission => {
        applyMovementCommit(emission, {
          viewport: vp,
          role: 'dm',
          resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
        });
      });

      const conn = fakeConnection();
      const broadcast = attachPathBroadcast(tool, conn, {
        role: 'dm',
        isDmOnlyElement: () => false,
        getElement: id => vp.store.getById(id) ?? null,
      });
      broadcast.setSharing(true);
      const remote = attachRemotePaths(vp, conn);

      const ctx = pathCtx(vp);
      tool.onPointerDown(pt(100, 100), ctx);
      tool.onPointerMove(pt(340, 100), ctx);
      flushFrame();

      // Mid-gesture: exactly one send, still only the token in the store.
      expect(conn.sent).toHaveLength(1);
      expect(vp.store.snapshot().map(e => e.id)).toEqual([token.id]);

      // A remote peer's own path presence arrives too — still no element.
      const remoteEmission = {
        anchorKey: 'remote-anchor',
        waypoints: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
        cursor: null,
        segments: [{ cells: 1, feet: 5 }],
        totalCells: 1,
        totalFeet: 5,
        color: '#EF4444',
        rangeBands: [],
      } as unknown as PathEmission;
      conn.emit('peer-2', toPathPresence(remoteEmission));
      expect(remote.overlay.activeSenderCount).toBe(1);
      expect(vp.store.snapshot().map(e => e.id)).toEqual([token.id]);

      // Commit: the anchor moves, but the element COUNT never changes.
      tool.onPointerUp(pt(340, 100), ctx);
      tool.onPointerDown(pt(340, 100), ctx);
      tool.onPointerUp(pt(340, 100), ctx);

      expect(vp.store.snapshot().map(e => e.id)).toEqual([token.id]);
      expect(vp.store.getById(token.id)?.position).toEqual({ x: 320, y: 80 });

      // exportJSON/canvasState carries no path data — only the moved token.
      // (There is structurally no path CanvasElement type at all — PathTool
      // is store-free by contract — so the discriminating check is that the
      // serialized state carries no waypoint/anchor data anywhere in it.)
      const exportedText = vp.exportJSON();
      const exported = JSON.parse(exportedText) as {
        elements: CanvasElement[];
      };
      expect(exported.elements).toHaveLength(1);
      expect(exported.elements[0]?.id).toBe(token.id);
      expect(exportedText).not.toContain('waypoints');
      expect(exportedText).not.toContain('anchorKey');

      broadcast.dispose();
      remote.dispose();
      vp.destroy();
      container.remove();
    });
  });

  // === Area 5: zero-move + stale-anchor no-ops at the integration level =====
  describe('zero-move and stale-anchor no-ops, driven through the real PathTool', () => {
    it('a there-and-back path (net-zero destination) commits nothing and logs nothing', () => {
      const { vp, container } = makeViewport();
      seedGoblinEncounter();
      const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: identity => resolveDmMovement(identity, ['enc-1']),
        isDashActive: () => false,
      });
      const commits: PathEmission[] = [];
      tool.onCommit(emission => {
        commits.push(emission);
        applyMovementCommit(emission, {
          viewport: vp,
          role: 'dm',
          resolveMovement: identity => resolveDmMovement(identity, ['enc-1']),
          logMovement: payload => logDmMovement(['enc-1'], payload),
        });
      });

      const ctx = pathCtx(vp);
      const origin = { x: 100, y: 100 };
      const corner = { x: 340, y: 100 };
      // Open on the token, add a corner, then a THIRD waypoint back at the
      // exact origin — a real 2-leg "there and back" path whose net
      // displacement is zero even though it measured real distance.
      tool.onPointerDown(pt(origin.x, origin.y), ctx);
      tool.onPointerMove(pt(corner.x, corner.y), ctx);
      tool.onPointerUp(pt(corner.x, corner.y), ctx);
      tool.onPointerMove(pt(origin.x, origin.y), ctx);
      tool.onPointerUp(pt(origin.x, origin.y), ctx);
      // Finish: tap again at the last waypoint (now back at origin).
      tool.onPointerDown(pt(origin.x, origin.y), ctx);
      tool.onPointerUp(pt(origin.x, origin.y), ctx);

      expect(commits).toHaveLength(1);
      expect(commits[0]?.waypoints).toEqual([origin, corner, origin]);
      expect(vp.store.getById(token.id)?.position).toEqual({ x: 80, y: 80 });
      expect(useCombatLogStore.getState().getEvents(archiveId)).toHaveLength(0);

      vp.destroy();
      container.remove();
    });

    it('deleting the token between gesture and commit (real store) commits nothing and logs nothing', () => {
      const { vp, container } = makeViewport();
      seedGoblinEncounter();
      const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;
      const token = tokenAt(80, 80, 'e-1');
      vp.store.add(token);

      const tool = createMovementPathTool({
        getViewport: () => vp,
        role: 'dm',
        resolveMovement: identity => resolveDmMovement(identity, ['enc-1']),
        isDashActive: () => false,
      });
      const commitResults: boolean[] = [];
      tool.onCommit(emission => {
        commitResults.push(
          applyMovementCommit(emission, {
            viewport: vp,
            role: 'dm',
            resolveMovement: identity => resolveDmMovement(identity, ['enc-1']),
            logMovement: payload => logDmMovement(['enc-1'], payload),
          })
        );
      });

      const ctx = pathCtx(vp);
      const origin = { x: 100, y: 100 };
      const dest = { x: 340, y: 100 };
      tool.onPointerDown(pt(origin.x, origin.y), ctx);
      tool.onPointerMove(pt(dest.x, dest.y), ctx);
      tool.onPointerUp(pt(dest.x, dest.y), ctx);

      // Gesture still open (mid-path) — delete the anchor from the REAL
      // store before the finishing tap.
      vp.store.remove(token.id);

      tool.onPointerDown(pt(dest.x, dest.y), ctx);
      tool.onPointerUp(pt(dest.x, dest.y), ctx);

      expect(commitResults).toEqual([false]);
      expect(vp.store.getById(token.id)).toBeUndefined();
      expect(useCombatLogStore.getState().getEvents(archiveId)).toHaveLength(0);

      vp.destroy();
      container.remove();
    });
  });
});
