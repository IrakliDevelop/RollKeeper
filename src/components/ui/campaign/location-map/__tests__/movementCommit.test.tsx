import { describe, it, expect, vi, afterEach } from 'vitest';
import { Viewport, createShape } from '@fieldnotes/core';
import type { PathEmission } from '@fieldnotes/core';

import { applyMovementCommit } from '../movementCommit';
import type { MovementCommitContext } from '../movementCommit';
import { COMBATANT_TOKEN_KIND } from '../tokenIdentity';
import { PLAYER_TOKEN_KIND } from '../PlayerTokenTool';

/**
 * jsdom has no canvas 2D context: stub `getContext` on any canvas the
 * Viewport creates so construction and its render loop don't throw. Copied
 * VERBATIM from selectionEvents.integration.test.tsx (same directory) —
 * stub the browser API, never an @fieldnotes module.
 */
function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
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

// Emission helper — the shape PathTool hands onCommit (cursor null,
// anchorKey echoed, first waypoint = anchor origin).
function commitEmission(
  anchorKey: string | undefined,
  dest: { x: number; y: number }
) {
  return {
    anchorKey,
    waypoints: [{ x: 100, y: 100 }, dest],
    cursor: null,
    segments: [{ cells: 6, feet: 30 }],
    totalCells: 6,
    totalFeet: 30,
    color: '#EF4444',
    rangeBands: [],
  } as unknown as PathEmission;
}

const DESTINATION = { x: 260, y: 180 };
const ORIGIN_CENTRE = { x: 100, y: 100 };

