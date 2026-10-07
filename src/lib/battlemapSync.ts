import {
  createManagedSyncConnection,
  type AuthorityBarrier,
  type AuthorityBarrierResult,
  type AuthorityClientCheckpointResult,
  type AuthorityClientStatus,
  type ManagedSyncStatus,
  type ManagedSyncTransport,
  type RemoteLayerUpdate,
  type ResolveLocalOnly,
} from '@fieldnotes/sync';
import type { ElementStore, CanvasElement, Layer } from '@fieldnotes/core';
import type { FogManager } from '@fieldnotes/vtt';
import { createFogClientPlugin } from '@fieldnotes/vtt/sync';
import { battleMapRelayRoom } from '@/lib/battlemapRoom';
import type { BattleMapRole } from '@/lib/battlemapToken';
import {
  parseProjectedFogAppearance,
  normalizeFogAppearanceProjectionTimestamp,
} from '@/lib/fogOfWar';
import { fieldnotesElementRegistry } from '@/lib/fieldnotesVtt';
import { createManagedBattleMapAuthorityConnection } from '@/lib/battlemapAuthority';

export type { RemoteLayerUpdate };

export type BattleMapConnectionStatus =
  | ManagedSyncStatus
  | AuthorityClientStatus;

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

export function isValidClientId(id: string): boolean {
  return id.length >= 1 && id.length <= 128 && PRINTABLE_ASCII.test(id);
}

export interface BattleMapTokenRequest {
  role: BattleMapRole;
  battleMapId: string;
  sceneId?: string;
  dmId?: string;
  playerId?: string;
  displayKey?: string;
  protocols?: { fog?: 1; authority?: 1 };
  /** Routing hint for the established location versus scene adapter. It
   * grants nothing; the server independently resolves resource identity. */
  kind?: 'battlemap' | 'location';
}

export interface BattleMapTokenResult {
  token: string;
  authority?: 1;
  room?: string;
  roomGeneration?: string;
  /** Server-resolved Table scene (R4); map-pinned audiences scope to it. */
  sceneId?: string;
  fogAppearance?: import('@/types/battlemap').ProjectedFogAppearance;
  fogAppearanceUpdatedAt?: string | null;
}

/** A non-ok token response: HTTP status and the server's error string. */
export interface BattleMapTokenDenial {
  status: number;
  error: string | null;
}

