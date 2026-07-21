import {
  mintBattleMapToken,
  pokeFeatureFromEnvelope,
  type BattleMapTokenRequest,
} from '@/lib/battlemapSync';

export interface PokeListenerOptions {
  campaignCode: string;
  battleMapId: string;
  tokenRequest:
    | { role: 'player'; playerId: string }
    | { role: 'dm'; dmId: string };
  onPoke: (feature: string) => void;
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;
const PROACTIVE_REFRESH_MS = 4 * 60 * 1000;

/**
 * Starts a read-only relay socket that only surfaces poke envelopes to
 * non-canvas pages. No SyncClient, no store, no sends — this is deliberately
 * much simpler than `createManagedBattleMapConnection`: every non-poke
 * message (element ops, snapshots, presence) is silently ignored.
 *
 * Best-effort throughout: never throws, silent on failure. Polling remains
 * the source-of-truth guarantee; this only shaves latency. Returns stop().
 */
export function createBattleMapPokeListener(
  opts: PokeListenerOptions
): () => void {
  let stopped = false;
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let attempt = 0;
  let lastUrl: string | null = null;
  // Each fresh token gets exactly one same-token reconnect attempt before
  // the next transient close forces a re-mint.
  let usedSameTokenRetry = false;

  const room = `${opts.campaignCode}:${opts.battleMapId}`;

  const clearRetryTimer = (): void => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const teardownSocket = (): void => {
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close();
    socket = null;
  };

  const openSocket = (url: string): void => {
    if (stopped) return;
    lastUrl = url;
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = (): void => {
      attempt = 0;
    };
    ws.onmessage = (event: MessageEvent): void => {
      const raw = typeof event.data === 'string' ? event.data : '';
      const feature = pokeFeatureFromEnvelope(raw);
      if (feature) opts.onPoke(feature);
    };
    ws.onclose = (event: CloseEvent): void => {
      if (stopped) return;
      socket = null;
      const fatal = event.code >= 4000 && event.code <= 4999;
      if (!fatal && !usedSameTokenRetry) {
        // Transient close, first time on this token: retry the same URL.
        usedSameTokenRetry = true;
        scheduleRetry(() => {
          if (lastUrl) openSocket(lastUrl);
        });
      } else {
        // Fatal (incl. 4401 expiry), or a second consecutive transient
        // close on this token: mint a fresh token and rebuild.
        usedSameTokenRetry = false;
        scheduleRetry(() => void connect());
      }
    };
  };

  const scheduleRetry = (run: () => void): void => {
    if (stopped) return;
    const delay = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
    attempt += 1;
    clearRetryTimer();
    retryTimer = setTimeout(run, delay);
  };

  const connect = async (): Promise<void> => {
    if (stopped) return;
    const relayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    if (!relayUrl) {
      scheduleRetry(() => void connect());
      return;
    }
    const token = await mintBattleMapToken(opts.campaignCode, {
      ...opts.tokenRequest,
      battleMapId: opts.battleMapId,
    } as BattleMapTokenRequest);
    if (stopped) return;
    if (!token) {
      scheduleRetry(() => void connect());
      return;
    }
    const url = `${relayUrl}?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
    openSocket(url);
  };

  const rebuild = (): void => {
    if (stopped) return;
    clearRetryTimer();
    teardownSocket();
    attempt = 0;
    usedSameTokenRetry = false;
    void connect();
  };

  void connect();
  refreshTimer = setInterval(rebuild, PROACTIVE_REFRESH_MS);

  return (): void => {
    if (stopped) return;
    stopped = true;
    clearRetryTimer();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    teardownSocket();
  };
}
