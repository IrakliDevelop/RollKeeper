import type {
  Bounds,
  CameraView,
  ElementStore,
  Viewport,
} from '@fieldnotes/core';
import type { FogManager, FogPlugin, GridInfo } from '@fieldnotes/vtt';

import type {
  BattleMapConnection,
  BattleMapConnectionStatus,
  BattleMapTokenDenial,
  ManagedConnectionOptions,
} from '@/lib/battlemapSync';
import {
  fogAppearanceReadUrl,
  sideChannelReadInit,
  type SideChannelCredential,
} from '../sideChannelRequests';
import {
  displayAckRequest,
  displayDescriptorRequest,
  type DisplayAck,
  type DisplayCredential,
  type DisplayDescriptor,
} from './displayRequests';
import {
  DISPLAY_EXPIRED,
  DISPLAY_IN_USE,
  DISPLAY_NOT_CONFIGURED,
  DISPLAY_NOTHING_SHOWN,
  DISPLAY_WAITING,
} from './displayMessages';
import {
  sameEnvironment,
  type EnvironmentSnapshot,
} from './calibration/environment';
import {
  DEFAULT_ZOOM_LIMITS,
  ZOOM_TOLERANCE,
  applyCalibratedZoom,
  centreBoundsAt,
  sceneGeometry,
  setZoomLimits,
  type SceneGeometry,
} from './calibration/geometry';
import {
  deriveCalibrationReport,
  preferCalibrated,
  type CalibrationPageState,
  type CalibrationReport,
  type CalibrationSession,
  type CalibrationStore,
} from './calibration/session';
import { DEFAULT_CSS_PX_PER_SQUARE } from './calibration/settings';

/** Injected platform pieces (real defaults live in `tableDisplayDeps.ts`). */
export interface TableDisplayDeps {
  createConnection: (options: ManagedConnectionOptions) => BattleMapConnection;
  /** Grid controller, display fog view and canonical layer bands. */
  prepareViewport: (viewport: Viewport, fog: FogManager) => void;
  /** Fog appearance companion for the attached scene; returns its disposer. */
  startFogAppearance: (
    viewport: Viewport,
    url: string,
    init: RequestInit,
    initial: { fogAppearance?: unknown; updatedAt?: unknown } | null
  ) => () => void;
  captureView: (viewport: Viewport) => CameraView;
  applyView: (viewport: Viewport, view: CameraView) => void;
  fitView: (viewport: Viewport) => void;
  createFogPlugin: () => FogPlugin;
  /** Layer sync applier for this viewport (canonical display stance). */
  applyLayer?: (
    viewport: Viewport
  ) => NonNullable<ManagedConnectionOptions['layers']>['applyLayer'];
  /**
   * PR07 M2: the private store the connection syncs into, mirrored into the
   * viewport store minus physical minis. Absent → the viewport store.
   */
  projectStore?: (viewport: Viewport) => {
    store: ElementStore;
    dispose: () => void;
  };
  /** PR07 P4: the scene grid as the viewport holds it (null: none). */
  readGrid?: (viewport: Viewport) => GridInfo | null;
  /** PR07 P5: grid change notifications for this viewport. */
  onGridChange?: (viewport: Viewport, listener: () => void) => () => void;
  /** PR07 P8: bounds of the visible content (arrival / Centre map). */
  contentBounds?: (viewport: Viewport) => Bounds | null;
}

export type DisplayCredentialDenial = 'expired' | 'in-use';

/** PR07: the scale state this page reports (and the shell renders). */
export interface DisplayCalibrationView {
  report: CalibrationReport;
  /** Why calibrated minis are unavailable on the shown scene, if they are. */
  unsupported: 'grid' | 'range' | null;
}

export interface TableDisplayView {
  /** Null = uncovered (a rendered, acknowledged-ready scene). */
  cover: string | null;
  /** The canvas to mount for the current attach (keyed per attach). */
  canvas: { key: number; fogPlugin: FogPlugin } | null;
  /** Uncovered and showing a scene: the Fit map affordance may show. */
  showing: boolean;
  calibration: DisplayCalibrationView;
}

export const UNCALIBRATED_VIEW: DisplayCalibrationView = {
  report: 'uncalibrated',
  unsupported: null,
};

export interface TableDisplayControllerOptions {
  code: string;
  credential: DisplayCredential;
  relayUrl: string | undefined;
  deps: TableDisplayDeps;
  onView: (view: TableDisplayView) => void;
  onCredentialDenied: (denial: DisplayCredentialDenial) => void;
  fetcher?: typeof fetch;
  /**
   * Map-pinned display (E8): only a presented scene adopted from this map
   * is shown; anything else is the "nothing shown on this map" cover, and
   * no ACK claims a scene this page does not show.
   */
  mapPinned?: { mapId: string };
  /**
   * PR07: the per-page calibration store and a reader of the current
   * physical-setup snapshot (re-compared right before a calibrated camera
   * is applied). Absent → PR05 behaviour and six-key ACKs.
   */
  calibration?: {
    store: CalibrationStore;
    readEnvironment: () => EnvironmentSnapshot;
  };
}

