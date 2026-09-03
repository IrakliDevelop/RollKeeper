import {
  attachAwareness,
  isAwarenessPresence,
  PeerRoster,
  RemoteCursorOverlay,
} from '@fieldnotes/core';

import type {
  AwarenessHandle,
  AwarenessIdentity,
  AwarenessPresence,
  AwarenessViewport,
  Peer,
  PresenceChannel,
} from '@fieldnotes/core';

/**
 * Shared-presence wiring (core 0.65.0 awareness) with RollKeeper policy
 * baked in. Awareness traffic is ephemeral presence: never elements, undo
 * history, canvasState/autosave, or the durable queue — and it is
 * room-visible (presence bypasses canRead), so:
 *
 * - `selection` is NEVER published on any surface (DM selections name
 *   dm-only elements) and the SDK selection overlay is never attached;
 * - `tool` is never published (no consumer; quiet by default);
 * - the cursor field is the ONLY per-surface publish policy: DM behind a
 *   session switch (default OFF), players always, display never;
 * - identity on the wire is self-asserted — `name` is untrusted display
 *   text, `role` only steers what a surface DRAWS (never anything
 *   security-relevant).
 *
 * Two books. `roster` is the SDK roster from attachAwareness — every valid
 * peer, the "who is viewing" source. The render book is a RollKeeper-owned
 * PeerRoster that is a PROJECTION of the roster: a sender enters it only
 * while its latest valid frame passes the local role's draw rule AND (for
 * players) the "Show player cursors" switch; a valid frame that fails the
 * rule evicts the sender (a role change never leaves a stale cursor), and
 * flipping the switch re-projects every roster row immediately, so hidden
 * players reappear without waiting for their next frame. One
 * RemoteCursorOverlay draws the render book for the attachment's lifetime.
 */

export type AwarenessRole = 'dm' | 'player' | 'display';

export interface AwarenessSyncIdentity {
  id: string;
  name: string;
  role: AwarenessRole;
}

/** Which peers' cursors a surface draws, keyed by the LOCAL role. */
export const CURSOR_RULES: Record<
  AwarenessRole,
  (peer: AwarenessIdentity) => boolean
> = {
  // DM canvases: players and the DM's other devices. Never unknown roles.
  dm: peer => peer.role === 'dm' || peer.role === 'player',
  // Players see the DM's cursor when the DM shares it — never other players.
  player: peer => peer.role === 'dm',
  // The TV shows the DM's cursor only; the DM's share switch is the control.
  display: peer => peer.role === 'dm',
};

export interface AwarenessSyncOptions {
  identity: AwarenessSyncIdentity;
  /** Publish this client's cursor from attach. DM false, player true, display false. */
  shareCursor: boolean;
  /**
   * Draw PLAYER peers' cursors (the DM viewer switch). DM peers are always
   * drawn where the rule allows.
   */
  showPlayerCursors: boolean;
  colorFor?: (peer: Peer) => string | undefined;
  onError?: (error: unknown) => void;
}

export interface AwarenessSyncHandle {
  /** Who-is-viewing book: every valid peer, whatever the cursor rule. */
  readonly roster: PeerRoster;
  /** The render book — exactly what the cursor overlay draws. */
  cursorPeers(): readonly Peer[];
  announce(): void;
  setShareCursor(enabled: boolean): void;
  setShowPlayerCursors(enabled: boolean): void;
  setIdentity(identity: AwarenessSyncIdentity): void;
  dispose(): void;
}

/** Rebuilds a full-snapshot frame from a roster row (for re-projection). */
function frameOf(peer: Peer): AwarenessPresence {
  return {
    kind: 'awareness',
    id: peer.id,
    ...(peer.name !== undefined ? { name: peer.name } : {}),
    ...(peer.color !== undefined ? { color: peer.color } : {}),
    ...(peer.role !== undefined ? { role: peer.role } : {}),
    ...(peer.cursor !== null ? { cursor: peer.cursor } : {}),
  };
}

function guarded(step: () => void): void {
  try {
    step();
  } catch {
    // Keep unwinding regardless — the documented teardown order completes.
  }
}

