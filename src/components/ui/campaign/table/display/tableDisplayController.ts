import type { CameraView, Viewport } from '@fieldnotes/core';
import type { FogManager, FogPlugin } from '@fieldnotes/vtt';

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
  DISPLAY_WAITING,
} from './displayMessages';

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
}

export type DisplayCredentialDenial = 'expired' | 'in-use';

export interface TableDisplayView {
  /** Null = uncovered (a rendered, acknowledged-ready scene). */
  cover: string | null;
  /** The canvas to mount for the current attach (keyed per attach). */
  canvas: { key: number; fogPlugin: FogPlugin } | null;
  /** Uncovered and showing a scene: the Fit map affordance may show. */
  showing: boolean;
}

export interface TableDisplayControllerOptions {
  code: string;
  credential: DisplayCredential;
  relayUrl: string | undefined;
  deps: TableDisplayDeps;
  onView: (view: TableDisplayView) => void;
  onCredentialDenied: (denial: DisplayCredentialDenial) => void;
  fetcher?: typeof fetch;
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
}

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
  private view: TableDisplayView = {
    cover: DISPLAY_WAITING,
    canvas: null,
    showing: false,
  };

  constructor(options: TableDisplayControllerOptions) {
    this.options = options;
    this.fetcher = options.fetcher ?? ((...args) => fetch(...args));
  }

  start(): void {
    this.emit({});
    void this.poll();
  }

  stop(): void {
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

  /** The explicit "Fit map" move: fits and remembers the view. */
  fitMap(): void {
    const attach = this.attach;
    if (!attach?.viewport || !attach.uncovered) return;
    this.options.deps.fitView(attach.viewport);
    this.views.set(
      attach.scene.sceneId,
      this.options.deps.captureView(attach.viewport)
    );
  }

  /** `FieldNotesCanvas` `onReady` for the canvas keyed `key`. */
  onViewportReady(key: number, viewport: Viewport): void {
    const attach = this.attach;
    if (this.stopped || !attach || attach.gen !== key || attach.viewport)
      return;
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
      store: viewport.store,
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
    const key = [
      descriptor.displayGeneration,
      descriptor.epoch,
      descriptor.presentation.sceneId ?? '',
      descriptor.scene?.sourceMapId ?? '',
      descriptor.presentation.blanked ? 'blank' : 'open',
    ].join('|');
    const sameTarget = this.target?.key === key;
    const revisionChanged =
      previous?.presentation.revision !== descriptor.presentation.revision;
    this.target = { key, descriptor };
    if (!sameTarget) {
      this.retryDelay = 1_000;
      this.clearRetry();
      this.retarget();
    } else if (revisionChanged) {
      // Same visible target: keep the attach, re-ACK the new tuple.
      if (!this.attach) this.sendAck('blank');
      else if (this.attach.stage === 'shown' && this.attach.status === 'live')
        this.sendAck('loaded');
    }
  }

  // ---- attach protocol (E9) ----------------------------------------------

  private retarget(): void {
    this.stopHeartbeat();
    this.teardownAttach();
    const descriptor = this.target?.descriptor;
    if (!descriptor) return;
    const scene = descriptor.scene;
    if (!scene) {
      this.emit({ cover: DISPLAY_WAITING, canvas: null, showing: false });
      this.sendAck('blank');
      this.startHeartbeat('blank');
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
      try {
        this.views.set(
          attach.scene.sceneId,
          this.options.deps.captureView(attach.viewport)
        );
      } catch {
        // A destroyed viewport keeps the previously remembered view.
      }
    }
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
      if (!this.stopped && !this.denied && this.target?.descriptor.scene)
        this.retarget();
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
      attach.cameraApplied = true;
      const remembered = this.views.get(attach.scene.sceneId);
      if (remembered) this.options.deps.applyView(attach.viewport, remembered);
      else {
        this.options.deps.fitView(attach.viewport);
        this.views.set(
          attach.scene.sceneId,
          this.options.deps.captureView(attach.viewport)
        );
      }
    }
    attach.stage = 'awaitFrame';
    attach.viewport.requestRender();
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
      attach.viewport?.requestRender();
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
    this.view = { ...this.view, ...patch };
    this.options.onView(this.view);
  }
}