export async function mintBattleMapToken(
  campaignCode: string,
  req: BattleMapTokenRequest,
  options: {
    /** PR04 C4-1: observes a denial (null is still returned). */
    onDenied?: (denial: BattleMapTokenDenial) => void;
  } = {}
): Promise<BattleMapTokenResult | null> {
  try {
    const sceneId =
      req.kind === 'location' ? req.sceneId : (req.sceneId ?? req.battleMapId);
    const res = await fetch(`/api/campaign/${campaignCode}/battlemap-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rollkeeper-csrf': '1',
      },
      body: JSON.stringify({
        ...req,
        ...(sceneId === undefined ? {} : { sceneId }),
        protocols: { fog: 1, authority: 1 },
      }),
    });
    if (!res.ok) {
      if (options.onDenied) {
        const body = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        options.onDenied({
          status: res.status,
          error: typeof body?.error === 'string' ? body.error : null,
        });
      }
      return null;
    }
    const data = (await res.json()) as {
      token?: string;
      authority?: unknown;
      room?: unknown;
      roomGeneration?: unknown;
      sceneId?: unknown;
      fogAppearance?: unknown;
      fogAppearanceUpdatedAt?: unknown;
    };
    if (!data.token) return null;
    return {
      token: data.token,
      authority: data.authority === 1 ? 1 : undefined,
      room: typeof data.room === 'string' ? data.room : undefined,
      roomGeneration:
        typeof data.roomGeneration === 'string'
          ? data.roomGeneration
          : undefined,
      sceneId: typeof data.sceneId === 'string' ? data.sceneId : undefined,
      fogAppearance: parseProjectedFogAppearance(data.fogAppearance),
      fogAppearanceUpdatedAt: normalizeFogAppearanceProjectionTimestamp(
        data.fogAppearanceUpdatedAt
      ),
    };
  } catch {
    return null;
  }
}

/**
 * DM seeding policy for the SDK's authoritative bootstrap/reconcile hooks:
 * local-authoritative elements the hub has never seen (DB-loaded seeds,
 * elements added while detached) are preserved and re-pushed through the
 * normal local-upsert path, while hub-known absences are deliberate
 * deletions and stay deleted — a DM reconnect can no longer discard seed
 * elements, and deleted-while-away elements are not resurrected.
 */
const preserveHubUnknown: ResolveLocalOnly = context => ({
  preserve: context.localOnly
    .filter(entry => !entry.hubKnown)
    .map(entry => entry.element.id),
});

/** Parses a server-owned relay poke presence envelope. */
export function pokeFeatureFromEnvelope(raw: string): string | null {
  let env: {
    from?: string;
    op?: { kind?: string; data?: { kind?: string; feature?: unknown } };
  };
  try {
    env = JSON.parse(raw) as typeof env;
  } catch {
    return null;
  }
  if (env?.from !== 'hub') return null;
  const op = env.op;
  if (op?.kind !== 'presence' || op.data?.kind !== 'poke') return null;
  return typeof op.data.feature === 'string' ? op.data.feature : null;
}

/** Transport surface the connection relies on (WebSocketTransport-compatible). */
export type BattleMapTransport = ManagedSyncTransport;

export interface ManagedConnectionOptions {
  relayUrl: string;
  campaignCode: string;
  battleMapId: string;
  store: ElementStore;
  /** MUST equal the userId the token route returns for this role. */
  clientId: string;
  tokenRequest: BattleMapTokenRequest;
  resolveAudience?: (el: CanvasElement) => string | undefined;
  /**
   * DM only: preserve and re-push local elements the hub does not know yet
   * on every bootstrap/reconcile snapshot (SDK `resolveLocalOnly` hooks).
   */
  seedLocal?: boolean;
  /**
   * Opt into versioned layer-definition sync (SDK `layers` option). The hook
   * receives only records that win the deterministic (version, editor)
   * ordering; RollKeeper applies them through history-transparent
   * `LayerManager` `*Direct` calls with role policy overlaid (see
   * `layerSync.ts`). Publishing stays explicit via the returned
   * `publishLayerUpsert`/`publishLayerRemove`.
   */
  layers?: { applyLayer: (update: RemoteLayerUpdate) => void };
  fog?: {
    manager: FogManager;
    preserveLocalWhenRemoteMissing?: boolean;
  };
  onStatus?: (s: BattleMapConnectionStatus) => void;
  /** Receives pre-transport configuration failures for operator UI/logging. */
  onDiagnostic?: (message: string) => void;
  /** Fires when the relay pokes this room (e.g. initiative changed → refetch /shared). */
  onPoke?: (feature: string) => void;
  /** Called with session metadata from each token mint (initial + refreshes). */
  onTokenMetadata?: (meta: {
    fogAppearance?: import('@/types/battlemap').ProjectedFogAppearance;
    fogAppearanceUpdatedAt?: string | null;
  }) => void;
  /** DI seam for tests; defaults to the SDK's WebSocketTransport. */
  transportFactory?: (url: string) => BattleMapTransport;
  /**
   * Table v1 only (R4): the scene the server resolved for a map-pinned
   * player/display surface, and a later change of that resolution. On a
   * change the connection is rebuilt and pending edits are discarded.
   */
  onSceneResolved?: (sceneId: string) => void;
  onSceneChange?: (
    change: import('@/lib/battlemapAuthority').BattleMapSceneChange
  ) => void;
  authorityTransportFactory?: import('@fieldnotes/sync').ManagedAuthorityOptions['transportFactory'];
}

/**
 * Battle-map sync connection: token minting via the campaign token route plus
 * RollKeeper-owned message parsing, layered over the Fieldnotes managed
 * lifecycle (`createManagedSyncConnection`), which owns status transitions,
 * transient reconnect, token refresh after terminal auth closes (4401), and
 * bounded auth retry ending in `denied`.
 */
export interface BattleMapConnection {
  stop: () => void;
  /**
   * Publishes a layer definition edit (stamped and versioned by the SDK).
   * While disconnected the edit lands in the connection's ledger and is
   * re-pushed after the next authoritative snapshot. Throws when the
   * connection was created without the `layers` option.
   */
  publishLayerUpsert: (definition: Layer) => void;
  publishLayerRemove: (id: string) => void;
  /**
   * Sends ephemeral presence to the room (laser trails). Fire-and-forget:
   * dropped — never queued — unless the connection is live, so stale trails
   * cannot replay after a reconnect. Never enters canvas state or the
   * durable operation queue.
   */
  sendPresence: (data: unknown) => void;
  /**
   * Observes room presence. `from` is the relay's server-owned connection id
   * — an opaque per-sender key, NOT a clientId. Hub pokes also arrive here
   * (`from === 'hub'`, `data.kind === 'poke'`); consumers must discriminate
   * on `data.kind`. Handlers survive credential rebuilds. Returns
   * unsubscribe.
   */
  onPresence: (handler: (from: string, data: unknown) => void) => () => void;
  /** Observes presence departures (same `from` key). Returns unsubscribe. */
  onPresenceLeave: (handler: (from: string) => void) => () => void;
  captureBarrier?: () => AuthorityBarrier | null;
  waitForAcknowledgements?: (
    barrier: AuthorityBarrier,
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ) => Promise<AuthorityBarrierResult>;
  requestCheckpoint?: (options?: {
    barrier?: AuthorityBarrier;
    signal?: AbortSignal;
    timeoutMs?: number;
  }) => Promise<AuthorityClientCheckpointResult>;
  releaseBarrier?: (barrier: AuthorityBarrier) => boolean;
}

function inertDeniedConnection(): BattleMapConnection {
  return {
    stop: () => {},
    publishLayerUpsert: () => {},
    publishLayerRemove: () => {},
    sendPresence: () => {},
    onPresence: () => () => {},
    onPresenceLeave: () => () => {},
  };
}

function expectedClientId(opts: ManagedConnectionOptions): string | null {
  if (opts.tokenRequest.battleMapId !== opts.battleMapId) return null;
  if (opts.tokenRequest.role === 'dm') return opts.tokenRequest.dmId ?? null;
  if (opts.tokenRequest.role === 'player') {
    return opts.tokenRequest.playerId ?? null;
  }
  if (opts.tokenRequest.role === 'display')
    return `display-${opts.campaignCode}`;
  return null;
}

export function createManagedBattleMapConnection(
  opts: ManagedConnectionOptions
): BattleMapConnection {
  const expected = expectedClientId(opts);
  if (!isValidClientId(opts.clientId) || opts.clientId !== expected) {
    const message =
      'Live map identity is invalid or does not match the token request. Reopen the map from the campaign.';
    opts.onDiagnostic?.(message);
    opts.onStatus?.('denied');
    return inertDeniedConnection();
  }

  const room = battleMapRelayRoom(opts.campaignCode, opts.battleMapId);
  let stopped = false;
  let legacyAccessDenied = false;

  if (
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED === 'true' &&
    (opts.tokenRequest.kind !== 'location' ||
      opts.tokenRequest.sceneId !== undefined)
  ) {
    return createManagedBattleMapAuthorityConnection({
      ...opts,
      tokenRequest: {
        ...opts.tokenRequest,
        sceneId: opts.tokenRequest.sceneId ?? opts.battleMapId,
        protocols: { fog: 1, authority: 1 },
      },
      mint: mintBattleMapToken,
      transportFactory: opts.authorityTransportFactory,
    });
  }

  const connection = createManagedSyncConnection({
    store: opts.store,
    clientId: opts.clientId,
    resolveAudience: opts.resolveAudience,
    // Seeding rides the SDK's authoritative bootstrap/reconcile hooks: the
    // managed lifecycle persists hub knowledge across credential rebuilds and
    // calls the hook synchronously for every snapshot addressed to us, so no
    // raw-frame parsing or deferred reseeding is needed.
    resolveLocalOnly: opts.seedLocal ? preserveHubUnknown : undefined,
    layers: opts.layers,
    elementRegistry: fieldnotesElementRegistry,
    plugins: opts.fog ? [createFogClientPlugin(opts.fog)] : undefined,
    resolveUrl: async () => {
      const result = await mintBattleMapToken(
        opts.campaignCode,
        opts.tokenRequest
      );
      if (stopped) return null;
      if (!result) {
        legacyAccessDenied = true;
        opts.onDiagnostic?.(
          'Live location access was denied. Reopen the location from the campaign.'
        );
        opts.onStatus?.('denied');
        return null;
      }
      if (result.authority === 1) {
        legacyAccessDenied = true;
        opts.onDiagnostic?.(
          'A location request returned scene authority and was denied.'
        );
        opts.onStatus?.('denied');
        return null;
      }
      if (opts.onTokenMetadata) {
        opts.onTokenMetadata({
          fogAppearance: result.fogAppearance,
          fogAppearanceUpdatedAt: result.fogAppearanceUpdatedAt,
        });
      }
      return `${opts.relayUrl}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(result.token)}`;
    },
    // The released managed lifecycle observes the snapshot on one transport
    // subscription and applies it through SyncClient on the next. Defer only
    // the fog-enabled `live` notification by a microtask so consumers cannot
    // paint an unmasked frame between those two synchronous handlers.
    onStatus: status => {
      if (legacyAccessDenied && status !== 'denied') return;
      if (status === 'live' && opts.fog) {
        queueMicrotask(() => {
          if (!stopped) opts.onStatus?.(status);
        });
      } else {
        opts.onStatus?.(status);
      }
    },
    onTransportMessage: opts.onPoke
      ? raw => {
          const feature = pokeFeatureFromEnvelope(raw);
          if (feature) opts.onPoke?.(feature);
        }
      : undefined,
    transportFactory: opts.transportFactory,
  });

  return {
    stop: (): void => {
      stopped = true;
      connection.stop();
    },
    publishLayerUpsert: (definition: Layer): void => {
      connection.publishLayerUpsert(definition);
    },
    publishLayerRemove: (id: string): void => {
      connection.publishLayerRemove(id);
    },
    sendPresence: (data: unknown): void => {
      connection.sendPresence(data);
    },
    onPresence: (
      handler: (from: string, data: unknown) => void
    ): (() => void) => connection.onPresence(handler),
    onPresenceLeave: (handler: (from: string) => void): (() => void) =>
      connection.onPresenceLeave(handler),
  };
}
