import type { CanvasElement, ElementStore, Layer } from '@fieldnotes/core';
import {
  bearerSubprotocols,
  createManagedAuthorityConnection,
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

  const connection = createManagedAuthorityConnection({
    scopeId: `${options.campaignCode}:scene:${options.battleMapId}`,
    clientId: options.clientId,
    extensions: options.fog ? [createFogAuthorityClientExtension()] : undefined,
    transportFactory: options.transportFactory,
    resolveUrl: async () => {
      const result = await options.mint(
        options.campaignCode,
        options.tokenRequest
      );
      if (stopped || !result?.authority || !result.room) return null;
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

  const submitElement = (element: CanvasElement): void => {
    const audience = options.resolveAudience?.(element);
    connection.submit({
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
        connection.submit({ kind: 'remove', id: element.id });
      }
    }),
    options.store.on('clear', (_empty, meta) => {
      if (
        !applyingRemote &&
        (meta.origin === undefined || meta.origin === 'local')
      ) {
        const state = connection.getState().document?.casToken;
        connection.submit(
          { kind: 'clear' },
          state ? { expectedState: state } : undefined
        );
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
          connection.submit({
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
          connection.submit({
            kind: 'fog-patch',
            generation: state.definition.generation,
            tiles: tiles.slice(offset, offset + 64),
          });
        }
      })
    );
  }

  const unsubscribeAuthority = connection.subscribe(() => {
    const state = connection.getState();
    options.onStatus?.(state.status);
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
          FogSnapshot | null | undefined;
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
  });

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
      connection.submit({
        kind: 'layer-upsert',
        layer: definition,
        version: layerSequence,
        editor: options.clientId,
      });
    },
    publishLayerRemove(id: string) {
      layerSequence += 1;
      connection.submit({
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
