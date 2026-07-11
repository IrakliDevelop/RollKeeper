import type { SyncHub } from '@fieldnotes/sync-server';

type BroadcastPresence = (conn: unknown, from: string, data: unknown) => void;

/** Narrow structural view of the hub's private presence broadcaster —
 * same private-access pattern as `corrections.ts` / `poke.ts`. */
interface HubWithPresence {
  broadcastPresence: BroadcastPresence;
}

/**
 * `@`-prefixed presence senders are RESERVED for server-originated messages
 * (the /poke endpoint). The vendored hub relays client presence verbatim
 * with no `from` validation, so any room member could forge `@poke` nudges.
 * Drop them here. Server pokes are unaffected: `pokeRoom` writes directly
 * to sockets and never passes through `broadcastPresence`.
 * Remove if @fieldnotes/sync-server gains sender validation upstream.
 */
export function patchReservedPresenceSenders(hub: SyncHub): void {
  const h = hub as unknown as HubWithPresence;
  const original = h.broadcastPresence.bind(hub);
  h.broadcastPresence = (conn, from, data) => {
    if (typeof from === 'string' && from.startsWith('@')) return;
    original(conn, from, data);
  };
}
