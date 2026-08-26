import type { HubFanout } from '@fieldnotes/sync-server';

function isEphemeralPayload(payload: string): boolean {
  try {
    const value = JSON.parse(payload) as { op?: { kind?: unknown } };
    return value.op?.kind === 'presence' || value.op?.kind === 'presence-leave';
  } catch {
    return false;
  }
}

/**
 * Restricts a shared fan-out to ephemeral traffic. RollKeeper's buffered Redis
 * backend is intentionally memory-first and not a shared canonical backend, so
 * durable operations must not be forwarded across instances until that backend
 * contract is replaced.
 */
export class EphemeralHubFanout implements HubFanout {
  constructor(private readonly inner: HubFanout) {}

  publish(payload: string): void | Promise<void> {
    if (!isEphemeralPayload(payload)) return;
    return this.inner.publish(payload);
  }

  subscribe(handler: (payload: string) => void): () => void {
    return this.inner.subscribe(payload => {
      if (isEphemeralPayload(payload)) handler(payload);
    });
  }

  close(): void {
    this.inner.close?.();
  }
}
