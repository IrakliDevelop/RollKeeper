import type {
  CanRead,
  Connection,
  OwnedElement,
  SyncHub,
} from '@fieldnotes/sync-server';
import type { SyncEnvelope, SyncOp } from '@fieldnotes/sync';

type SendCorrection = (
  conn: Connection,
  from: string,
  op: SyncOp,
  current: OwnedElement | undefined
) => Promise<void>;

/** Narrow structural view of the hub's private `sendCorrection` method. */
interface HubWithSendCorrection {
  sendCorrection: SendCorrection;
}

/**
 * Filters an outbound correction envelope through `canRead` from `conn`'s
 * point of view. Only the two correction shapes that can carry element bytes
 * need handling:
 *  - `snapshot` (rejected `clear`): drop any element `conn` may not read.
 *  - `upsert` (rejected `upsert`/`remove` echoing the current element): if
 *    `conn` may not read it, `conn` should not know it exists at all — send
 *    a `remove` instead of the element's bytes.
 * A `remove` correction never carries bytes, so it passes through unchanged.
 */
function filterCorrectionMessage(
  message: string,
  conn: Connection,
  canRead: CanRead
): string {
  let envelope: SyncEnvelope;
  try {
    envelope = JSON.parse(message) as SyncEnvelope;
  } catch {
    return message;
  }
  const op = envelope.op;
  const mayRead = (audience: string | undefined): boolean =>
    canRead({
      userId: conn.userId,
      role: conn.role,
      room: conn.room,
      audience,
    });

  if (op.kind === 'snapshot') {
    const elements = op.elements as OwnedElement[];
    const filtered = elements.filter(el => mayRead(el.audience));
    if (filtered.length === elements.length) return message;
    return JSON.stringify({
      ...envelope,
      op: { ...op, elements: filtered },
    });
  }

  if (op.kind === 'upsert') {
    const element = op.element as OwnedElement;
    if (mayRead(element.audience)) return message;
    return JSON.stringify({
      ...envelope,
      op: { kind: 'remove', id: element.id },
    });
  }

  return message;
}

/**
 * Upstream bug in @fieldnotes/sync-server 0.8.0: `SyncHub.sendCorrection`
 * sends rejected-op corrections WITHOUT `canRead` filtering —
 *  - a denied `clear` returns `{ kind: 'snapshot', elements }` built from
 *    `backend.snapshot(room)`, i.e. the FULL room including `audience: 'dm'`
 *    elements;
 *  - a denied `upsert`/`remove` of an existing element echoes back
 *    `{ kind: 'upsert', element: current }` with that element's raw bytes,
 *    regardless of whether the requester may read it.
 * Either path lets any non-DM connection exfiltrate DM-hidden elements by
 * simply sending an op the authorizer will reject (e.g. any `clear`). This
 * wrapper re-applies the relay's own `canRead` rule to whatever
 * `sendCorrection` is about to send, on the connection it was addressed to.
 * Remove this once @fieldnotes/sync-server filters corrections itself.
 */
export function patchSendCorrectionLeak(hub: SyncHub, canRead: CanRead): void {
  const target = hub as unknown as HubWithSendCorrection;
  const original = target.sendCorrection.bind(target);

  target.sendCorrection = async (conn, from, op, current) => {
    const realSend = conn.send.bind(conn);
    const filteringConn: Connection = {
      ...conn,
      send: (message: string) =>
        realSend(filterCorrectionMessage(message, conn, canRead)),
    };
    return original(filteringConn, from, op, current);
  };
}
