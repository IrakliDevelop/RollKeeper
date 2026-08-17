import type { AutomaticSyncRunResult } from './automaticCharacterSyncWorker';

export type AutomaticSyncPullReason =
  | 'startup'
  | 'focus'
  | 'reconnect'
  | 'manual-refresh'
  | 'successful-push'
  | 'invalidation';

interface BroadcastWakeChannel {
  addEventListener(type: 'message', listener: () => void): void;
  removeEventListener(type: 'message', listener: () => void): void;
  close?(): void;
}

interface CoordinatorOptions {
  featureEnabled: boolean;
  hasParticipants(): Promise<boolean>;
  runOnce(): Promise<AutomaticSyncRunResult>;
  pull(reason: AutomaticSyncPullReason): Promise<void>;
  events: EventTarget;
  broadcastChannel?: BroadcastWakeChannel | null;
}

export class AutomaticCharacterSyncCoordinator {
  private active = false;
  private pending: Promise<void> = Promise.resolve();

  private readonly onFocus = () => this.enqueuePullAndDrain('focus');
  private readonly onOnline = () => this.enqueuePullAndDrain('reconnect');
  private readonly onInvalidation = () =>
    this.enqueuePullAndDrain('invalidation');
  private readonly onBroadcast = () => {
    void this.wake();
  };

  constructor(private readonly options: CoordinatorOptions) {}

  async start(): Promise<void> {
    if (!this.options.featureEnabled || this.active) return;
    this.active = true;
    this.options.events.addEventListener('focus', this.onFocus);
    this.options.events.addEventListener('online', this.onOnline);
    this.options.events.addEventListener(
      'automatic-sync-invalidation',
      this.onInvalidation
    );
    this.options.broadcastChannel?.addEventListener(
      'message',
      this.onBroadcast
    );
    if (!(await this.options.hasParticipants())) return;
    await this.schedule(async () => {
      await this.options.pull('startup');
      await this.drain();
    });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.options.events.removeEventListener('focus', this.onFocus);
    this.options.events.removeEventListener('online', this.onOnline);
    this.options.events.removeEventListener(
      'automatic-sync-invalidation',
      this.onInvalidation
    );
    this.options.broadcastChannel?.removeEventListener(
      'message',
      this.onBroadcast
    );
    this.options.broadcastChannel?.close?.();
  }

  async wake(): Promise<void> {
    if (!this.active || !(await this.options.hasParticipants())) return;
    await this.schedule(() => this.drain());
  }

  async manualRefresh(): Promise<void> {
    if (!this.active || !(await this.options.hasParticipants())) return;
    await this.schedule(async () => {
      await this.options.pull('manual-refresh');
      await this.drain();
    });
  }

  settle(): Promise<void> {
    return this.pending;
  }

  private enqueuePullAndDrain(reason: AutomaticSyncPullReason): void {
    if (!this.active) return;
    void this.schedule(async () => {
      if (!(await this.options.hasParticipants())) return;
      await this.options.pull(reason);
      await this.drain();
    });
  }

  private schedule(operation: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(operation, operation).catch(() => {
      // Durable work remains in IndexedDB and is rediscovered by the next wake.
    });
    return this.pending;
  }

  private async drain(): Promise<void> {
    if (!this.active) return;
    for (;;) {
      const result = await this.options.runOnce();
      if (result === 'synced') {
        await this.options.pull('successful-push');
        continue;
      }
      if (result === 'idle' || result === 'disabled') return;
      if (result !== 'conflict') return;
      // A conflict pauses only its aggregate; continue looking for other work.
    }
  }
}
