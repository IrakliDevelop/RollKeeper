import type { CanvasElement, ElementStore, Layer } from '@fieldnotes/core';
import {
  bearerSubprotocols,
  createManagedAuthorityConnection,
  type AuthorityClientState,
  type ManagedAuthorityConnection,
  type AuthorityBarrier,
  type AuthorityBarrierResult,
  type AuthorityClientCheckpointResult,
  type AuthorityClientStatus,
  type AuthorityClientTransport,
  type FogSnapshot,
  type LayerRecord,
  type RemoteLayerUpdate,
} from '@fieldnotes/sync';
import { createFogAuthorityClientExtension } from '@fieldnotes/vtt/sync';
import type { FogManager } from '@fieldnotes/vtt';

import type {
  BattleMapConnection,
  BattleMapTokenRequest,
  BattleMapTokenResult,
} from './battlemapSync';

interface AuthorityOptions {
  relayUrl: string;
  campaignCode: string;
  battleMapId: string;
  store: ElementStore;
  clientId: string;
  tokenRequest: BattleMapTokenRequest;
  resolveAudience?: (element: CanvasElement) => string | undefined;
  layers?: { applyLayer: (update: RemoteLayerUpdate) => void };
  fog?: { manager: FogManager };
  onStatus?: (status: AuthorityClientStatus) => void;
  onDiagnostic?: (message: string) => void;
  /**
   * GG3: drafts made while offline were released because the live room
   * won. The DM page keeps its offline version in the scene's offline
   * changes slot and shows the notice itself (the offline diagnostic is not
   * sent when this is set).
   */
  onOfflineDraftsReleased?: () => void;
  onTokenMetadata?: (meta: {
    fogAppearance?: import('@/types/battlemap').ProjectedFogAppearance;
    fogAppearanceUpdatedAt?: string | null;
  }) => void;
  mint: (
    campaignCode: string,
    request: BattleMapTokenRequest
  ) => Promise<BattleMapTokenResult | null>;
  transportFactory?: (endpoint: {
    url: string;
    protocols?: readonly string[];
  }) => AuthorityClientTransport;
  /** R4: the scene the server resolved for this map-pinned audience. */
  onSceneResolved?: (sceneId: string) => void;
  /** R4: the resolved scene changed under a live/pending connection. */
  onSceneChange?: (change: BattleMapSceneChange) => void;
}

export interface BattleMapSceneChange {
  previousSceneId: string;
  sceneId: string;
  /** SDK operations dropped with the old room (never replayed). */
  discardedOperationIds: string[];
  /** Held local edits (not yet given to the SDK) dropped with it (EE6). */
  discardedHeldEdits?: number;
}

interface SceneBinding {
  sceneId: string;
  /** Null until the first mint resolves the room. */
  room: string | null;
}

/**
 * PR07 acceptance A1: what the SDK can serialize. The SDK journal admits a
 * proposal only if its frame serializes as bounded JSON, which rejects
 * `undefined`; the legacy wire (JSON.stringify) silently dropped such keys.
 * Plain objects (prototype `Object.prototype` or null) are copied without
 * their `undefined`-valued properties (an own `__proto__` key stays a data
 * key); arrays are copied with `undefined` entries and holes as null; null
 * is kept; anything else (Date, Map, class instances) is passed through
 * unchanged so the SDK still refuses it and the refusal is reported. The
 * input is never mutated.
 */
export function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value))
    return Array.from(value, item =>
      item === undefined ? null : withoutUndefined(item)
    ) as T;
  if (value === null || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value))
    if (child !== undefined)
      Object.defineProperty(copy, key, {
        value: withoutUndefined(child),
        enumerable: true,
        writable: true,
        configurable: true,
      });
  return copy as T;
}

function canvasElement(element: Record<string, unknown>): CanvasElement {
  const canvas = { ...element };
  delete canvas.audience;
  delete canvas.ownerId;
  return canvas as unknown as CanvasElement;
}

