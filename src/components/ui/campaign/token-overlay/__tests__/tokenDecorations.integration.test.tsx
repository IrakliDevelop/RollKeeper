import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import { Viewport, ElementRectTracker, createShape } from '@fieldnotes/core';
import { ViewportContext, useCamera } from '@fieldnotes/react';

import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';
import { TokenDecorationLayer } from '@/components/ui/campaign/token-overlay';
import { useDecoratedTokenRects } from '@/components/ui/campaign/token-overlay/TokenDecorationLayer.hooks';
import * as hpColorModule from '@/utils/hpColor';

import type { CanvasElement, ElementStore } from '@fieldnotes/core';
import type { TokenDecoration } from '@/components/ui/campaign/token-overlay';

// No @fieldnotes/core or @fieldnotes/react mocking anywhere in this file: a
// real Viewport, a real LayerManager, and the real published hooks run end
// to end. This is also the only suite that can exercise layer-visibility
// wiring honestly: TokenDecorationLayer.test.tsx mocks @fieldnotes/react at
// module scope, so a useLayers stub there could only assert the mock, never
// the real LayerManager's refusal-to-hide-the-active-layer semantics.

/**
 * jsdom has no canvas 2D context: stub `getContext` on any canvas the
 * Viewport creates so construction and its render loop don't throw. Copied
 * verbatim from `location-map/__tests__/selectionEvents.integration.test.tsx`
 * — stub the browser API, never an @fieldnotes module.
 */
function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        // The SDK's Background renderer destructures `ctx.canvas.{width,height}`
        // on every paint. This flushes real rAF frames (unlike
        // selectionEvents.integration.test.tsx, which only uses synchronous
        // act()), so the SDK's own continuous render loop actually ticks here
        // and needs this back-reference — real CanvasRenderingContext2D
        // objects have it too.
        canvas,
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
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
        globalCompositeOperation: 'source-over',
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

/**
 * Flushes one animation frame inside `act`. Every rect-tracking update in
 * this pipeline (the mount effect's setMatch, a store mutation, a forced
 * rescan) lands on a scheduled rAF frame rather than synchronously — see
 * `ElementRectTracker.schedule` in `@fieldnotes/core`. Sampling a spy count
 * before this has run either fails a correct implementation (an unrelated
 * pending frame inflates the baseline) or lets two frames coalesce, which
 * quietly destroys the discrimination these tests exist for.
 */
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
  });
}

function addCombatantToken(
  store: ElementStore,
  opts: {
    entityId: string;
    layerId: string;
    position?: { x: number; y: number };
    size?: { w: number; h: number };
  }
): CanvasElement {
  const shape = createShape({
    position: opts.position ?? { x: 100, y: 200 },
    size: opts.size ?? { w: 40, h: 40 },
    layerId: opts.layerId,
  });
  const token = {
    ...shape,
    entityId: opts.entityId,
    tokenKind: COMBATANT_TOKEN_KIND,
  } as unknown as CanvasElement;
  store.add(token);
  return token;
}

function decorationsFor(
  key: string,
  overrides: Partial<TokenDecoration> = {}
): Map<string, TokenDecoration> {
  return new Map([[key, { name: 'Ogre', ...overrides }]]);
}