export function attachAwarenessSync(
  vp: AwarenessViewport,
  connection: PresenceChannel,
  options: AwarenessSyncOptions
): AwarenessSyncHandle {
  const rule = CURSOR_RULES[options.identity.role];
  let showPlayers = options.showPlayerCursors;
  let disposed = false;

  const drawable = (peer: AwarenessIdentity): boolean =>
    rule(peer) && (showPlayers || peer.role !== 'player');

  // Render book: staleness DISABLED (`staleMs: 0`, the documented switch) —
  // the SDK roster is the single liveness authority (its onLeave drives every
  // removal below), so the two books can never disagree about who is alive.
  const renderBook = new PeerRoster({ staleMs: 0 });
  let handle: AwarenessHandle | null = null;
  let overlay: RemoteCursorOverlay | null = null;
  const unsubscribers: (() => void)[] = [];

  // Identity dedupe. The roster is keyed by socket (`from`); one app identity
  // can own several sockets at once (two tabs; a reconnect whose old socket
  // lingers until stale because a restarted relay sends no presence-leave).
  // Exactly one socket per id draws: the NEWEST socket to appear for that id.
  // Frames from older sockets never draw and never flip the winner; when the
  // winner leaves, the previous socket's latest roster state is restored.
  const socketsById = new Map<string, string[]>(); // appearance order; last = winner
  const idByFrom = new Map<string, string>();
  const winnerOf = (id: string): string | undefined =>
    socketsById.get(id)?.at(-1);

  // `remove`, not a `cleared` apply: a cleared frame deliberately keeps the
  // roster's discovery entry (re-announce budget), which this private
  // projection never needs and — with staleness off — would otherwise keep
  // one entry per historical winning socket until dispose. `remove` drops
  // both the row and the discovery entry.
  const evictRow = (from: string): void => {
    if (renderBook.getPeer(from)) renderBook.remove(from);
  };

  const drawIfAllowed = (from: string, frame: AwarenessPresence): void => {
    if (drawable(frame)) renderBook.apply(from, frame);
    else evictRow(from);
  };

  /** A socket is gone for this id (cleared / left / stale / re-identified). */
  const dropSocket = (from: string, id: string): void => {
    evictRow(from);
    if (idByFrom.get(from) === id) idByFrom.delete(from);
    const list = socketsById.get(id);
    if (!list) return;
    const wasWinner = list.at(-1) === from;
    const next = list.filter(f => f !== from);
    if (next.length === 0) socketsById.delete(id);
    else socketsById.set(id, next);
    const fallbackFrom = next.at(-1);
    if (!wasWinner || fallbackFrom === undefined || !handle) return;
    const fallback = handle.roster.getPeer(fallbackFrom);
    if (fallback) drawIfAllowed(fallback.from, frameOf(fallback));
  };

  /** Registers `from` under `id`; a newly appeared socket becomes the winner. */
  const noteSocket = (from: string, id: string): void => {
    const previousId = idByFrom.get(from);
    if (previousId !== undefined && previousId !== id)
      dropSocket(from, previousId);
    idByFrom.set(from, id);
    const list = socketsById.get(id) ?? [];
    if (!list.includes(from)) {
      list.push(from);
      socketsById.set(id, list);
      // The newcomer wins: the former winner's row leaves the render book.
      for (const other of list) if (other !== from) evictRow(other);
    }
  };

  /** Latest valid frame from `from`: draw it if it is the winner and allowed, else evict. */
  const project = (from: string, frame: AwarenessPresence): void => {
    if (frame.cleared === true) {
      dropSocket(from, frame.id);
      return;
    }
    noteSocket(from, frame.id);
    if (winnerOf(frame.id) !== from) {
      evictRow(from);
      return;
    }
    drawIfAllowed(from, frame);
  };

  const reproject = (): void => {
    if (!handle) return;
    for (const peer of handle.roster.getPeers())
      project(peer.from, frameOf(peer));
  };

  const unwind = (): void => {
    for (let i = unsubscribers.length - 1; i >= 0; i--) {
      const unsubscribe = unsubscribers[i];
      if (unsubscribe) guarded(unsubscribe);
    }
    unsubscribers.length = 0;
    guarded(() => overlay?.dispose());
    overlay = null;
    guarded(() => renderBook.dispose());
    // Last: the SDK publisher sends `cleared` over the (still live) channel.
    guarded(() => handle?.dispose());
  };

  try {
    handle = attachAwareness(vp, connection, {
      identity: options.identity,
      fields: { cursor: options.shareCursor, selection: false, tool: false },
      selections: false,
      cursors: false,
      publish: true,
      onError: options.onError,
    });
    // Departures come from the SDK roster (cleared / presence-leave / stale),
    // registered BEFORE our presence handler so a `cleared` frame is dropped
    // from the render book before it is re-examined.
    unsubscribers.push(
      handle.roster.onLeave(peer => dropSocket(peer.from, peer.id))
    );
    unsubscribers.push(
      connection.onPresence((from, data) => {
        if (isAwarenessPresence(data)) project(from, data);
      })
    );
    overlay = new RemoteCursorOverlay(
      vp,
      renderBook,
      options.colorFor ? { colorFor: options.colorFor } : {}
    );
  } catch (error) {
    unwind();
    throw error;
  }

  const attached = handle;
  return {
    roster: attached.roster,
    cursorPeers: () => renderBook.getPeers(),
    announce: () => {
      if (!disposed) attached.announce();
    },
    setShareCursor: enabled => {
      if (!disposed) attached.setFields({ cursor: enabled });
    },
    setShowPlayerCursors: enabled => {
      if (disposed || enabled === showPlayers) return;
      showPlayers = enabled;
      reproject();
    },
    setIdentity: identity => {
      if (!disposed) attached.local?.setIdentity(identity);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unwind();
    },
  };
}