const POLL_MS = 2_000;
const REQUEST_TIMEOUT_MS = 5_000;
const READINESS_TIMEOUT_MS = 15_000;
const HEARTBEAT_MS = 5_000;
const RETRY_MAX_MS = 15_000;
const CREDENTIAL_ERRORS: Record<string, DisplayCredentialDenial> = {
  'Display link expired': 'expired',
  'Display link is in use on another screen': 'in-use',
};

interface Target {
  key: string;
  descriptor: DisplayDescriptor;
  /** The scene this page shows (map-pinned: only this map's scene). */
  scene: DisplayDescriptor['scene'];
  /** Nothing visible anywhere: a blank ACK is truthful. */
  audienceEmpty: boolean;
}

interface Attach {
  gen: number;
  scene: NonNullable<DisplayDescriptor['scene']>;
  fogPlugin: FogPlugin;
  viewport: Viewport | null;
  connection: BattleMapConnection | null;
  status: BattleMapConnectionStatus;
  fogApplied: boolean;
  /** Whether the checkpoint carried a fog definition (recorded, E10). */
  fogDefinition: boolean | null;
  stage: 'idle' | 'awaitFrame' | 'awaitSecondFrame' | 'shown';
  cameraApplied: boolean;
  uncovered: boolean;
  metadata: { fogAppearance?: unknown; updatedAt?: unknown } | null;
  disposers: Array<() => void>;
  /** PR07 P8: the calibrated camera applied to this viewport, if any. */
  calibrated: {
    zoom: number;
    cellSize: number;
    session: CalibrationSession;
  } | null;
  /** PR07 P4: the one-tick wait for a late grid (never longer). */
  gridWait: 'none' | 'pending' | 'done';
  calibratedDisposers: Array<() => void>;
}

interface CalibratedOrigin {
  x: number;
  y: number;
  zoom: number;
}

type CalibratedApply = 'applied' | 'skipped' | 'failed';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Strict parse of the E6 descriptor body. */
export function parseDisplayDescriptor(
  value: unknown
): DisplayDescriptor | null {
  const body = record(value);
  const presentation = record(body?.presentation);
  const scene = body?.scene === null ? null : record(body?.scene);
  if (
    !body ||
    !presentation ||
    !Number.isSafeInteger(body.displayGeneration) ||
    typeof body.epoch !== 'string' ||
    !Number.isSafeInteger(presentation.revision) ||
    typeof presentation.blanked !== 'boolean' ||
    (presentation.sceneId !== null && typeof presentation.sceneId !== 'string')
  )
    return null;
  if (body.scene !== null) {
    if (
      !scene ||
      typeof scene.sceneId !== 'string' ||
      scene.sceneId !== presentation.sceneId ||
      typeof scene.sourceMapId !== 'string' ||
      typeof scene.label !== 'string'
    )
      return null;
  } else if (presentation.sceneId !== null) return null;
  return value as DisplayDescriptor;
}