describe('token decorations against the real SDK pipeline', () => {
  let container: HTMLDivElement | null = null;
  let vp: Viewport | null = null;

  afterEach(() => {
    cleanup();
    vp?.destroy();
    container?.remove();
    vp = null;
    container = null;
    vi.restoreAllMocks();
  });

  function mountViewport(): Viewport {
    stubCanvas();
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(container, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    document.body.appendChild(container);
    vp = new Viewport(container);
    return vp;
  }

  it('follows a remote sync-driven token move', async () => {
    const viewport = mountViewport();
    const layerId = viewport.layerManager.activeLayerId;
    const token = addCombatantToken(viewport.store, {
      entityId: 'ent-1',
      layerId,
      position: { x: 100, y: 200 },
    });

    // Stable across re-renders on purpose (declared once, not inline in the
    // component) — an identity that changed every render would itself force
    // rescans, muddying what this test is checking.
    const alwaysVisible = () => true;
    function Probe() {
      const rects = useDecoratedTokenRects(alwaysVisible);
      const rect = rects.find(r => r.key === 'ent-1');
      return (
        <span data-testid="pos">{rect ? `${rect.x},${rect.y}` : 'none'}</span>
      );
    }

    render(
      <ViewportContext.Provider value={viewport}>
        <Probe />
      </ViewportContext.Provider>
    );
    await flushFrame();
    expect(screen.getByTestId('pos').textContent).toBe('100,200');

    // Emulates the sync client's own remote-apply seam rather than standing
    // in for it. Reading @fieldnotes/sync's ManagedSyncConnection.applyOp
    // (node_modules/@fieldnotes/sync/dist/index.js, ~line 545) shows an
    // incoming upsert for an already-known element applies as
    // `this.store.update(el.id, el, { origin: REMOTE_ORIGIN })`, where
    // `REMOTE_ORIGIN === 'remote'`. Driving `viewport.store.update` with the
    // same call shape here IS that seam, confirmed by reading the SDK's own
    // application code rather than assumed.
    await act(async () => {
      viewport.store.update(
        token.id,
        { position: { x: 260, y: 340 } },
        { origin: 'remote' }
      );
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    });

    expect(screen.getByTestId('pos').textContent).toBe('260,340');
  });

  it('does no tracker work when the camera pans', async () => {
    const viewport = mountViewport();
    const layerId = viewport.layerManager.activeLayerId;
    addCombatantToken(viewport.store, { entityId: 'ent-1', layerId });

    // The injection point is the `isLayerVisible` argument, which the
    // matcher calls once per element per scan. Spying on it measures real
    // production scanning — a `vi.fn(decoratedTokenKey(...))` wrapper would
    // be inert here, because nothing lets a test substitute the matcher
    // useDecoratedTokenRects builds internally.
    const visibilitySpy = vi.fn(() => true);
    function Probe() {
      useCamera(); // mirrors TokenDecorationLayer
      useDecoratedTokenRects(visibilitySpy);
      return null;
    }
    render(
      <ViewportContext.Provider value={viewport}>
        <Probe />
      </ViewportContext.Provider>
    );

    // Flush mount work BEFORE the baseline. useElementRects' mount effect
    // calls setMatch, which schedules a reconciliation frame even with a
    // memoized matcher. Sampling the baseline while that frame is still
    // pending either fails a correct implementation (the count grows
    // afterwards for a reason unrelated to the camera) or lets the two
    // frames coalesce, which quietly destroys the discrimination this test
    // exists for.
    await flushFrame();

    // Note what this must NOT assert naively: the layer calls useCamera(),
    // so it re-renders on every camera event BY DESIGN. "Zero renders
    // anywhere" would be false by construction. The claim is that no
    // rescan happens.
    const before = visibilitySpy.mock.calls.length;
    expect(before).toBeGreaterThan(0); // the scan really ran at least once

    await act(async () => {
      viewport.camera.moveTo(120, 90);
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    });

    expect(visibilitySpy.mock.calls.length).toBe(before);
  });

  it('does not re-render individual decorations when the camera pans', async () => {
    const viewport = mountViewport();
    const layerId = viewport.layerManager.activeLayerId;
    addCombatantToken(viewport.store, { entityId: 'ent-1', layerId });

    // Spy on a real render-time dependency of DecorationItem rather than
    // replacing the component: a DecorationItem test double would make the
    // "remove memo" mutation inert, since the double is not the thing
    // memoized.
    const hpColor = vi.spyOn(hpColorModule, 'getHpTierBarColor');
    // Bar-kind HP puts getHpTierBarColor on the render path. Built ONCE,
    // outside render — rebuilding the decorations map per render would
    // defeat memo and fail this test for an unrelated reason.
    const stableDecorations = decorationsFor('ent-1', {
      hp: { kind: 'bar', percent: 50, tier: 'mid' },
    });

    render(
      <ViewportContext.Provider value={viewport}>
        <TokenDecorationLayer decorations={stableDecorations} mode="full" />
      </ViewportContext.Provider>
    );

    // Same sequencing rule as above: flush mount work first, or the hook's
    // initial setMatch frame lands inside the measurement window.
    await flushFrame();

    const before = hpColor.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    await act(async () => {
      viewport.camera.moveTo(120, 90);
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    });

    expect(hpColor.mock.calls.length).toBe(before);
    hpColor.mockRestore();
  });

  it('re-points a decoration when a token entityId changes with no movement', async () => {
    const viewport = mountViewport();
    const layerId = viewport.layerManager.activeLayerId;
    const token = addCombatantToken(viewport.store, {
      entityId: 'ent-1',
      layerId,
    });

    const decorations = new Map<string, TokenDecoration>([
      ['ent-1', { name: 'Ogre' }],
      ['ent-2', { name: 'Goblin' }],
    ]);

    render(
      <ViewportContext.Provider value={viewport}>
        <TokenDecorationLayer decorations={decorations} mode="full" />
      </ViewportContext.Provider>
    );
    await flushFrame();

    expect(screen.getByTestId('token-decoration-ent-1')).toBeTruthy();
    expect(screen.queryByTestId('token-decoration-ent-2')).toBeNull();

    await act(async () => {
      // Repo-established cast idiom for extra token fields not on
      // CanvasElement's base type (see TokenDecorationLayer.test.tsx's
      // `tokenEl` helper).
      viewport.store.update(token.id, {
        entityId: 'ent-2',
      } as unknown as Partial<CanvasElement>);
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    });

    // A geometry-only tracker would miss this: position/size/rotation never
    // changed, only the matched key did.
    expect(screen.queryByTestId('token-decoration-ent-1')).toBeNull();
    expect(screen.getByTestId('token-decoration-ent-2')).toBeTruthy();
  });

  it('renders nothing for a token whose decoration is absent', async () => {
    const viewport = mountViewport();
    const layerId = viewport.layerManager.activeLayerId;
    addCombatantToken(viewport.store, { entityId: 'ent-1', layerId });

    render(
      <ViewportContext.Provider value={viewport}>
        <TokenDecorationLayer decorations={new Map()} mode="full" />
      </ViewportContext.Provider>
    );
    await flushFrame();

    expect(screen.queryByTestId('token-decoration-ent-1')).toBeNull();
  });

  it('drops decorations when the token layer is hidden, with no store mutation', async () => {
    const viewport = mountViewport();
    // Fixture note: the token sits on a NEW, non-active layer. LayerManager
    // refuses to hide the active layer when no fallback exists
    // (layer-manager.ts setLayerVisible), so hiding the active layer here
    // would silently no-op and this test would pass vacuously.
    const tokenLayer = viewport.layerManager.createLayer('Tokens');
    expect(tokenLayer.id).not.toBe(viewport.layerManager.activeLayerId);
    addCombatantToken(viewport.store, {
      entityId: 'ent-1',
      layerId: tokenLayer.id,
    });

    const stableDecorations = decorationsFor('ent-1');
    render(
      <ViewportContext.Provider value={viewport}>
        <TokenDecorationLayer decorations={stableDecorations} mode="full" />
      </ViewportContext.Provider>
    );
    await flushFrame();
    expect(screen.getByTestId('token-decoration-ent-1')).toBeTruthy();

    await act(async () => {
      expect(viewport.layerManager.setLayerVisible(tokenLayer.id, false)).toBe(
        true
      );
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    });

    expect(screen.queryByTestId('token-decoration-ent-1')).toBeNull();
  });

  it('does not re-run setMatch when the camera pans (real layer component)', async () => {
    const viewport = mountViewport();
    const layerId = viewport.layerManager.activeLayerId;
    addCombatantToken(viewport.store, { entityId: 'ent-1', layerId });

    // Case 1 measures scanning through a Probe that calls the hook
    // directly, so it cannot see index.tsx. THIS case renders the real
    // TokenDecorationLayer, making it the only test where the host's
    // useCallback and B2's useMemo are both on the path. Spy on the
    // prototype so no production seam is needed.
    const setMatchSpy = vi.spyOn(ElementRectTracker.prototype, 'setMatch');
    const stableDecorations = decorationsFor('ent-1');

    render(
      <ViewportContext.Provider value={viewport}>
        <TokenDecorationLayer decorations={stableDecorations} mode="full" />
      </ViewportContext.Provider>
    );

    // Flush mount work first: the hook's mount effect legitimately calls
    // setMatch once. Measuring before this lands would attribute that call
    // to the pan.
    await flushFrame();

    // Seam check: if this were 0, the spy target would be a different
    // module instance of @fieldnotes/core than the one useElementRects
    // actually imports, and every assertion below would pass vacuously.
    // Verified independently: only one @fieldnotes/core copy exists under
    // node_modules (no nested copy under @fieldnotes/react/node_modules),
    // and require.resolve('@fieldnotes/core') from the repo root resolves
    // to that single copy — so react's `import { ElementRectTracker } from
    // "@fieldnotes/core"` and this test's import are the same binding.
    const before = setMatchSpy.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    await act(async () => {
      viewport.camera.moveTo(120, 90);
      await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    });

    // A pan re-renders the layer (it calls useCamera by design). It must
    // not produce a new matcher identity, which is what would trigger
    // setMatch.
    expect(setMatchSpy.mock.calls.length).toBe(before);
    setMatchSpy.mockRestore();
  });
});
