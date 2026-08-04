import {
  createManagedSyncConnection,
  type ManagedSyncStatus,
  type ManagedSyncTransport,
} from '@fieldnotes/sync';
import type { ElementStore, CanvasElement } from '@fieldnotes/core';
import type { BattleMapRole } from '@/lib/battlemapToken';

export type BattleMapConnectionStatus = ManagedSyncStatus;

export interface BattleMapTokenRequest {
  role: BattleMapRole;
  battleMapId: string;
  dmId?: string;
  playerId?: string;
  displayKey?: string;
}

export async function mintBattleMapToken(
  campaignCode: string,
  req: BattleMapTokenRequest
): Promise<string | null> {
  try {
    const res = await fetch(`/api/campaign/${campaignCode}/battlemap-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

/** Local elements the hub doesn't know about yet (must be pushed by us). */
export function computeSeedIds(
  local: CanvasElement[],
  presentIds: Set<string>
): string[] {
  return local.filter(el => !presentIds.has(el.id)).map(el => el.id);
}

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
  /** DM only: push local elements missing from each snapshot. */
  seedLocal?: boolean;
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
export function createManagedBattleMapConnection(
  opts: ManagedConnectionOptions
): { stop: () => void } {
  let stopped = false;
  const room = `${opts.campaignCode}:${opts.battleMapId}`;

  // Handles EVERY snapshot addressed to us (not just the first): on a
  // transport-internal reconnect SyncClient re-requests a snapshot and runs a
  // destructive reconcile that deletes local elements absent from the hub —
  // each resync needs a fresh reseed or those elements are lost. This runs on
  // the raw frame BEFORE the SyncClient applies the merge (the managed
  // lifecycle subscribes onTransportMessage first), so local state is captured
  // synchronously and the deferred seed runs after the merge/reconcile.
  // Temporary workaround until Fieldnotes ships explicit
  // authoritative-bootstrap/reconcile hooks.
  const seedFromSnapshot = (raw: string): void => {
    let env: {
      from?: string;
      op?: { kind?: string; to?: string; elements?: { id: string }[] };
    };
    try {
      env = JSON.parse(raw) as typeof env;
    } catch {
      return; // non-JSON frame — ignore
    }
    const op = env?.op;
    if (!op || op.kind !== 'snapshot') return;
    // Snapshots are addressed; ignore ones targeted at other clients.
    if (op.to !== opts.clientId) return;
    // Capture local state SYNCHRONOUSLY, before SyncClient's own handler
    // (subscribed after us) applies the merge/reconcile for this snapshot.
    const localBefore = opts.store.snapshot();
    const present = new Set((op.elements ?? []).map(e => e.id));
    setTimeout(() => {
      if (stopped) return;
      const missing = new Set(computeSeedIds(localBefore, present));
      for (const el of localBefore) {
        if (!missing.has(el.id)) continue;
        if (opts.store.getById(el.id)) {
          // no-op update re-emits the element as a local upsert
          opts.store.update(el.id, {});
        } else {
          // reconcile just deleted it — re-adding re-emits it as a
          // local upsert so it gets pushed back to the hub
          opts.store.add(el);
        }
      }
    }, 0);
  };

  const connection = createManagedSyncConnection({
    store: opts.store,
    clientId: opts.clientId,
    resolveAudience: opts.resolveAudience,
    resolveUrl: async () => {
      const token = await mintBattleMapToken(
        opts.campaignCode,
        opts.tokenRequest
      );
      if (!token) return null;
      return `${opts.relayUrl}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
    },
    onStatus: opts.onStatus,
    onTransportMessage:
      opts.seedLocal || opts.onPoke
        ? raw => {
            if (opts.seedLocal) seedFromSnapshot(raw);
            if (opts.onPoke) {
              const feature = pokeFeatureFromEnvelope(raw);
              if (feature) opts.onPoke(feature);
            }
          }
        : undefined,
    transportFactory: opts.transportFactory,
  });

  return {
    stop: (): void => {
      stopped = true;
      connection.stop();
    },
  };
}
