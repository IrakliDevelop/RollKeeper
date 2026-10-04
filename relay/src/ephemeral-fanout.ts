import type { HubFanout } from '@fieldnotes/sync-server';

function isFanoutAllowed(payload: string): boolean {
  if (Buffer.byteLength(payload, 'utf8') > 1024) return false;
  try {
    const value = JSON.parse(payload) as {
      authority?: unknown;
      room?: unknown;
      definitionId?: unknown;
      position?: unknown;
      op?: { kind?: unknown };
    };
    const kind = value.op?.kind;
    if (
      kind === 'presence' ||
      kind === 'presence-leave' ||
      kind === 'fog-meta' ||
      kind === 'fog-patch'
    )
      return true;
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length !== 4 ||
      value.authority !== 1 ||
      typeof value.room !== 'string' ||
      !/^[A-Za-z0-9_-]{1,64}$/u.test(value.room) ||
      typeof value.definitionId !== 'string' ||
      value.definitionId.length === 0 ||
      value.definitionId.length > 128 ||
      typeof value.position !== 'object' ||
      value.position === null ||
      Array.isArray(value.position)
    )
      return false;
    const position = value.position as Record<string, unknown>;
    return (
      Object.keys(position).length === 2 &&
      typeof position.generation === 'string' &&
      position.generation.length > 0 &&
      position.generation.length <= 128 &&
      typeof position.revision === 'string' &&
      position.revision.length > 0 &&
      position.revision.length <= 128
    );
  } catch {
    return false;
  }
}

/**
 * Restricts a shared fan-out to ephemeral/fog traffic and the SDK's exact
 * validated authority wake shape. RollKeeper's buffered Redis backend is
 * memory-first for legacy element ops, so those durable operations must not be
 * forwarded. Fog ops and authority wakes are backed by shared Redis state and
 * are safe for multi-instance fan-out.
 */
export class EphemeralHubFanout implements HubFanout {
  constructor(private readonly inner: HubFanout) {}

  publish(payload: string): void | Promise<void> {
    if (!isFanoutAllowed(payload)) return;
    return this.inner.publish(payload);
  }

  subscribe(handler: (payload: string) => void): () => void {
    return this.inner.subscribe(payload => {
      if (isFanoutAllowed(payload)) handler(payload);
    });
  }

  close(): void {
    this.inner.close?.();
  }
}
