import { SyncClient, WebSocketTransport } from '@fieldnotes/sync';
import type { ElementStore, CanvasElement } from '@fieldnotes/core';
import type { BattleMapRole } from '@/lib/battlemapToken';

export type BattleMapConnectionStatus =
  | 'connecting'
  | 'live'
  | 'offline'
  | 'denied';

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

export interface ManagedConnectionOptions {
  relayUrl: string;
  campaignCode: string;
  battleMapId: string;
  store: ElementStore;
  /** MUST equal the userId the token route returns for this role. */
  clientId: string;
  tokenRequest: BattleMapTokenRequest;
  resolveAudience?: (el: CanvasElement) => string | undefined;
  /** DM only: push local elements missing from the first snapshot. */
  seedLocal?: boolean;
  onStatus?: (s: BattleMapConnectionStatus) => void;
}

const MAX_AUTH_FAILURES = 4;
const RETRY_CAP_MS = 15000;

/**
 * Owns the mint-token → transport → SyncClient lifecycle.
 * WebSocketTransport's URL (and its embedded token) is frozen at construction
 * and app-range close codes (4000-4999) terminate it, so token rotation and
 * auth retries require tearing down and rebuilding both transport and client.
 * Transient network drops are left to the transport's built-in reconnect.
 */
export function createManagedBattleMapConnection(
  opts: ManagedConnectionOptions
): { stop: () => void } {
  let stopped = false;
  let client: SyncClient | null = null;
  let transport: WebSocketTransport | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let authFailures = 0;
  const room = `${opts.campaignCode}:${opts.battleMapId}`;

  const scheduleRetry = (): void => {
    if (stopped) return;
    opts.onStatus?.('offline');
    const delay = Math.min(RETRY_CAP_MS, 1000 * 2 ** Math.min(attempt, 4));
    attempt += 1;
    retryTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async (): Promise<void> => {
    if (stopped) return;
    opts.onStatus?.('connecting');
    const token = await mintBattleMapToken(
      opts.campaignCode,
      opts.tokenRequest
    );
    if (stopped) return;
    if (!token) {
      scheduleRetry();
      return;
    }

    const url = `${opts.relayUrl}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
    const t = new WebSocketTransport(url);
    transport = t;

    let sawSnapshot = false;
    // Subscribed BEFORE client.start() so this handler runs first;
    // the deferred seed then runs after SyncClient has applied the merge.
    const unsubMsg = t.onMessage(raw => {
      if (sawSnapshot) return;
      try {
        const msg = JSON.parse(raw) as {
          kind?: string;
          elements?: { id: string }[];
        };
        if (msg.kind !== 'snapshot') return;
        sawSnapshot = true;
        attempt = 0;
        authFailures = 0;
        opts.onStatus?.('live');
        if (opts.seedLocal) {
          const present = new Set((msg.elements ?? []).map(e => e.id));
          setTimeout(() => {
            if (stopped) return;
            for (const id of computeSeedIds(opts.store.snapshot(), present)) {
              // no-op update re-emits the element as a local upsert
              opts.store.update(id, {});
            }
          }, 0);
        }
      } catch {
        // non-JSON frame — ignore
      }
    });

    t.onReconnect(() => {
      if (!stopped) opts.onStatus?.('live');
    });

    t.onClose(code => {
      if (stopped) return;
      if (code >= 4000 && code <= 4999) {
        // transport is now terminated — rebuild with a fresh token
        unsubMsg();
        client?.stop();
        client = null;
        transport = null;
        if (code === 4401) {
          authFailures += 1;
          if (authFailures >= MAX_AUTH_FAILURES) {
            opts.onStatus?.('denied');
            return;
          }
        }
        scheduleRetry();
      } else {
        // transport auto-reconnects with the same (frozen) token; if that
        // token has expired the server will 4401 us into the branch above.
        opts.onStatus?.('offline');
      }
    });

    client = new SyncClient({
      store: opts.store,
      transport: t,
      clientId: opts.clientId,
      resolveAudience: opts.resolveAudience,
    });
    client.start();
  };

  void connect();

  return {
    stop: (): void => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      client?.stop();
      transport?.close();
      client = null;
      transport = null;
    },
  };
}
