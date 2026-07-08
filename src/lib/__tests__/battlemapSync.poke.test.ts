import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createManagedBattleMapConnection,
  pokeFeatureFromEnvelope,
  type BattleMapTransport,
} from '@/lib/battlemapSync';
import type { ElementStore } from '@fieldnotes/core';

const POKE_RAW = JSON.stringify({
  from: '@poke',
  op: { kind: 'presence', data: { kind: 'poke', feature: 'initiative' } },
});

describe('pokeFeatureFromEnvelope', () => {
  it('extracts the feature from a poke envelope', () => {
    expect(pokeFeatureFromEnvelope(POKE_RAW)).toBe('initiative');
  });

  it('returns null for non-poke senders, other ops, and junk', () => {
    expect(
      pokeFeatureFromEnvelope(
        JSON.stringify({
          from: 'user-1',
          op: { kind: 'presence', data: { kind: 'poke', feature: 'x' } },
        })
      )
    ).toBeNull();
    expect(
      pokeFeatureFromEnvelope(
        JSON.stringify({ from: '@poke', op: { kind: 'upsert' } })
      )
    ).toBeNull();
    expect(pokeFeatureFromEnvelope('not json')).toBeNull();
    expect(
      pokeFeatureFromEnvelope(
        JSON.stringify({ from: '@poke', op: { kind: 'presence', data: {} } })
      )
    ).toBeNull();
  });
});

describe('managed connection onPoke', () => {
  let messageHandlers: Array<(raw: string) => void>;

  function fakeTransport(): BattleMapTransport {
    return {
      send: vi.fn(),
      onMessage: (h: (raw: string) => void) => {
        messageHandlers.push(h);
        return () => {};
      },
      onReconnect: () => () => {},
      onClose: () => () => {},
      close: vi.fn(),
    } as unknown as BattleMapTransport;
  }

  beforeEach(() => {
    messageHandlers = [];
    // mintBattleMapToken fetches the token route — stub it to succeed.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'tok' })))
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invokes onPoke for poke envelopes and ignores everything else', async () => {
    const onPoke = vi.fn();
    const store = {
      snapshot: () => [],
      getById: () => undefined,
      add: () => {},
      update: () => {},
      subscribe: () => () => {},
      on: () => () => {},
    } as unknown as ElementStore;

    const conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.test',
      campaignCode: 'CAMP1',
      battleMapId: 'map-42',
      store,
      clientId: 'char-1',
      tokenRequest: {
        role: 'player',
        battleMapId: 'map-42',
        playerId: 'char-1',
      },
      transportFactory: () => fakeTransport(),
      onPoke,
    });

    // connect() is async (token mint) — wait for the transport to be built.
    await vi.waitFor(() => expect(messageHandlers.length).toBeGreaterThan(0));

    for (const h of messageHandlers) h(POKE_RAW);
    expect(onPoke).toHaveBeenCalledWith('initiative');
    expect(onPoke).toHaveBeenCalledTimes(1); // only one listener fires it

    onPoke.mockClear();
    for (const h of messageHandlers)
      h(JSON.stringify({ from: 'u1', op: { kind: 'upsert', elements: [] } }));
    expect(onPoke).not.toHaveBeenCalled();

    conn.stop();
  });
});
