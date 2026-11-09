import { describe, expect, it, vi } from 'vitest';
import { InMemoryHubFanout } from '@fieldnotes/sync-server';
import { EphemeralHubFanout } from './ephemeral-fanout.js';

const payload = (kind: string): string => JSON.stringify({ op: { kind } });
const authorityWake = JSON.stringify({
  authority: 1,
  room: '123e4567-e89b-42d3-a456-426614174000',
  definitionId: 'rollkeeper-scene-v1',
  position: {
    generation: '223e4567-e89b-42d3-a456-426614174000',
    revision: '7',
  },
});

describe('EphemeralHubFanout', () => {
  it('publishes presence, leave, and fog ops while dropping element ops and malformed payloads', () => {
    const inner = new InMemoryHubFanout();
    const fanout = new EphemeralHubFanout(inner);
    const seen = vi.fn();
    inner.subscribe(seen);

    fanout.publish(payload('presence'));
    fanout.publish(payload('presence-leave'));
    fanout.publish(payload('fog-meta'));
    fanout.publish(payload('fog-patch'));
    fanout.publish(payload('upsert'));
    fanout.publish(payload('clear'));
    fanout.publish('not json');

    expect(
      seen.mock.calls.map(([message]) => JSON.parse(message).op.kind)
    ).toEqual(['presence', 'presence-leave', 'fog-meta', 'fog-patch']);
  });

  it('filters inbound payloads before notifying hub subscribers', () => {
    const inner = new InMemoryHubFanout();
    const fanout = new EphemeralHubFanout(inner);
    const seen = vi.fn();
    fanout.subscribe(seen);

    inner.publish(payload('clear'));
    inner.publish(payload('presence'));
    inner.publish(payload('fog-meta'));

    expect(seen).toHaveBeenCalledTimes(2);
    expect(JSON.parse(seen.mock.calls[0]?.[0] as string).op.kind).toBe(
      'presence'
    );
    expect(JSON.parse(seen.mock.calls[1]?.[0] as string).op.kind).toBe(
      'fog-meta'
    );
  });

  it('forwards only structurally valid authority wakes in both directions', () => {
    const inner = new InMemoryHubFanout();
    const fanout = new EphemeralHubFanout(inner);
    const innerSeen = vi.fn();
    const wrappedSeen = vi.fn();
    inner.subscribe(innerSeen);
    fanout.subscribe(wrappedSeen);

    fanout.publish(authorityWake);
    inner.publish(authorityWake);
    fanout.publish(JSON.stringify({ authority: 1, room: '', position: {} }));
    inner.publish(
      JSON.stringify({
        authority: 1,
        room: 'room-a',
        definitionId: 'rollkeeper-scene-v1',
        position: { generation: 'generation-a', revision: -1 },
      })
    );

    expect(
      innerSeen.mock.calls.filter(([value]) => value === authorityWake)
    ).toHaveLength(2);
    expect(wrappedSeen).toHaveBeenCalledTimes(2);
    expect(wrappedSeen).toHaveBeenNthCalledWith(1, authorityWake);
    expect(wrappedSeen).toHaveBeenNthCalledWith(2, authorityWake);
  });
});
