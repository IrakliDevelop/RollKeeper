import {
  createManagedSyncConnection,
  type ManagedSyncStatus,
  type ManagedSyncTransport,
  type RemoteLayerUpdate,
  type ResolveLocalOnly,
} from '@fieldnotes/sync';
import type {
  ElementStore,
  CanvasElement,
  FogManager,
  Layer,
} from '@fieldnotes/core';
import type { BattleMapRole } from '@/lib/battlemapToken';

export type { RemoteLayerUpdate };

export type BattleMapConnectionStatus = ManagedSyncStatus;

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

export function isValidClientId(id: string): boolean {
  return id.length >= 1 && id.length <= 128 && PRINTABLE_ASCII.test(id);
}

export interface BattleMapTokenRequest {
  role: BattleMapRole;
  battleMapId: string;
  dmId?: string;
  playerId?: string;
  displayKey?: string;
  protocols?: { fog?: 1 };
}

export async function mintBattleMapToken(
  campaignCode: string,
  req: BattleMapTokenRequest
): Promise<string | null> {
  try {
    const res = await fetch(`/api/campaign/${campaignCode}/battlemap-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, protocols: { fog: 1 } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
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
  /** Fires when the relay pokes this room (e.g. initiative changed → refetch /shared). */
  onPoke?: (feature: string) => void;
  /** DI seam for tests; defaults to the SDK's WebSocketTransport. */
  transportFactory?: (url: string) => BattleMapTransport;
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
}

export function createManagedBattleMapConnection(
  opts: ManagedConnectionOptions
): BattleMapConnection {
  if (!isValidClientId(opts.clientId)) {
    throw new Error(
      `Invalid battle map clientId: must be 1-128 printable ASCII characters`
    );
  }

  const room = `${opts.campaignCode}:${opts.battleMapId}`;

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
    fog: opts.fog,
    resolveUrl: async () => {
      const token = await mintBattleMapToken(
        opts.campaignCode,
        opts.tokenRequest
      );
      if (!token) return null;
      return `${opts.relayUrl}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
    },
    onStatus: opts.onStatus,
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
