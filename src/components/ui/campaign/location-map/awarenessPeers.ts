import type { Peer } from '@fieldnotes/core';

export type PeerSummaryRole = 'dm' | 'player' | 'display' | 'unknown';

export interface PeerSummary {
  id: string;
  /** Untrusted wire text — render only as a React text node. */
  name: string;
  role: PeerSummaryRole;
  hasCursor: boolean;
  /** Player rows: id present in the DM's /players directory. Others: true. */
  verified: boolean;
}

const ROLE_ORDER: Record<PeerSummaryRole, number> = {
  dm: 0,
  player: 1,
  display: 2,
  unknown: 3,
};

function roleOf(peer: Peer): PeerSummaryRole {
  return peer.role === 'dm' || peer.role === 'player' || peer.role === 'display'
    ? peer.role
    : 'unknown';
}

/**
 * Roster rows are keyed by the relay's per-socket `from`; a reconnect yields
 * a second row for the same app id until the old socket leaves or goes
 * stale. Dedupe by `id`, newest row (later in roster order) wins.
 */
export function summarizePeers(
  peers: readonly Peer[],
  knownPlayerIds: ReadonlySet<string> | null
): PeerSummary[] {
  const byId = new Map<string, Peer>();
  for (const peer of peers) byId.set(peer.id, peer);
  const rows: PeerSummary[] = [];
  for (const peer of byId.values()) {
    const role = roleOf(peer);
    rows.push({
      id: peer.id,
      name: peer.name ?? '',
      role,
      hasCursor: peer.cursor !== null,
      verified:
        role === 'player' ? (knownPlayerIds?.has(peer.id) ?? false) : true,
    });
  }
  rows.sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
  );
  return rows;
}