/** FF1 / GG3: offline DM edits superseded by the live room (kept in the scene's offline changes slot). */
export const OFFLINE_DISCARDED_DM_MESSAGE =
  'Map edits made while offline were not sent. To send them, open Details and choose Reapply offline changes.';
/** HH2: the offline version could not be kept in the scene's slot. */
export const OFFLINE_NOT_KEPT_DM_MESSAGE =
  'Map edits made while offline were not sent, and this device could not keep a copy for later. To send them now, open Details and choose Reapply latest changes before you edit again.';
/** FF1: a player's offline edits superseded by the live room. */
export const OFFLINE_DISCARDED_PLAYER_MESSAGE =
  "Changes you made while offline weren't saved.";
/** GG2: an edit whose outcome was lost with the connection (may have saved). */
export const CONNECTION_DROPPED_MESSAGE =
  'The connection dropped during an edit. The map shows the live room.';
/**
 * QA4: an edit whose outcome was lost because the DM restored the room (a
 * new room generation), not because the connection dropped.
 */
export const ROOM_RESTORED_PLAYER_MESSAGE =
  'The DM restored the map. Your last change may not have been kept.';
/** FF6 / GG1: a DM edit the live room refused; the DM's map keeps it. */
export const DM_REJECTED_MESSAGE =
  'The live map refused a change. Players see the saved version.';
/**
 * HH1: the SDK spaces checkpoint requests 10 s apart by its own send time,
 * and the relay closes the socket (1013) when a request arrives less than
 * 10 s after the previous one. Network jitter can put the two clocks on
 * either side of that boundary, so a requested checkpoint waits a little
 * longer than the SDK would.
 */
export const CHECKPOINT_REQUEST_SPACING_MS = 10_500;