describe('applyMovementCommit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('happy path: moves the token, returns true, logs the payload', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(token.id, DESTINATION),
      ctx
    );

    expect(result).toBe(true);
    expect(vp.store.getById(token.id)?.position).toEqual({ x: 240, y: 160 });
    expect(logMovement).toHaveBeenCalledTimes(1);
    expect(logMovement).toHaveBeenCalledWith({
      entityId: 'e-1',
      entityName: 'Goblin',
      feet: 30,
      cells: 6,
      from: ORIGIN_CENTRE,
      to: DESTINATION,
    });

    vp.destroy();
    container.remove();
  });

  it('commits exactly one transaction, and one undo restores the original position', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
    };

    const transactionSpy = vi.spyOn(vp, 'transaction');
    const result = applyMovementCommit(
      commitEmission(token.id, DESTINATION),
      ctx
    );

    expect(result).toBe(true);
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(vp.store.getById(token.id)?.position).toEqual({ x: 240, y: 160 });

    vp.undo();
    expect(vp.store.getById(token.id)?.position).toEqual({ x: 80, y: 80 });

    vp.destroy();
    container.remove();
  });

  it('stale anchor: element deleted before commit returns false and logs nothing', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    vp.store.remove(token.id);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(token.id, DESTINATION),
      ctx
    );

    expect(result).toBe(false);
    expect(vp.store.getById(token.id)).toBeUndefined();
    expect(logMovement).not.toHaveBeenCalled();

    vp.destroy();
    container.remove();
  });

  it('ownership veto: a player cannot move a combatant token', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'player',
      characterId: 'c-9',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(token.id, DESTINATION),
      ctx
    );

    expect(result).toBe(false);
    expect(vp.store.getById(token.id)?.position).toEqual({ x: 80, y: 80 });
    expect(logMovement).not.toHaveBeenCalled();

    vp.destroy();
    container.remove();
  });

  it('zero-length move: destination equals the anchor centre commits nothing', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const versionBefore = vp.store.getVersion(token.id);
    const elBefore = vp.store.getById(token.id);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(token.id, ORIGIN_CENTRE),
      ctx
    );

    expect(result).toBe(false);
    expect(vp.store.getVersion(token.id)).toBe(versionBefore);
    expect(vp.store.getById(token.id)).toBe(elBefore);
    expect(logMovement).not.toHaveBeenCalled();

    vp.destroy();
    container.remove();
  });

  it('missing anchorKey or a single-waypoint emission returns false', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
    };

    expect(
      applyMovementCommit(commitEmission(undefined, DESTINATION), ctx)
    ).toBe(false);

    const singleWaypoint = {
      ...commitEmission(token.id, DESTINATION),
      waypoints: [ORIGIN_CENTRE],
    } as unknown as PathEmission;
    expect(applyMovementCommit(singleWaypoint, ctx)).toBe(false);

    expect(vp.store.getById(token.id)?.position).toEqual({ x: 80, y: 80 });

    vp.destroy();
    container.remove();
  });

  it('logs the LIVE anchor centre as `from`, not the stale emission.waypoints[0], when the token moved after the emission was built', () => {
    // Discriminating case (Task 6 review): build the emission anchored at
    // the token's ORIGINAL centre, then move the token (e.g. another client's
    // concurrent edit) BEFORE the commit is applied. `from` must reflect
    // where the anchor actually is at commit time, not the path's own
    // (now-stale) first waypoint.
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const emission = commitEmission(token.id, DESTINATION);
    // Move the token after the emission was built but before it commits —
    // its live centre is now (300,300), not the emission's stale (100,100)
    // waypoints[0].
    vp.store.update(token.id, { position: { x: 280, y: 280 } });
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(emission, ctx);

    expect(result).toBe(true);
    expect(logMovement).toHaveBeenCalledTimes(1);
    expect(logMovement).toHaveBeenCalledWith(
      expect.objectContaining({ from: { x: 300, y: 300 } })
    );
    expect(logMovement).not.toHaveBeenCalledWith(
      expect.objectContaining({ from: ORIGIN_CENTRE })
    );

    vp.destroy();
    container.remove();
  });

  it('player commits a move of their own token', () => {
    const { vp, container } = makeViewport();
    const ownToken = {
      ...createShape({
        position: { x: 80, y: 80 },
        size: { w: 40, h: 40 },
        shape: 'ellipse',
        strokeColor: '#000',
        strokeWidth: 1,
        fillColor: '#2980b9',
      }),
      zIndex: 1000,
      tokenKind: PLAYER_TOKEN_KIND,
      characterId: 'c-9',
    };
    vp.store.add(ownToken);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'player',
      characterId: 'c-9',
      resolveMovement: () => ({ name: 'Hero', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(ownToken.id, DESTINATION),
      ctx
    );

    expect(result).toBe(true);
    expect(vp.store.getById(ownToken.id)?.position).toEqual({
      x: 240,
      y: 160,
    });
    expect(logMovement).toHaveBeenCalledTimes(1);
    expect(logMovement).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'c-9' })
    );

    vp.destroy();
    container.remove();
  });

  it("logs the resolution's canonical encounter-entity id, not the characterId, for a player token moved by the DM", () => {
    // A DM moving a player token: `identity.key` is the token's
    // characterId, but the combat log must record the canonical
    // encounter-entity id (the entity's `playerCharacterId` matches the
    // token's characterId, but its own `id` is different).
    const { vp, container } = makeViewport();
    const ownToken = {
      ...createShape({
        position: { x: 80, y: 80 },
        size: { w: 40, h: 40 },
        shape: 'ellipse',
        strokeColor: '#000',
        strokeWidth: 1,
        fillColor: '#2980b9',
      }),
      zIndex: 1000,
      tokenKind: PLAYER_TOKEN_KIND,
      characterId: 'c-9',
    };
    vp.store.add(ownToken);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'dm',
      resolveMovement: () => ({
        name: 'Aria',
        walkFeet: 30,
        entityId: 'enc-entity-42',
      }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(ownToken.id, DESTINATION),
      ctx
    );

    expect(result).toBe(true);
    expect(logMovement).toHaveBeenCalledTimes(1);
    expect(logMovement).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'enc-entity-42' })
    );
    expect(logMovement).not.toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'c-9' })
    );

    vp.destroy();
    container.remove();
  });

  it('unrelated identity check: a stamped player token is unreachable when tokenKind mismatches', () => {
    // Guards the identity re-resolution branch: PLAYER_TOKEN_KIND import is
    // exercised so a future rename of the constant is caught here too.
    const { vp, container } = makeViewport();
    const playerToken = {
      ...createShape({
        position: { x: 80, y: 80 },
        size: { w: 40, h: 40 },
        shape: 'ellipse',
        strokeColor: '#000',
        strokeWidth: 1,
        fillColor: '#2980b9',
      }),
      zIndex: 1000,
      tokenKind: PLAYER_TOKEN_KIND,
      characterId: 'c-9',
    };
    vp.store.add(playerToken);
    const logMovement = vi.fn();
    const ctx: MovementCommitContext = {
      viewport: vp,
      role: 'player',
      characterId: 'c-not-9',
      resolveMovement: () => ({ name: 'Hero', walkFeet: 30 }),
      logMovement,
    };

    const result = applyMovementCommit(
      commitEmission(playerToken.id, DESTINATION),
      ctx
    );

    expect(result).toBe(false);
    expect(logMovement).not.toHaveBeenCalled();

    vp.destroy();
    container.remove();
  });
});
