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
  /** Pending local operations dropped with the old room (never replayed). */
  discardedOperationIds: string[];
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
      'Fog version reached the safe integer ceiling; reconnect editing is denied'
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
  // never replays its pending work into the new room.
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
  /** Every local submission: JSON-normalized, and a refusal is visible. */
  const submit = (mutation: Mutation, submitOptions?: SubmitOptions): void => {
    const normalized = withoutUndefined(mutation);
    const result =
      submitOptions === undefined
        ? connection.submit(normalized)
        : connection.submit(normalized, submitOptions);
    if (
      result.status === 'refused' &&
      (result.reason === 'invalid' || result.reason === 'capacity')
    )
      options.onDiagnostic?.(
        `A local ${mutation.kind} edit was not sent to the live room (${result.reason})`
      );
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

  const onAuthorityChange = (inner: ManagedAuthorityConnection): void => {
    if (stopped || inner !== connection || retired === inner) return;
    const state = inner.getState();
    if (state.status === 'live') everLive = true;
    options.onStatus?.(state.status);
    restoreRejectedEdits(state);
    const document = state.document;
    if (!document || document === lastDocument) return;
    lastDocument = document;
    applyingRemote = true;
    try {
      options.store.loadSnapshot(
        document.elements.map(element =>
          canvasElement(element as unknown as Record<string, unknown>)
        ),
        { origin: 'remote' }
      );
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
  };
  let unsubscribeAuthority = connection.subscribe(() =>
    onAuthorityChange(connection)
  );

  function rebind(next: SceneBinding, seed: BattleMapTokenResult): void {
    if (stopped) return;
    const previous = binding;
    const discardedOperationIds = connection
      .getState()
      .operations.filter(
        operation =>
          operation.status === 'draft' ||
          operation.status === 'pending' ||
          operation.status === 'uncertain'
      )
      .map(operation => operation.clientOperationId);
    const visible = everLive || discardedOperationIds.length > 0;
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
        'The presented scene changed. Unsent map edits were discarded.'
      );
      options.onSceneChange?.({
        previousSceneId: previous.sceneId,
        sceneId: next.sceneId,
        discardedOperationIds,
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
    onAuthorityChange(inner);
  }

  const presenceHandlers = new Set<(from: string, data: unknown) => void>();
  const leaveHandlers = new Set<(from: string) => void>();
  return {
    stop() {
      stopped = true;
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
    requestCheckpoint: checkpointOptions =>
      connection.requestCheckpoint(checkpointOptions),
    releaseBarrier: barrier => connection.releaseBarrier(barrier),
  };
}

export type BattleMapAuthorityBarrier = AuthorityBarrier;
export type BattleMapAuthorityBarrierResult = AuthorityBarrierResult;
export type BattleMapAuthorityCheckpointResult =
  AuthorityClientCheckpointResult;