/** Resolves false when the signal aborts before `ms` elapse. */
function waitFor(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** EE2: held edits kept at most (after coalescing). */
export const HELD_EDIT_LIMIT = 64;
export const HELD_OVERFLOW_MESSAGE =
  'Too many map edits are waiting to be sent. The latest one was not kept.';
export const HELD_STALE_MESSAGE =
  'The live map changed while edits were waiting. Unsent edits were dropped.';

/** Bridges RollKeeper's existing stores to the released canonical authority client. */
export function createManagedBattleMapAuthorityConnection(
  options: AuthorityOptions
): BattleMapConnection {
  let stopped = false;
  let applyingRemote = false;
  let lastDocument: object | null = null;
  let layerSequence = 0;
  let fogSequence = 0;

  const denyFogSequence = (): void => {
    options.onDiagnostic?.(
      'Fog reached its edit limit, so live editing is off for this map.'
    );
    options.onStatus?.('denied');
  };
  const nextFogSequence = (): number | null => {
    if (
      !Number.isSafeInteger(fogSequence) ||
      fogSequence >= Number.MAX_SAFE_INTEGER
    ) {
      denyFogSequence();
      return null;
    }
    fogSequence += 1;
    return fogSequence;
  };

  // R4: player/display surfaces open the source-map URL and are admitted
  // only to the scene the server resolves from the current presentation.
  // The SDK scope (and every local operation) is keyed by that resolved
  // scene and room; a different resolution tears the connection down and
  // never replays its pending work into the new room. The first resolution
  // is not a change: work queued before it moves to the resolved room (DD1).
  const resolvesPresentation =
    options.tokenRequest.role !== 'dm' &&
    (options.tokenRequest.sceneId === undefined ||
      options.tokenRequest.sceneId === options.battleMapId);
  let binding: SceneBinding = {
    sceneId: options.tokenRequest.sceneId ?? options.battleMapId,
    room: null,
  };
  let everLive = false;
  let retired: ManagedAuthorityConnection | null = null;
  const scopeFor = (current: SceneBinding): string =>
    current.room === null
      ? `${options.campaignCode}:scene:${options.battleMapId}`
      : `${options.campaignCode}:scene:${current.sceneId}:room:${current.room}`;

  const open = (
    seed: BattleMapTokenResult | null
  ): ManagedAuthorityConnection => {
    let pendingSeed = seed;
    const inner: ManagedAuthorityConnection = createManagedAuthorityConnection({
      scopeId: scopeFor(binding),
      clientId: options.clientId,
      extensions: options.fog
        ? [createFogAuthorityClientExtension()]
        : undefined,
      transportFactory: options.transportFactory,
      resolveUrl: async () => {
        // A stopped or superseded connection never mints again.
        if (stopped || inner !== connection || retired === inner) return null;
        const result =
          pendingSeed ??
          (await options.mint(options.campaignCode, options.tokenRequest));
        pendingSeed = null;
        if (
          stopped ||
          inner !== connection ||
          !result?.authority ||
          !result.room
        )
          return null;
        if (resolvesPresentation) {
          const next = {
            sceneId: result.sceneId ?? binding.sceneId,
            room: result.room,
          };
          if (next.room !== binding.room || next.sceneId !== binding.sceneId) {
            retired = inner;
            queueMicrotask(() => rebind(next, result));
            return null;
          }
        }
        options.onTokenMetadata?.({
          fogAppearance: result.fogAppearance,
          fogAppearanceUpdatedAt: result.fogAppearanceUpdatedAt,
        });
        return {
          url: `${options.relayUrl}?room=${encodeURIComponent(result.room)}`,
          protocols: bearerSubprotocols(result.token),
        };
      },
    });
    return inner;
  };

  let connection = open(null);
  type Mutation = Parameters<ManagedAuthorityConnection['submit']>[0];
  type SubmitOptions = Parameters<ManagedAuthorityConnection['submit']>[1];
  /**
   * PR08 DD1 / EE1 / EE2: the held queue.
   *
   * - Before this connection's first live state, the SDK refuses edits
   *   (`not-ready`), so every local edit is held (generation `null`) and
   *   admitted in order on the first live state, once. These are edits
   *   made before the room existed for this client, never an offline fork.
   * - After the first live state the SDK path is unchanged: edits made
   *   while offline or recovering become generation-tagged SDK drafts that
   *   are never replayed automatically (SYNC-AUTHORITY section 6; the
   *   explicit Reapply path stays). The queue is used then only when the SDK
   *   answers `capacity` (transient: J1 releases settled operations), tagged
   *   with the live generation; such an entry is admitted only into that
   *   same generation and dropped visibly otherwise.
   * - Entries coalesce (latest upsert per element or layer; a remove
   *   supersedes earlier writes; order by last write) and the queue is
   *   capped, with a visible notice when an edit cannot be kept.
   */
  type Held = {
    mutation: Mutation;
    submitOptions?: SubmitOptions;
    /** Null before the first live state; else the live generation. */
    generation: string | null;
  };
  let held: Held[] = [];
  let firstLiveSeen = false;
  const heldKey = (mutation: Mutation): string | null => {
    if (mutation.kind === 'upsert') return `element:${mutation.element.id}`;
    if (mutation.kind === 'remove') return `element:${mutation.id}`;
    if (mutation.kind === 'layer-upsert') return `layer:${mutation.layer.id}`;
    if (mutation.kind === 'layer-remove') return `layer:${mutation.id}`;
    return null;
  };
  const hold = (entry: Held): void => {
    const key = heldKey(entry.mutation);
    const kept =
      key === null ? held : held.filter(item => heldKey(item.mutation) !== key);
    if (kept.length >= HELD_EDIT_LIMIT) {
      options.onDiagnostic?.(HELD_OVERFLOW_MESSAGE);
      held = kept;
      return;
    }
    held = [...kept, entry];
  };
  type AdmitOutcome = 'sent' | 'wait' | 'dropped';
  const admit = (entry: Held): AdmitOutcome => {
    const state = connection.getState();
    if (state.status !== 'live') return 'wait';
    if (entry.generation !== null && entry.generation !== state.generation) {
      options.onDiagnostic?.(HELD_STALE_MESSAGE);
      return 'dropped';
    }
    const normalized = withoutUndefined(entry.mutation);
    const result =
      entry.submitOptions === undefined
        ? connection.submit(normalized)
        : connection.submit(normalized, entry.submitOptions);
    if (
      result.status === 'refused' &&
      (result.reason === 'not-ready' || result.reason === 'capacity')
    )
      return 'wait';
    if (result.status === 'refused' && result.reason === 'invalid')
      options.onDiagnostic?.(
        `A local ${entry.mutation.kind} edit was not sent to the live room (invalid)`
      );
    return 'sent';
  };
  // Submitting notifies subscribers synchronously, which re-enters
  // onAuthorityChange and flushHeld, and a subscriber may make a new local
  // edit meanwhile: the guard keeps one flush and queues such edits behind.
  let flushing = false;
  const flushHeld = (): void => {
    if (flushing) return;
    flushing = true;
    try {
      while (held.length > 0 && !stopped) {
        const [next, ...rest] = held;
        held = rest;
        if (admit(next!) === 'wait') {
          held = [next!, ...held];
          return;
        }
      }
    } finally {
      flushing = false;
    }
  };
  /** Every local submission: JSON-normalized, and a refusal is visible. */
  const submit = (mutation: Mutation, submitOptions?: SubmitOptions): void => {
    // FF4: only a presentation-resolving (player/display) connection holds
    // before its first live state (DD1); the DM keeps the base behaviour
    // (`not-ready` before live; the scene's localDraft keeps the edit).
    if (!firstLiveSeen && resolvesPresentation) {
      hold({ mutation, submitOptions, generation: null });
      return;
    }
    const state = connection.getState();
    // FF3: after the first live state, an edit made while not live is an
    // SDK draft (never auto-replayed), even if capacity entries are held.
    const offline = firstLiveSeen && state.status !== 'live';
    if (!offline && (flushing || held.length > 0)) {
      hold({ mutation, submitOptions, generation: state.generation });
      return;
    }
    const normalized = withoutUndefined(mutation);
    const result =
      submitOptions === undefined
        ? connection.submit(normalized)
        : connection.submit(normalized, submitOptions);
    if (result.status !== 'refused') return;
    if (result.reason === 'capacity' && !offline)
      hold({ mutation, submitOptions, generation: state.generation });
    else if (result.reason === 'invalid' || result.reason === 'capacity')
      options.onDiagnostic?.(
        `A local ${mutation.kind} edit was not sent to the live room (${result.reason})`
      );
  };
  /** Re-applies held local edits over a freshly loaded remote snapshot. */
  const reapplyHeld = (): void => {
    for (const { mutation } of held) {
      if (mutation.kind === 'upsert') {
        const element = canvasElement(
          mutation.element as unknown as Record<string, unknown>
        );
        if (options.store.getById(element.id))
          options.store.update(element.id, element, { origin: 'remote' });
        else options.store.add(element, { origin: 'remote' });
      } else if (mutation.kind === 'remove') {
        if (options.store.getById(mutation.id))
          options.store.remove(mutation.id, { origin: 'remote' });
      }
    }
  };
  const submitElement = (element: CanvasElement): void => {
    const audience = options.resolveAudience?.(element);
    submit({
      kind: 'upsert',
      element: { ...element, ...(audience === undefined ? {} : { audience }) },
    });
  };
  const unsubscribers = [
    options.store.on('add', (element, meta) => {
      if (
        !applyingRemote &&
        (meta.origin === undefined || meta.origin === 'local')
      )
        submitElement(element);
    }),
    options.store.on('update', (event, meta) => {
      if (
        !applyingRemote &&
        (meta.origin === undefined || meta.origin === 'local')
      )
        submitElement(event.current);
    }),
    options.store.on('remove', (element, meta) => {
      if (
        !applyingRemote &&
        (meta.origin === undefined || meta.origin === 'local')
      ) {
        submit({ kind: 'remove', id: element.id });
      }
    }),
    options.store.on('clear', (_empty, meta) => {
      if (
        !applyingRemote &&
        (meta.origin === undefined || meta.origin === 'local')
      ) {
        const state = connection.getState().document?.casToken;
        submit({ kind: 'clear' }, state ? { expectedState: state } : undefined);
      }
    }),
  ];

  if (options.fog) {
    unsubscribers.push(
      options.fog.manager.on('change', event => {
        if (
          applyingRemote ||
          (event.origin !== undefined && event.origin !== 'local')
        )
          return;
        const state = options.fog!.manager.getState();
        const version = nextFogSequence();
        if (version === null) return;
        if (!state || event.kind !== 'tiles') {
          submit({
            kind: 'fog-meta',
            record: {
              version,
              editor: options.clientId,
              ...(state ? { definition: state.definition } : {}),
            },
          });
          return;
        }
        const currentTiles = new Map(
          state.tiles.map(tile => [`${tile.x},${tile.y}`, tile] as const)
        );
        const tiles = (event.tiles ?? []).map(coordinate => {
          const tile = currentTiles.get(`${coordinate.x},${coordinate.y}`);
          return {
            generation: state.definition.generation,
            x: coordinate.x,
            y: coordinate.y,
            version,
            editor: options.clientId,
            ...(tile ? { data: tile.data } : {}),
          };
        });
        for (let offset = 0; offset < tiles.length; offset += 64) {
          submit({
            kind: 'fog-patch',
            generation: state.definition.generation,
            tiles: tiles.slice(offset, offset + 64),
          });
        }
      })
    );
  }

  // Player/display edits the authority rejects (e.g. a forged resize of a
  // movement-only token) are restored from the confirmed document; the
  // optimistic local copy would otherwise linger until the next snapshot.
  const restoredRejections = new Set<string>();
  const restoreRejectedEdits = (state: AuthorityClientState): void => {
    // The DM keeps its local version of a refused edit (its scene's
    // localDraft holds it too); only players are put back (GG1: the DM is
    // told the truth instead).
    if (options.tokenRequest.role === 'dm' || !state.document) return;
    const live = new Set<string>();
    const ids = new Set<string>();
    for (const operation of state.operations) {
      live.add(operation.clientOperationId);
      if (
        operation.status !== 'rejected' ||
        restoredRejections.has(operation.clientOperationId)
      )
        continue;
      restoredRejections.add(operation.clientOperationId);
      const mutation = operation.proposal.mutation;
      if (mutation.kind === 'upsert') ids.add(mutation.element.id);
      else if (mutation.kind === 'remove') ids.add(mutation.id);
    }
    for (const id of restoredRejections) {
      if (!live.has(id)) restoredRejections.delete(id);
    }
    if (ids.size === 0) return;
    applyingRemote = true;
    try {
      for (const id of ids) {
        const confirmed = state.document.elements.find(item => item.id === id);
        const local = options.store.getById(id);
        if (!confirmed) {
          if (local) options.store.remove(id, { origin: 'remote' });
          continue;
        }
        const element = canvasElement(
          confirmed as unknown as Record<string, unknown>
        );
        if (!local) {
          options.store.add(element, { origin: 'remote' });
          continue;
        }
        const patch: Record<string, unknown> = { ...element };
        for (const key of Object.keys(local)) {
          if (!Object.hasOwn(patch, key)) patch[key] = undefined;
        }
        options.store.update(id, patch as Partial<CanvasElement>, {
          origin: 'remote',
        });
      }
    } finally {
      applyingRemote = false;
    }
  };

  /**
   * J1 / FF1: the SDK keeps every operation (at most 64) until the app
   * releases it. After each change, terminal work is released:
   * - accepted operations;
   * - rejected operations once restored on screen (players), or with a
   *   notice for the DM, whose rejections are not restored (FF6);
   * - once the room is live with its authoritative document applied, the
   *   drafts made while offline and the uncertain operations left by a lost
   *   episode. The live room wins (SYNC-AUTHORITY section 6): the DM's offline
   *   version is copied into the scene's offline changes slot (GG3,
   *   `onOfflineDraftsReleased`) and "Reapply offline changes" re-sends it;
   *   a player is told the offline changes were not saved.
   * Pending work is never released. A pinned operation (barrier) is refused
   * by the SDK and retried on the next change or right after
   * `releaseBarrier`. Releasing notifies subscribers synchronously, so the
   * ids are collected first and nested changes are skipped (FF2).
   */
  let releasing = false;
  /** HH1: when this tab last caused a checkpoint request (ms epoch). */
  let lastCheckpointRequestAt = Number.NEGATIVE_INFINITY;
  let lastStatus: string | null = null;
  /**
   * QA4: drafts and uncertain operations seen while the connection was not
   * live. Only those are released once it is live again. When a socket
   * closes, the SDK first reports the in-flight work as uncertain while the
   * status still reads `live` (then `denied` or `offline`); releasing it
   * there blamed the connection for a DM restore (4403) before the page
   * even reconnected.
   */
  const parked = new Set<string>();
  const releaseSettled = (inner: ManagedAuthorityConnection): void => {
    const state = inner.getState();
    const settledLive = state.status === 'live' && state.document !== null;
    const isDm = options.tokenRequest.role === 'dm';
    const live = new Set<string>();
    for (const operation of state.operations) {
      live.add(operation.clientOperationId);
      if (
        state.status !== 'live' &&
        (operation.status === 'draft' || operation.status === 'uncertain')
      )
        parked.add(operation.clientOperationId);
    }
    for (const id of parked) if (!live.has(id)) parked.delete(id);
    const releases: Array<{ id: string; status: string }> = [];
    // QA4: work from an earlier room generation was superseded because the
    // DM restored (replaced) the room, not lost with the connection or kept
    // offline. A player is told so; the DM restored it themselves. The DM's
    // offline drafts still go to the offline changes slot (GG3).
    for (const operation of state.operations) {
      const id = operation.clientOperationId;
      const status = operation.status;
      const offlineWork =
        settledLive &&
        parked.has(id) &&
        (status === 'draft' || status === 'uncertain');
      if (
        offlineWork &&
        state.generation !== null &&
        operation.generation !== state.generation &&
        (status === 'uncertain' || !isDm)
      ) {
        releases.push({ id, status: 'replaced' });
        continue;
      }
      if (
        status === 'accepted' ||
        // FF6: a player's once restored on screen; the DM's with a notice.
        (status === 'rejected' && (isDm || restoredRejections.has(id))) ||
        offlineWork
      )
        releases.push({ id, status });
    }
    if (releases.length === 0) return;
    const released = { draft: 0, uncertain: 0, rejected: 0, replaced: 0 };
    releasing = true;
    try {
      for (const { id, status } of releases) {
        const ok =
          status === 'accepted'
            ? inner.releaseOperation(id)
            : inner.releaseOperation(id, { discardDraft: true });
        if (!ok) continue;
        parked.delete(id);
        if (status === 'draft') released.draft += 1;
        else if (status === 'uncertain') released.uncertain += 1;
        else if (status === 'rejected') released.rejected += 1;
        else if (status === 'replaced') released.replaced += 1;
      }
    } finally {
      releasing = false;
    }
    // GG2: only real offline drafts point the DM at Reapply. An uncertain
    // operation may have committed; the live document is what the map shows.
    // GG3 / HH2: a page that keeps the offline version owns the notice, so
    // it can say whether the copy was kept.
    // QA4: a player whose work the DM's restore replaced is told that first.
    if (released.replaced > 0 && !isDm)
      options.onDiagnostic?.(ROOM_RESTORED_PLAYER_MESSAGE);
    else if (released.draft > 0 && options.onOfflineDraftsReleased)
      options.onOfflineDraftsReleased();
    else if (released.draft > 0)
      options.onDiagnostic?.(
        isDm ? OFFLINE_DISCARDED_DM_MESSAGE : OFFLINE_DISCARDED_PLAYER_MESSAGE
      );
    else if (released.uncertain > 0)
      options.onDiagnostic?.(CONNECTION_DROPPED_MESSAGE);
    // A DM's replaced work needs no notice: they restored the room
    // themselves and were told so ("Checkpoint restored.").
    if (isDm && released.rejected > 0)
      options.onDiagnostic?.(DM_REJECTED_MESSAGE);
  };

  const onAuthorityChange = (inner: ManagedAuthorityConnection): void => {
    if (releasing || stopped || inner !== connection || retired === inner)
      return;
    const state = inner.getState();
    // HH1: entering recovery, the SDK sends its own checkpoint request.
    if (state.status === 'recovering' && lastStatus !== 'recovering')
      lastCheckpointRequestAt = Date.now();
    lastStatus = state.status;
    if (state.status === 'live') {
      everLive = true;
      firstLiveSeen = true;
    }
    options.onStatus?.(state.status);
    restoreRejectedEdits(state);
    const document = state.document;
    if (!document || document === lastDocument) {
      releaseSettled(inner);
      flushHeld();
      return;
    }
    lastDocument = document;
    applyingRemote = true;
    try {
      options.store.loadSnapshot(
        document.elements.map(element =>
          canvasElement(element as unknown as Record<string, unknown>)
        ),
        { origin: 'remote' }
      );
      // Held local edits are not in the snapshot yet; keep them visible.
      reapplyHeld();
      for (const record of document.layers) {
        options.layers?.applyLayer({
          record: record as LayerRecord,
          source: 'snapshot',
        });
        layerSequence = Math.max(layerSequence, record.version);
      }
      if (options.fog) {
        const data = document.extensions.fog?.data as
          | FogSnapshot
          | null
          | undefined;
        if (data) {
          const versions = [
            data.meta.version,
            ...data.tiles.map(tile => tile.version),
          ];
          if (
            versions.some(
              version => !Number.isSafeInteger(version) || version < 0
            )
          ) {
            denyFogSequence();
            return;
          }
          fogSequence = Math.max(fogSequence, ...versions);
        }
        if (!data?.meta.definition) {
          options.fog.manager.loadState(null, { origin: 'remote' });
        } else {
          options.fog.manager.loadState(
            {
              definition: data.meta.definition,
              tiles: data.tiles.flatMap(tile =>
                typeof tile.data === 'string'
                  ? [{ x: tile.x, y: tile.y, data: tile.data }]
                  : []
              ),
            },
            { origin: 'remote' }
          );
        }
      }
    } catch (error) {
      options.onDiagnostic?.(
        error instanceof Error ? error.message : 'Invalid authority checkpoint'
      );
      options.onStatus?.('denied');
    } finally {
      applyingRemote = false;
    }
    // After the authoritative document is applied: release settled and
    // superseded offline work (J1, FF1), then admit held edits.
    releaseSettled(inner);
    flushHeld();
  };
  let unsubscribeAuthority = connection.subscribe(() =>
    onAuthorityChange(connection)
  );

  function rebind(next: SceneBinding, seed: BattleMapTokenResult): void {
    if (stopped) return;
    const previous = binding;
    const unsent = connection
      .getState()
      .operations.filter(
        operation =>
          operation.status === 'draft' ||
          operation.status === 'pending' ||
          operation.status === 'uncertain'
      );
    // PR08 DD1: the first resolution of a map-pinned connection (no room
    // yet, never live) is not a scene change. Edits made meanwhile (the
    // player's band, an early token) were held (the SDK admits nothing
    // before live), were made against no other scene, and move to the
    // resolved room in order. A later change of scene discards visibly.
    // EE5: no SDK work exists before the first live state; any that does
    // is reported as discarded rather than carried without its options.
    const initial = previous.room === null && !everLive;
    const carried: Held[] = initial ? held : [];
    const discardedOperationIds = unsent.map(
      operation => operation.clientOperationId
    );
    const discardedHeldEdits = initial ? 0 : held.length;
    held = [];
    const visible =
      everLive || discardedOperationIds.length > 0 || discardedHeldEdits > 0;
    unsubscribeAuthority();
    connection.stop();
    binding = next;
    everLive = false;
    lastDocument = null;
    restoredRejections.clear();
    if (visible) {
      applyingRemote = true;
      try {
        options.store.loadSnapshot([], { origin: 'remote' });
        options.fog?.manager.loadState(null, { origin: 'remote' });
      } finally {
        applyingRemote = false;
      }
      options.onDiagnostic?.(
        'The DM changed the scene. Unsent map edits were discarded.'
      );
      options.onSceneChange?.({
        previousSceneId: previous.sceneId,
        sceneId: next.sceneId,
        discardedOperationIds,
        ...(discardedHeldEdits > 0 ? { discardedHeldEdits } : {}),
      });
    }
    // Either callback may stop this connection (the pages rebuild their
    // canvas on a scene change); never open a replacement after that.
    if (stopped) return;
    options.onSceneResolved?.(next.sceneId);
    if (stopped) return;
    const inner = open(seed);
    connection = inner;
    retired = null;
    unsubscribeAuthority = inner.subscribe(() => onAuthorityChange(inner));
    if (stopped) {
      unsubscribeAuthority();
      inner.stop();
      return;
    }
    // Re-proposed once, in their original order, to the resolved room.
    held = carried;
    flushHeld();
    onAuthorityChange(inner);
  }

  const presenceHandlers = new Set<(from: string, data: unknown) => void>();
  const leaveHandlers = new Set<(from: string) => void>();
  return {
    stop() {
      stopped = true;
      held = [];
      unsubscribeAuthority();
      unsubscribers.forEach(unsubscribe => unsubscribe());
      connection.stop();
    },
    publishLayerUpsert(definition: Layer) {
      layerSequence += 1;
      submit({
        kind: 'layer-upsert',
        layer: definition,
        version: layerSequence,
        editor: options.clientId,
      });
    },
    publishLayerRemove(id: string) {
      layerSequence += 1;
      submit({
        kind: 'layer-remove',
        id,
        version: layerSequence,
        editor: options.clientId,
      });
    },
    sendPresence: () => {},
    onPresence(handler) {
      presenceHandlers.add(handler);
      return () => presenceHandlers.delete(handler);
    },
    onPresenceLeave(handler) {
      leaveHandlers.add(handler);
      return () => leaveHandlers.delete(handler);
    },
    captureBarrier: () => connection.captureBarrier(),
    waitForAcknowledgements: (barrier, waitOptions) =>
      connection.waitForAcknowledgements(barrier, waitOptions),
    requestCheckpoint: async checkpointOptions => {
      // II2: when not live the SDK answers `recovery` at once without
      // sending anything, so there is nothing to space.
      if (connection.getState().status !== 'live')
        return connection.requestCheckpoint(checkpointOptions);
      const wait =
        lastCheckpointRequestAt + CHECKPOINT_REQUEST_SPACING_MS - Date.now();
      if (wait > 0 && !(await waitFor(wait, checkpointOptions?.signal)))
        return { status: 'failed', reason: 'aborted' };
      lastCheckpointRequestAt = Date.now();
      return connection.requestCheckpoint(checkpointOptions);
    },
    releaseBarrier: barrier => {
      const released = connection.releaseBarrier(barrier);
      // J1: its operations are unpinned now; free the settled ones at once.
      if (released) releaseSettled(connection);
      return released;
    },
  };
}

export type BattleMapAuthorityBarrier = AuthorityBarrier;
export type BattleMapAuthorityBarrierResult = AuthorityBarrierResult;
export type BattleMapAuthorityCheckpointResult =
  AuthorityClientCheckpointResult;
