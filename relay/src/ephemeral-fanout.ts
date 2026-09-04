import type { HubFanout } from '@fieldnotes/sync-server';

function isFanoutAllowed(payload: string): boolean {
  try {
    const value = JSON.parse(payload) as { op?: { kind?: unknown } };
    const kind = value.op?.kind;
    return (
      kind === 'presence' ||
      kind === 'presence-leave' ||
      kind === 'fog-meta' ||
      kind === 'fog-patch'
    );
  } catch {
    return false;
  }
}

/**
 * Restricts a shared fan-out to ephemeral and fog traffic. RollKeeper's
 * buffered Redis backend is memory-first for element ops, so durable element
 * operations must not be forwarded. Fog ops are delegated synchronously to a
 * shared RedisHubBackend, so they are safe for multi-instance fan-out.
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
