import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  CharacterIntentBus,
  type CharacterIntent,
  type IntentBusDeps,
  type BroadcastChannelLike,
} from '@/lib/characterIntentBus';
import { TAB_ID } from '@/lib/tabIdentity';

type Message = Record<string, unknown>;

/** In-memory stand-in for BroadcastChannel: posted messages are captured;
 * incoming messages are injected via receive(). Mirrors the real API's
 * no-self-delivery semantics (postMessage does NOT loop back). */
class FakeChannel implements BroadcastChannelLike {
  posted: Message[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage(data: unknown) {
    this.posted.push(data as Message);
  }
  close() {}
  receive(data: Message) {
    this.onmessage?.({ data });
  }
}

function makeBus(overrides: Partial<IntentBusDeps> = {}) {
  const applied: CharacterIntent[] = [];
  const watermarks = new Map<string, number>();
  const channel = new FakeChannel();
  const deps: IntentBusDeps = {
    isLeader: () => false,
    getLoadedCharacterId: () => 'char-1',
    getWatermark: (characterId, tabId) =>
      watermarks.get(`${characterId}\u0000${tabId}`) ?? 0,
    applyIntent: intent => {
      applied.push(intent);
      watermarks.set(`${intent.characterId}\u0000${intent.tabId}`, intent.seq);
    },
    ...overrides,
  };
  const bus = new CharacterIntentBus(deps, () => channel);
  bus.start();
  return { bus, channel, applied, watermarks };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('follower side', () => {
  it('send() assigns contiguous per-character seqs and posts intents', () => {
    const { bus, channel } = makeBus();
    bus.send('char-1', 'applyDamageToCharacter', [3]);
    bus.send('char-1', 'applyHealingToCharacter', [1]);
    bus.send('char-2', 'applyDamageToCharacter', [5]);
    const seqs = channel.posted.map(m => [m.characterId, m.seq]);
    expect(seqs).toEqual([
      ['char-1', 1],
      ['char-1', 2],
      ['char-2', 1], // per-character sequence isolation
    ]);
  });

  it('ack drops pending up to seq; retry timer re-sends the rest in order', () => {
    const { bus, channel } = makeBus();
    bus.send('char-1', 'a', []);
    bus.send('char-1', 'b', []);
    channel.posted.length = 0;
    channel.receive({
      type: 'ack',
      tabId: TAB_ID,
      seq: 1,
      characterId: 'char-1',
    });
    vi.advanceTimersByTime(2100);
    expect(channel.posted.map(m => m.actionName)).toEqual(['b']);
  });

  it('leader announcement triggers immediate ordered re-send for that character', () => {
    const { bus, channel } = makeBus();
    bus.send('char-1', 'a', []);
    bus.send('char-1', 'b', []);
    bus.send('char-2', 'c', []);
    channel.posted.length = 0;
    channel.receive({
      type: 'leader',
      characterId: 'char-1',
      tabId: 'other-tab',
      epoch: 1,
    });
    expect(channel.posted.map(m => [m.actionName, m.seq])).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});

describe('leader side', () => {
  it('tracks sender sequence gaps independently for each character', () => {
    let loadedCharacterId = 'char-1';
    const { channel, applied } = makeBus({
      isLeader: () => true,
      getLoadedCharacterId: () => loadedCharacterId,
    });

    channel.receive({
      type: 'intent',
      opId: 'char-1-op-2',
      tabId: 'sender',
      seq: 2,
      characterId: 'char-1',
      actionName: 'char-1-second',
      args: [],
    });
    loadedCharacterId = 'char-2';
    channel.receive({
      type: 'intent',
      opId: 'char-2-op-1',
      tabId: 'sender',
      seq: 1,
      characterId: 'char-2',
      actionName: 'char-2-first',
      args: [],
    });
    expect(applied.map(intent => intent.actionName)).toEqual(['char-2-first']);

    loadedCharacterId = 'char-1';
    channel.receive({
      type: 'intent',
      opId: 'char-1-op-1',
      tabId: 'sender',
      seq: 1,
      characterId: 'char-1',
      actionName: 'char-1-first',
      args: [],
    });
    expect(applied.map(intent => intent.actionName)).toEqual([
      'char-2-first',
      'char-1-first',
      'char-1-second',
    ]);
  });

  it('applies in-order intents, acks, and dedups duplicates by watermark', () => {
    const { channel, applied } = makeBus({ isLeader: () => true });
    const intent = {
      type: 'intent',
      opId: 'x',
      tabId: 'sender',
      seq: 1,
      characterId: 'char-1',
      actionName: 'applyDamageToCharacter',
      args: [3],
    };
    channel.receive(intent);
    channel.receive(intent); // duplicate retry
    expect(applied).toHaveLength(1);
    const acks = channel.posted.filter(m => m.type === 'ack');
    expect(acks).toHaveLength(2); // duplicate re-acked
  });

  it('buffers gapped intents until the missing seq arrives', () => {
    const { channel, applied } = makeBus({ isLeader: () => true });
    const mk = (seq: number, actionName: string) => ({
      type: 'intent',
      opId: `op-${seq}`,
      tabId: 'sender',
      seq,
      characterId: 'char-1',
      actionName,
      args: [],
    });
    channel.receive(mk(2, 'second'));
    expect(applied).toHaveLength(0); // gap — waiting for seq 1
    channel.receive(mk(1, 'first'));
    expect(applied.map(i => i.actionName)).toEqual(['first', 'second']);
  });

  it('ignores intents for a character it does not have loaded', () => {
    const { channel, applied } = makeBus({
      isLeader: () => true,
      getLoadedCharacterId: () => 'other-char',
    });
    channel.receive({
      type: 'intent',
      opId: 'x',
      tabId: 'sender',
      seq: 1,
      characterId: 'char-1',
      actionName: 'a',
      args: [],
    });
    expect(applied).toHaveLength(0);
  });
});

describe('promotion', () => {
  it('reconcileOwnPending applies own queued intents (BC never self-delivers) and clears them', () => {
    const { bus, applied } = makeBus({ isLeader: () => true });
    bus.send('char-1', 'a', []);
    bus.send('char-1', 'b', []);
    bus.reconcileOwnPending('char-1');
    expect(applied.map(i => i.actionName)).toEqual(['a', 'b']);
    bus.reconcileOwnPending('char-1');
    expect(applied).toHaveLength(2); // idempotent — queue cleared
  });

  it('does not re-apply a pending intent whose watermark already shows it applied (C1)', () => {
    // Pins the failover window: the former leader applied this tab's seq 1,
    // persisted it, and died before the ack arrived. Promotion must hydrate
    // the watermark from the envelope (this test simulates that hydration
    // directly on the dep, mirroring onPromotedToLeader's fixed merge)
    // BEFORE reconcileOwnPending runs, so the still-pending intent is
    // recognized as a duplicate rather than re-applied.
    const { bus, applied, watermarks } = makeBus({ isLeader: () => true });
    bus.send('char-1', 'a', []); // seq 1, queued — never acked
    watermarks.set(`char-1\u0000${TAB_ID}`, 1); // envelope-hydrated watermark says seq 1 landed

    bus.reconcileOwnPending('char-1');

    expect(applied).toHaveLength(0); // deduped, not re-applied
  });

  it('still applies a pending intent when the watermark has NOT caught up (no false dedup)', () => {
    const { bus, applied } = makeBus({ isLeader: () => true });
    bus.send('char-1', 'a', []); // seq 1, watermark starts at 0

    bus.reconcileOwnPending('char-1');

    expect(applied.map(i => i.actionName)).toEqual(['a']);
  });
});
