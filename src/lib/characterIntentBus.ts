import { TAB_ID } from '@/lib/tabIdentity';

export interface CharacterIntent {
  type: 'intent';
  opId: string;
  tabId: string;
  seq: number;
  characterId: string;
  actionName: string;
  args: unknown[];
}
export interface IntentAck {
  type: 'ack';
  tabId: string;
  seq: number;
  characterId: string;
}
export interface LeaderAnnounce {
  type: 'leader';
  characterId: string;
  tabId: string;
  epoch: number;
}
type BusMessage = CharacterIntent | IntentAck | LeaderAnnounce;

export interface BroadcastChannelLike {
  postMessage: (data: unknown) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface IntentBusDeps {
  isLeader: (characterId: string) => boolean;
  getLoadedCharacterId: () => string;
  /** Highest contiguously applied seq for a character and sender tab. */
  getWatermark: (characterId: string, tabId: string) => number;
  /** Executes the action under intent context; MUST leave the watermark advanced. */
  applyIntent: (intent: CharacterIntent) => void;
}

const CHANNEL_NAME = 'rk-character-intents';
const RETRY_INTERVAL_MS = 2000;

const newOpId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `op-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

export class CharacterIntentBus {
  private channel: BroadcastChannelLike | null = null;
  private seqByCharacter = new Map<string, number>();
  private pendingByCharacter = new Map<string, CharacterIntent[]>();
  /** Leader-side out-of-order holding pen, keyed by character + sender tab. */
  private gapBuffer = new Map<string, CharacterIntent[]>();
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private deps: IntentBusDeps,
    private createChannel?: () => BroadcastChannelLike
  ) {}

  start(): void {
    if (this.channel) return;
    if (this.createChannel) {
      this.channel = this.createChannel();
    } else if (
      typeof window !== 'undefined' &&
      typeof BroadcastChannel !== 'undefined'
    ) {
      this.channel = new BroadcastChannel(
        CHANNEL_NAME
      ) as unknown as BroadcastChannelLike;
    } else {
      return; // SSR / unsupported: bus inert, lock fallback keeps solo-leader behavior
    }
    this.channel.onmessage = event => this.onMessage(event.data as BusMessage);
    this.retryTimer = setInterval(
      () => this.resendAllPending(),
      RETRY_INTERVAL_MS
    );
  }

  stop(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = null;
    this.channel?.close();
    this.channel = null;
  }

  /** Follower path: queue + publish an intent for a character. */
  send(characterId: string, actionName: string, args: unknown[]): void {
    const seq = (this.seqByCharacter.get(characterId) ?? 0) + 1;
    this.seqByCharacter.set(characterId, seq);
    const intent: CharacterIntent = {
      type: 'intent',
      opId: newOpId(),
      tabId: TAB_ID,
      seq,
      characterId,
      actionName,
      args,
    };
    const queue = this.pendingByCharacter.get(characterId) ?? [];
    queue.push(intent);
    this.pendingByCharacter.set(characterId, queue);
    this.channel?.postMessage(intent);
  }

  announceLeadership(characterId: string): void {
    const announce: LeaderAnnounce = {
      type: 'leader',
      characterId,
      tabId: TAB_ID,
      epoch: Date.now(),
    };
    this.channel?.postMessage(announce);
  }

  /** Promotion: BC never delivers a sender's messages back to itself, so a
   * promoted tab must apply its own still-pending intents directly, in seq
   * order, against the hydrated watermarks. */
  reconcileOwnPending(characterId: string): void {
    const queue = this.pendingByCharacter.get(characterId) ?? [];
    this.pendingByCharacter.set(characterId, []);
    for (const intent of queue) {
      this.intakeAsLeader(intent, { ack: false });
    }
  }

  private onMessage(message: BusMessage): void {
    if (message.type === 'intent') {
      if (this.deps.isLeader(message.characterId)) {
        this.intakeAsLeader(message, { ack: true });
      }
      return;
    }
    if (message.type === 'ack') {
      if (message.tabId !== TAB_ID) return;
      const queue = this.pendingByCharacter.get(message.characterId) ?? [];
      this.pendingByCharacter.set(
        message.characterId,
        queue.filter(intent => intent.seq > message.seq)
      );
      return;
    }
    // 'leader'
    if (message.tabId === TAB_ID) return;
    this.resendPendingFor(message.characterId);
  }

  private intakeAsLeader(
    intent: CharacterIntent,
    opts: { ack: boolean }
  ): void {
    if (this.deps.getLoadedCharacterId() !== intent.characterId) return;
    const watermark = this.deps.getWatermark(intent.characterId, intent.tabId);
    if (intent.seq <= watermark) {
      if (opts.ack) this.ack(intent); // duplicate retry — re-ack
      return;
    }
    if (intent.seq > watermark + 1) {
      const gapKey = this.gapKey(intent.characterId, intent.tabId);
      const buffered = this.gapBuffer.get(gapKey) ?? [];
      if (!buffered.some(b => b.seq === intent.seq)) {
        buffered.push(intent);
        buffered.sort((a, b) => a.seq - b.seq);
        this.gapBuffer.set(gapKey, buffered);
      }
      return; // wait for the sender's ordered re-send to fill the gap
    }
    this.deps.applyIntent(intent);
    if (opts.ack) this.ack(intent);
    this.drainGapBuffer(intent.characterId, intent.tabId, opts);
  }

  private drainGapBuffer(
    characterId: string,
    tabId: string,
    opts: { ack: boolean }
  ): void {
    const buffered = this.gapBuffer.get(this.gapKey(characterId, tabId));
    if (!buffered?.length) return;
    while (buffered.length > 0) {
      const next = buffered[0];
      if (next.seq !== this.deps.getWatermark(characterId, tabId) + 1) break;
      buffered.shift();
      this.deps.applyIntent(next);
      if (opts.ack) this.ack(next);
    }
  }

  private gapKey(characterId: string, tabId: string): string {
    return `${characterId}\u0000${tabId}`;
  }

  private ack(intent: CharacterIntent): void {
    const ack: IntentAck = {
      type: 'ack',
      tabId: intent.tabId,
      seq: intent.seq,
      characterId: intent.characterId,
    };
    this.channel?.postMessage(ack);
  }

  private resendPendingFor(characterId: string): void {
    const queue = this.pendingByCharacter.get(characterId) ?? [];
    for (const intent of queue) this.channel?.postMessage(intent);
  }

  private resendAllPending(): void {
    for (const characterId of this.pendingByCharacter.keys()) {
      if (this.deps.isLeader(characterId)) {
        this.reconcileOwnPending(characterId);
      } else {
        this.resendPendingFor(characterId);
      }
    }
  }
}
