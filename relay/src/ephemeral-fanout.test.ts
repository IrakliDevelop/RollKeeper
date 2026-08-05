import { describe, expect, it, vi } from 'vitest';
import { InMemoryHubFanout } from '@fieldnotes/sync-server';
import { EphemeralHubFanout } from './ephemeral-fanout.js';

const payload = (kind: string): string => JSON.stringify({ op: { kind } });

describe('EphemeralHubFanout', () => {
  it('publishes presence and leave while dropping durable and malformed payloads', () => {
    const inner = new InMemoryHubFanout();
    const fanout = new EphemeralHubFanout(inner);
    const seen = vi.fn();
    inner.subscribe(seen);

    fanout.publish(payload('presence'));
    fanout.publish(payload('presence-leave'));
    fanout.publish(payload('upsert'));
    fanout.publish('not json');

    expect(
      seen.mock.calls.map(([message]) => JSON.parse(message).op.kind)
    ).toEqual(['presence', 'presence-leave']);
  });

  it('filters inbound payloads before notifying hub subscribers', () => {
    const inner = new InMemoryHubFanout();
    const fanout = new EphemeralHubFanout(inner);
    const seen = vi.fn();
    fanout.subscribe(seen);

    inner.publish(payload('clear'));
    inner.publish(payload('presence'));

    expect(seen).toHaveBeenCalledTimes(1);
    expect(JSON.parse(seen.mock.calls[0]?.[0] as string).op.kind).toBe(
      'presence'
    );
  });
});