/** A CameraView core `applyCameraView` accepts (finite, positive size). */
export function isUsableView(view: unknown): view is CameraView {
  if (!view || typeof view !== 'object') return false;
  const { x, y, w, h } = view as Record<string, unknown>;
  return (
    typeof x === 'number' &&
    typeof y === 'number' &&
    typeof w === 'number' &&
    typeof h === 'number' &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0
  );
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const onAbort = () => reject(new Error('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/**
 * PR05 E9–E11: the campaign display. Polls the descriptor serially (one
 * request in flight, 2 s after the previous settles, 5 s abort), follows the
 * visible target with a cover-first attach per scene (fresh canvas, store
 * and fog plugin each time), uncovers only after E10 readiness and sends
 * tuple-bound ACKs. Every async callback checks its attach generation.
 */
export class TableDisplayController {
  private readonly options: TableDisplayControllerOptions;
  private readonly fetcher: typeof fetch;
  private stopped = false;
  private denied = false;
  private target: Target | null = null;
  private attach: Attach | null = null;
  private attachGen = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: AbortController | null = null;
  private requestSeq = 0;
  private repoll = false;
  private readinessTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1_000;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private readonly deferred = new Set<ReturnType<typeof setTimeout>>();
  private readonly views = new Map<string, CameraView>();
  /** PR07 P8: per-scene calibrated translation (separate from E11 views). */
  private readonly origins = new Map<string, CalibratedOrigin>();
  private unsubscribeCalibration: (() => void) | null = null;
  private view: TableDisplayView = {
    cover: DISPLAY_WAITING,
    canvas: null,
    showing: false,
    calibration: UNCALIBRATED_VIEW,
  };

  constructor(options: TableDisplayControllerOptions) {
    this.options = options;
    this.fetcher = options.fetcher ?? ((...args) => fetch(...args));
  }

  start(): void {
    this.unsubscribeCalibration =
      this.options.calibration?.store.subscribe(() =>
        this.onCalibrationChange()
      ) ?? null;
    this.emit({});
    void this.poll();
  }

  stop(): void {
    this.unsubscribeCalibration?.();
    this.unsubscribeCalibration = null;
    this.stopped = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.inFlight?.abort();
    this.inFlight = null;
    this.teardownAttach();
    this.clearRetry();
    this.stopHeartbeat();
    for (const timer of this.deferred) clearTimeout(timer);
    this.deferred.clear();
  }

  /**
   * The explicit "Fit map" move: fits and remembers the view. Verified
   * calibrated: "Centre map" (pan only, zoom kept). Frozen: no camera move.
   */
  fitMap(): void {
    const attach = this.attach;
    if (!attach?.viewport || !attach.uncovered) return;
    const report = this.calibrationView().report;
    if (report === 'verify-required') return;
    if (attach.calibrated && report === 'verified') {
      this.centreMap(attach);
      return;
    }
    try {
      this.options.deps.fitView(attach.viewport);
    } catch {
      return;
    }
    this.rememberView(attach.scene.sceneId, attach.viewport);
  }

  /**
   * Acceptance A1: remembers the current view only when it is usable
   * (core `applyCameraView` throws on a non-positive view, which a 0×0 or
   * destroyed canvas reports).
   */
  private rememberView(sceneId: string, viewport: Viewport): void {
    try {
      const view = this.options.deps.captureView(viewport);
      if (isUsableView(view)) this.views.set(sceneId, view);
    } catch {
      // A destroyed viewport keeps the previously remembered view.
    }
  }

  /** `FieldNotesCanvas` `onReady` for the canvas keyed `key`. */
  onViewportReady(key: number, viewport: Viewport): void {
    const attach = this.attach;
    if (this.stopped || !attach || attach.gen !== key) return;
    if (attach.viewport === viewport) return;
    if (attach.viewport) {
      // Acceptance A1: the canvas remounted under the same key (React
      // StrictMode replays FieldNotesCanvas's mount effect: the first
      // viewport is destroyed). Release everything bound to the old
      // viewport and bind this attach to the live one.
      for (const dispose of attach.disposers.splice(0)) {
        try {
          dispose();
        } catch {
          // Keep releasing the rest.
        }
      }
      this.releaseCalibrated(attach);
      attach.calibrated = null;
      attach.connection?.stop();
      attach.connection = null;
      attach.status = 'connecting';
      attach.fogApplied = false;
      attach.fogDefinition = null;
      attach.stage = 'idle';
      attach.cameraApplied = false;
      attach.gridWait = 'none';
      attach.uncovered = false;
      attach.metadata = null;
      this.stopHeartbeat();
      this.emit({ cover: DISPLAY_WAITING, showing: false });
    }
    const { deps, code, credential } = this.options;
    attach.viewport = viewport;
    const fog = attach.fogPlugin.manager;
    deps.prepareViewport(viewport, fog);
    attach.disposers.push(
      fog.on('change', event => {
        if (event.origin !== 'remote') return;
        if (event.kind !== 'definition' && event.kind !== 'disable') return;
        attach.fogApplied = true;
        attach.fogDefinition = event.kind === 'definition';
        this.defer(() => this.checkReadiness(key));
      })
    );
    attach.disposers.push(
      viewport.renderHooks.viewport.register({
        afterAll: () => this.onFrame(key),
      })
    );
    if (deps.onGridChange)
      attach.disposers.push(
        deps.onGridChange(viewport, () => this.onGridChanged(key))
      );
    // PR07 M2: the connection syncs into a private store; the viewport
    // store is its table-output projection (physical minis omitted).
    const projection = deps.projectStore?.(viewport) ?? null;
    if (projection) attach.disposers.push(projection.dispose);
    const relayUrl = this.options.relayUrl;
    if (!relayUrl) {
      this.emit({ cover: DISPLAY_NOT_CONFIGURED });
      return;
    }
    const sideChannel: SideChannelCredential = {
      role: 'display',
      capability: credential.capability,
      nonce: credential.nonce,
    };
    let fogPollStarted = false;
    const connection = deps.createConnection({
      relayUrl,
      campaignCode: code,
      battleMapId: attach.scene.sourceMapId,
      store: projection?.store ?? viewport.store,
      clientId: `display-${code}`,
      tokenRequest: {
        role: 'display',
        battleMapId: attach.scene.sourceMapId,
        sceneId: attach.scene.sceneId,
        displayCapability: credential.capability,
        displaySession: credential.nonce,
      },
      fog: { manager: fog },
      layers: deps.applyLayer
        ? { applyLayer: deps.applyLayer(viewport) }
        : undefined,
      onStatus: status => this.onStatus(key, status),
      onTokenDenied: denial => this.onTokenDenied(key, denial),
      onTokenMetadata: meta => {
        if (this.attach?.gen !== key) return;
        attach.metadata = {
          fogAppearance: meta.fogAppearance,
          updatedAt: meta.fogAppearanceUpdatedAt,
        };
        if (fogPollStarted) return;
        fogPollStarted = true;
        // C5-2: initial value from the mint, then a header-credential poll
        // for the attached scene, disposed with this attach.
        attach.disposers.push(
          deps.startFogAppearance(
            viewport,
            fogAppearanceReadUrl(
              'battlemap',
              code,
              attach.scene.sceneId,
              sideChannel
            ),
            sideChannelReadInit(sideChannel),
            attach.metadata
          )
        );
      },
    });
    attach.connection = connection;
  }

  // ---- descriptor polling (E9) -------------------------------------------

  private schedulePoll(delay: number): void {
    if (this.stopped || this.denied) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.poll();
    }, delay);
  }

  /** E10: a 409 from the ACK re-polls at once (after any request in flight). */
  private requestRepoll(): void {
    if (this.inFlight) {
      this.repoll = true;
      return;
    }
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    void this.poll();
  }

  private async poll(): Promise<void> {
    if (this.stopped || this.denied || this.inFlight) return;
    const seq = ++this.requestSeq;
    const abort = new AbortController();
    this.inFlight = abort;
    const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    try {
      const { url, init } = displayDescriptorRequest(
        this.options.code,
        this.options.credential
      );
      const response = await abortable(
        this.fetcher(url, { ...init, signal: abort.signal }),
        abort.signal
      );
      if (this.stopped || seq !== this.requestSeq) return;
      if (response.status === 403) {
        const body = record(await abortable(response.json(), abort.signal));
        if (!this.stopped && seq === this.requestSeq)
          this.checkCredentialError(body?.error);
        return;
      }
      if (!response.ok) return;
      const descriptor = parseDisplayDescriptor(
        await abortable(response.json(), abort.signal)
      );
      if (this.stopped || seq !== this.requestSeq || abort.signal.aborted)
        return;
      if (descriptor) this.applyDescriptor(descriptor);
    } catch {
      // Network failure, timeout or abort: stay as we are; retry next tick.
    } finally {
      clearTimeout(timeout);
      if (this.inFlight === abort) this.inFlight = null;
      const immediate = this.repoll;
      this.repoll = false;
      if (!this.stopped && !this.denied) {
        if (immediate) void this.poll();
        else this.schedulePoll(POLL_MS);
      }
    }
  }

  private applyDescriptor(descriptor: DisplayDescriptor): void {
    const previous = this.target?.descriptor;
    if (
      previous &&
      previous.epoch === descriptor.epoch &&
      descriptor.presentation.revision < previous.presentation.revision
    )
      return;
    const mapId = this.options.mapPinned?.mapId;
    const scene =
      descriptor.scene &&
      (mapId === undefined || descriptor.scene.sourceMapId === mapId)
        ? descriptor.scene
        : null;
    const audienceEmpty = descriptor.scene === null;
    const key = [
      descriptor.displayGeneration,
      descriptor.epoch,
      scene?.sceneId ?? '',
      scene?.sourceMapId ?? '',
      descriptor.presentation.blanked ? 'blank' : 'open',
      audienceEmpty ? 'empty' : 'elsewhere',
    ].join('|');
    const sameTarget = this.target?.key === key;
    const revisionChanged =
      previous?.presentation.revision !== descriptor.presentation.revision;
    this.target = { key, descriptor, scene, audienceEmpty };
    if (!sameTarget) {
      this.retryDelay = 1_000;
      this.clearRetry();
      this.retarget();
    } else if (revisionChanged) {
      // Same visible target: keep the attach, re-ACK the new tuple.
      if (!this.attach) {
        if (audienceEmpty) this.sendAck('blank');
      } else if (this.attach.stage === 'shown' && this.attach.status === 'live')
        this.sendAck('loaded');
    }
  }

  // ---- attach protocol (E9) ----------------------------------------------

  private retarget(): void {
    this.stopHeartbeat();
    this.teardownAttach();
    const target = this.target;
    if (!target) return;
    const scene = target.scene;
    if (!scene) {
      this.emit({
        cover: this.options.mapPinned ? DISPLAY_NOTHING_SHOWN : DISPLAY_WAITING,
        canvas: null,
        showing: false,
      });
      if (target.audienceEmpty) {
        this.sendAck('blank');
        this.startHeartbeat('blank');
      }
      return;
    }
    // Review 01 F5: without a relay there is nothing to attach or retry.
    if (!this.options.relayUrl) {
      this.emit({
        cover: DISPLAY_NOT_CONFIGURED,
        canvas: null,
        showing: false,
      });
      return;
    }
    const gen = ++this.attachGen;
    const fogPlugin = this.options.deps.createFogPlugin();
    this.attach = {
      gen,
      scene,
      fogPlugin,
      viewport: null,
      connection: null,
      status: 'connecting',
      fogApplied: false,
      fogDefinition: null,
      stage: 'idle',
      cameraApplied: false,
      uncovered: false,
      metadata: null,
      disposers: [],
      calibrated: null,
      gridWait: 'none',
      calibratedDisposers: [],
    };
    this.readinessTimer = setTimeout(() => {
      this.readinessTimer = null;
      if (this.attach?.gen === gen && !this.attach.uncovered)
        this.failAttach(gen);
    }, READINESS_TIMEOUT_MS);
    this.emit({
      cover: DISPLAY_WAITING,
      canvas: { key: gen, fogPlugin },
      showing: false,
    });
  }

  /** Cover first, then release everything the attach owns (once). */
  private teardownAttach(): void {
    const attach = this.attach;
    if (this.readinessTimer) clearTimeout(this.readinessTimer);
    this.readinessTimer = null;
    if (!attach) return;
    this.attach = null;
    this.emit({ cover: DISPLAY_WAITING, showing: false });
    if (attach.uncovered && attach.viewport) {
      // E11 views hold uncalibrated cameras only; calibrated ones are
      // remembered as origins (a cleared session must not restore C/U).
      if (!attach.calibrated)
        this.rememberView(attach.scene.sceneId, attach.viewport);
      this.rememberOrigin(attach);
    }
    this.releaseCalibrated(attach);
    for (const dispose of attach.disposers.splice(0)) {
      try {
        dispose();
      } catch {
        // Keep releasing the rest.
      }
    }
    attach.connection?.stop();
    attach.connection = null;
  }

  private failAttach(gen: number): void {
    if (this.attach?.gen !== gen || this.stopped) return;
    this.stopHeartbeat();
    this.teardownAttach();
    this.emit({ cover: DISPLAY_WAITING, canvas: null, showing: false });
    const delay = this.retryDelay;
    this.retryDelay = Math.min(delay * 2, RETRY_MAX_MS);
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped && !this.denied && this.target?.scene) this.retarget();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private onStatus(gen: number, status: BattleMapConnectionStatus): void {
    const attach = this.attach;
    if (!attach || attach.gen !== gen || this.stopped) return;
    attach.status = status;
    if (status === 'live') {
      this.defer(() => this.checkReadiness(gen));
      return;
    }
    // E9 (R4-F9): any non-live status covers an uncovered attach and stops
    // its heartbeat; it uncovers only after readiness is re-established.
    attach.stage = 'idle';
    if (attach.uncovered) {
      // Acceptance A2 (E11): remember an explicit local pan/zoom before
      // the view can be lost to a withdrawal and re-attach.
      if (attach.viewport) {
        if (!attach.calibrated)
          this.rememberView(attach.scene.sceneId, attach.viewport);
        this.rememberOrigin(attach);
      }
      attach.uncovered = false;
      this.stopHeartbeat();
      this.emit({ cover: DISPLAY_WAITING, showing: false });
    }
    if (
      status === 'denied' ||
      status === 'upgrade-required' ||
      status === 'stopped'
    )
      this.failAttach(gen);
    else if (!this.readinessTimer)
      this.readinessTimer = setTimeout(() => {
        this.readinessTimer = null;
        if (this.attach?.gen === gen && !this.attach.uncovered)
          this.failAttach(gen);
      }, READINESS_TIMEOUT_MS);
  }

  private onTokenDenied(gen: number, denial: BattleMapTokenDenial): void {
    if (this.attach?.gen !== gen || this.stopped) return;
    if (denial.status === 403 && this.checkCredentialError(denial.error))
      return;
    if (denial.status === 403 || denial.status === 409) this.failAttach(gen);
  }

  // ---- readiness (E10) and camera (E11) -----------------------------------

  private defer(run: () => void): void {
    const timer = setTimeout(() => {
      this.deferred.delete(timer);
      if (!this.stopped) run();
    }, 0);
    this.deferred.add(timer);
  }

  /**
   * Requests the confirming frame from outside the render loop and keeps
   * asking (1 s) until it arrives or the attach moves on; a hidden tab
   * renders nothing and therefore never ACKs (truthful).
   */
  private requestConfirmingFrame(gen: number): void {
    this.defer(() => {
      const attach = this.attach;
      if (!attach || attach.gen !== gen || attach.stage !== 'awaitSecondFrame')
        return;
      attach.viewport?.requestRender();
      const timer = setTimeout(() => {
        this.deferred.delete(timer);
        if (!this.stopped) this.requestConfirmingFrame(gen);
      }, 1_000);
      this.deferred.add(timer);
    });
  }

  private checkReadiness(gen: number): void {
    const attach = this.attach;
    if (
      !attach ||
      attach.gen !== gen ||
      attach.status !== 'live' ||
      !attach.fogApplied ||
      !attach.viewport ||
      attach.stage !== 'idle'
    )
      return;
    if (!attach.cameraApplied) {
      // PR07 P4: a grid may land one notification after `live`; wait one
      // tick for it when a calibrated camera is wanted (never longer).
      if (attach.gridWait === 'pending') return;
      if (
        attach.gridWait === 'none' &&
        this.wantsCalibrated() &&
        !this.readGrid(attach.viewport)
      ) {
        attach.gridWait = 'pending';
        this.defer(() => {
          if (this.attach !== attach) return;
          attach.gridWait = 'done';
          this.checkReadiness(gen);
        });
        return;
      }
      attach.cameraApplied = true;
      const sceneId = attach.scene.sceneId;
      const calibrated = this.applyCalibrated(attach, 'arrival');
      if (calibrated === 'failed') {
        this.origins.delete(sceneId);
        this.failAttach(gen);
        return;
      }
      if (calibrated === 'applied') {
        attach.stage = 'awaitFrame';
        attach.viewport.requestRender();
        this.refreshCalibration();
        return;
      }
      try {
        const remembered = this.views.get(sceneId);
        if (remembered && isUsableView(remembered))
          this.options.deps.applyView(attach.viewport, remembered);
        else {
          this.views.delete(sceneId);
          this.options.deps.fitView(attach.viewport);
          this.rememberView(sceneId, attach.viewport);
        }
      } catch {
        // Acceptance A1: a camera failure never uncovers and never sticks:
        // forget the view, stay covered and retry this attach (E9).
        this.views.delete(sceneId);
        this.failAttach(gen);
        return;
      }
    }
    attach.stage = 'awaitFrame';
    attach.viewport.requestRender();
    this.refreshCalibration();
  }

  private onFrame(gen: number): void {
    const attach = this.attach;
    if (!attach || attach.gen !== gen || this.stopped) return;
    if (attach.status !== 'live') {
      attach.stage = 'idle';
      return;
    }
    if (attach.stage === 'awaitFrame') {
      // A frame rendered the loaded state under the cover: uncover, then
      // wait for one more frame before asserting it to the server.
      attach.stage = 'awaitSecondFrame';
      attach.uncovered = true;
      if (this.readinessTimer) clearTimeout(this.readinessTimer);
      this.readinessTimer = null;
      this.retryDelay = 1_000;
      this.emit({ cover: null, showing: true });
      // Acceptance A3: this runs inside the frame's render(); the core
      // render loop clears a request made there, so ask after it returns.
      this.requestConfirmingFrame(gen);
    } else if (attach.stage === 'awaitSecondFrame') {
      attach.stage = 'shown';
      this.sendAck('loaded');
      this.startHeartbeat('loaded');
    }
  }

  // ---- ACK / heartbeat (E7, E10) -----------------------------------------

  private startHeartbeat(phase: DisplayAck['phase']): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (phase === 'blank' ? this.attach === null : this.isShown())
        this.sendAck(phase);
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private isShown(): boolean {
    const attach = this.attach;
    return (
      !!attach &&
      attach.stage === 'shown' &&
      attach.status === 'live' &&
      attach.uncovered
    );
  }

  private sendAck(phase: DisplayAck['phase']): void {
    const descriptor = this.target?.descriptor;
    if (!descriptor || this.stopped || this.denied) return;
    if (phase === 'loaded' && !this.isShown()) return;
    const ack: DisplayAck = {
      displayGeneration: descriptor.displayGeneration,
      epoch: descriptor.epoch,
      presentationRevision: descriptor.presentation.revision,
      sceneId: phase === 'loaded' ? (this.attach?.scene.sceneId ?? null) : null,
      blanked: descriptor.presentation.blanked,
      phase,
      ...(this.options.calibration
        ? { calibration: this.calibrationView().report }
        : {}),
    };
    const { url, init } = displayAckRequest(
      this.options.code,
      this.options.credential,
      ack
    );
    void this.fetcher(url, init)
      .then(async response => {
        if (this.stopped) return;
        if (response.status === 409) this.requestRepoll();
        else if (response.status === 403)
          this.checkCredentialError(
            record(await response.json().catch(() => null))?.error
          );
      })
      .catch(() => {});
  }

  // ---- credential denial (E8.4) -------------------------------------------

  private checkCredentialError(error: unknown): boolean {
    const denial =
      typeof error === 'string' ? CREDENTIAL_ERRORS[error] : undefined;
    if (!denial || this.denied) return !!denial;
    this.denied = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.stopHeartbeat();
    this.clearRetry();
    this.teardownAttach();
    this.emit({
      cover: denial === 'expired' ? DISPLAY_EXPIRED : DISPLAY_IN_USE,
      canvas: null,
      showing: false,
    });
    this.options.onCredentialDenied(denial);
    return true;
  }

  private emit(patch: Partial<TableDisplayView>): void {
    if (this.stopped) return;
    if (this.denied && patch.cover !== undefined && patch.cover !== null) {
      const credentialCover =
        patch.cover === DISPLAY_EXPIRED || patch.cover === DISPLAY_IN_USE;
      if (!credentialCover) return;
    }
    this.view = {
      ...this.view,
      ...patch,
      calibration: this.calibrationView(),
    };
    this.options.onView(this.view);
  }

  // ---- calibration (PR07 P1, P4, P5, P8, R3-1) ----------------------------

  private calibrationState(): CalibrationPageState | null {
    return this.options.calibration?.store.getState() ?? null;
  }

  private wantsCalibrated(): boolean {
    const state = this.calibrationState();
    return !!state && preferCalibrated(state) && !!state.session;
  }

  private readGrid(viewport: Viewport): GridInfo | null {
    try {
      return this.options.deps.readGrid?.(viewport) ?? null;
    } catch {
      return null;
    }
  }

  /** Geometry of the shown scene (null: none shown, or not preferred). */
  private liveGeometry(): SceneGeometry | null {
    const state = this.calibrationState();
    const attach = this.attach;
    if (!state || !preferCalibrated(state)) return null;
    if (!attach?.viewport || !attach.cameraApplied) return null;
    const cssPxPerSquare =
      state.session?.cssPxPerSquare ??
      state.settings?.cssPxPerSquare ??
      DEFAULT_CSS_PX_PER_SQUARE;
    return sceneGeometry(this.readGrid(attach.viewport), cssPxPerSquare);
  }

  private calibrationView(): DisplayCalibrationView {
    const state = this.calibrationState();
    if (!state) return UNCALIBRATED_VIEW;
    const geometry = this.liveGeometry();
    return {
      report: deriveCalibrationReport(state, geometry),
      unsupported:
        geometry && geometry.kind === 'unsupported' ? geometry.reason : null,
    };
  }

  /** Re-emits on a changed state and ACKs a changed report at once (P6). */
  private refreshCalibration(): void {
    if (!this.options.calibration || this.stopped) return;
    const next = this.calibrationView();
    const previous = this.view.calibration;
    if (
      next.report === previous.report &&
      next.unsupported === previous.unsupported
    )
      return;
    this.emit({});
    if (next.report === previous.report) return;
    if (this.isShown()) this.sendAck('loaded');
    else if (!this.attach && this.target?.audienceEmpty) this.sendAck('blank');
  }

  private onCalibrationChange(): void {
    if (this.stopped) return;
    const state = this.calibrationState();
    const attach = this.attach;
    if (state && attach?.viewport && attach.cameraApplied) {
      if (!preferCalibrated(state)) this.leaveCalibrated(attach);
      else if (
        state.session &&
        attach.calibrated?.session !== state.session &&
        this.applyCalibrated(attach, 'keep-centre') === 'applied'
      )
        attach.viewport.requestRender();
    }
    this.refreshCalibration();
  }

  /**
   * P5 / S5: a grid geometry change on the shown scene invalidates the
   * session; style-only changes are ignored. A change that makes an
   * unsupported scene supported also needs Confirm (never claim verified
   * over an uncalibrated camera).
   */
  private onGridChanged(gen: number): void {
    const attach = this.attach;
    if (!attach || attach.gen !== gen || this.stopped) return;
    if (!attach.viewport || !attach.cameraApplied) return;
    const state = this.calibrationState();
    if (!state) return;
    const session = state.session;
    if (session && preferCalibrated(state)) {
      const info = this.readGrid(attach.viewport);
      const applied = attach.calibrated;
      if (applied && applied.session === session) {
        if (
          !info ||
          info.gridType !== 'square' ||
          info.cellSize !== applied.cellSize
        ) {
          this.options.calibration?.store.invalidate();
          return;
        }
      } else if (
        sceneGeometry(info, session.cssPxPerSquare).kind === 'square'
      ) {
        this.options.calibration?.store.invalidate();
        return;
      }
    }
    this.refreshCalibration();
  }

  /**
   * P8: applies C/U to this attach's camera. `arrival` (the E11 covered
   * slot): remembered origin for an unchanged scale, else content centred.
   * `keep-centre` (Confirm on a placed camera): the world point at the
   * canvas centre stays there. R3-1: the environment snapshot is
   * re-compared first; a mismatch clears the session and applies nothing.
   */
  private applyCalibrated(
    attach: Attach,
    mode: 'arrival' | 'keep-centre'
  ): CalibratedApply {
    const calibration = this.options.calibration;
    const state = this.calibrationState();
    const viewport = attach.viewport;
    if (!calibration || !state || !viewport) return 'skipped';
    const session = state.session;
    if (!session || !preferCalibrated(state)) return 'skipped';
    const geometry = sceneGeometry(
      this.readGrid(viewport),
      session.cssPxPerSquare
    );
    if (geometry.kind !== 'square') return 'skipped';
    let environment: EnvironmentSnapshot | null = null;
    try {
      environment = calibration.readEnvironment();
    } catch {
      environment = null;
    }
    if (!environment || !sameEnvironment(environment, session.environment)) {
      calibration.store.invalidate();
      return 'skipped';
    }
    const size = viewport.getCanvasSize();
    if (!(size.w > 0 && size.h > 0)) return 'failed';
    const camera = viewport.camera;
    const centre = { x: size.w / 2, y: size.h / 2 };
    if (!applyCalibratedZoom(camera, geometry.zoom, centre)) {
      setZoomLimits(camera, DEFAULT_ZOOM_LIMITS);
      return 'skipped';
    }
    if (mode === 'arrival') {
      const origin = this.origins.get(attach.scene.sceneId);
      if (origin && origin.zoom === geometry.zoom)
        camera.moveTo(origin.x, origin.y);
      else {
        const bounds = this.contentBounds(viewport);
        if (bounds) centreBoundsAt(camera, bounds, size);
      }
    }
    this.releaseCalibrated(attach);
    attach.calibrated = {
      zoom: geometry.zoom,
      cellSize: geometry.cellSize,
      session,
    };
    this.rememberOrigin(attach);
    this.watchCalibratedCamera(attach, viewport);
    return 'applied';
  }

  /** R3-2 defence in depth: zoom stays C/U; explicit pans are remembered. */
  private watchCalibratedCamera(attach: Attach, viewport: Viewport): void {
    const camera = viewport.camera;
    attach.calibratedDisposers.push(
      camera.onChange(() => {
        const applied = attach.calibrated;
        const state = this.calibrationState();
        if (!applied || this.attach !== attach || !state) return;
        if (state.session !== applied.session || !preferCalibrated(state))
          return;
        if (Math.abs(camera.zoom - applied.zoom) > ZOOM_TOLERANCE) {
          const size = viewport.getCanvasSize();
          applyCalibratedZoom(camera, applied.zoom, {
            x: size.w / 2,
            y: size.h / 2,
          });
          return;
        }
        if (attach.uncovered) this.rememberOrigin(attach);
      })
    );
  }

  private releaseCalibrated(attach: Attach): void {
    for (const dispose of attach.calibratedDisposers.splice(0)) {
      try {
        dispose();
      } catch {
        // Keep releasing the rest.
      }
    }
  }

  /** Uncalibrated preference: default limits back, camera untouched (C7-1). */
  private leaveCalibrated(attach: Attach): void {
    if (!attach.calibrated) return;
    this.releaseCalibrated(attach);
    attach.calibrated = null;
    if (attach.viewport)
      setZoomLimits(attach.viewport.camera, DEFAULT_ZOOM_LIMITS);
  }

  private rememberOrigin(attach: Attach): void {
    const applied = attach.calibrated;
    const viewport = attach.viewport;
    if (!applied || !viewport) return;
    const state = this.calibrationState();
    if (state?.session !== applied.session) return;
    const { x, y } = viewport.camera.position;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.origins.set(attach.scene.sceneId, { x, y, zoom: applied.zoom });
  }

  private contentBounds(viewport: Viewport): Bounds | null {
    try {
      return this.options.deps.contentBounds?.(viewport) ?? null;
    } catch {
      return null;
    }
  }

  /** "Centre map": content centre at the canvas centre, zoom unchanged. */
  private centreMap(attach: Attach): void {
    const viewport = attach.viewport;
    if (!viewport) return;
    const bounds = this.contentBounds(viewport);
    const size = viewport.getCanvasSize();
    if (!bounds || !(size.w > 0 && size.h > 0)) return;
    centreBoundsAt(viewport.camera, bounds, size);
    this.rememberOrigin(attach);
  }
}
