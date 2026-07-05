import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'node:http';
import type { SyncOp } from '@fieldnotes/sync';
import { makePolicies, DM_AUDIENCE } from './policies.js';
import { signBattleMapToken } from './token.js';

const SECRET = 'test-secret';
const ROOM = 'ABC123:bm-1';
const { authenticate, authorize, canRead } = makePolicies(SECRET);

function req(url: string): { req: IncomingMessage; room: string } {
  return { req: { url } as IncomingMessage, room: ROOM };
}
function tokenFor(
  userId: string,
  role: 'dm' | 'player' | 'display',
  room = ROOM,
  exp = Date.now() + 60_000
) {
  return signBattleMapToken({ userId, role, room, exp }, SECRET);
}
const el = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    ...extra,
  }) as never;
const upsert = (id: string, extra: Record<string, unknown> = {}): SyncOp =>
  ({ kind: 'upsert', element: el(id, extra) }) as SyncOp;

describe('authenticate', () => {
  it('accepts a valid token for the right room', async () => {
    const r = await authenticate(
      req(`/?room=${ROOM}&token=${tokenFor('dm-1', 'dm')}`)
    );
    expect(r).toEqual({ userId: 'dm-1', role: 'dm' });
  });
  it('rejects missing token', async () => {
    expect(await authenticate(req(`/?room=${ROOM}`))).toBeNull();
  });
  it('rejects a token for a different room', async () => {
    const t = tokenFor('dm-1', 'dm', 'OTHER:bm-9');
    expect(await authenticate(req(`/?room=${ROOM}&token=${t}`))).toBeNull();
  });
  it('rejects an expired token', async () => {
    const t = tokenFor('dm-1', 'dm', ROOM, Date.now() - 1);
    expect(await authenticate(req(`/?room=${ROOM}&token=${t}`))).toBeNull();
  });
});

describe('authorize', () => {
  const base = { room: ROOM };
  it('dm may do anything', () => {
    expect(
      authorize({ ...base, userId: 'dm-1', role: 'dm', op: { kind: 'clear' } })
    ).toBe(true);
    expect(
      authorize({
        ...base,
        userId: 'dm-1',
        role: 'dm',
        op: upsert('e1', { audience: DM_AUDIENCE }),
      })
    ).toBe(true);
  });
  it('display may write nothing', () => {
    expect(
      authorize({
        ...base,
        userId: 'display-A',
        role: 'display',
        op: upsert('e1'),
      })
    ).toBe(false);
    expect(
      authorize({
        ...base,
        userId: 'display-A',
        role: 'display',
        op: { kind: 'remove', id: 'e1' },
      })
    ).toBe(false);
  });
  it('player cannot clear', () => {
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: { kind: 'clear' },
      })
    ).toBe(false);
  });
  it('player may create a new element', () => {
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: upsert('new'),
        currentElement: undefined,
      })
    ).toBe(true);
  });
  it('player may not forge dm audience', () => {
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: upsert('new', { audience: DM_AUDIENCE }),
      })
    ).toBe(false);
  });
  it('player may edit own, not others', () => {
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: upsert('e1'),
        currentElement: el('e1', { ownerId: 'p1' }),
      })
    ).toBe(true);
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: upsert('e1'),
        currentElement: el('e1', { ownerId: 'dm-1' }),
      })
    ).toBe(false);
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: { kind: 'remove', id: 'e1' },
        currentElement: el('e1', { ownerId: 'p1' }),
      })
    ).toBe(true);
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: { kind: 'remove', id: 'e1' },
        currentElement: el('e1', { ownerId: 'dm-1' }),
      })
    ).toBe(false);
  });
  it('player may not reveal a DM-hidden element by upserting it without audience', () => {
    // e1 is player-owned but the DM has hidden it (audience 'dm').
    // The player's op omits the audience field entirely — must still be denied.
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: upsert('e1'),
        currentElement: el('e1', { ownerId: 'p1', audience: DM_AUDIENCE }),
      })
    ).toBe(false);
  });
  it('player may not remove a DM-hidden element even if they own it', () => {
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: { kind: 'remove', id: 'e1' },
        currentElement: el('e1', { ownerId: 'p1', audience: DM_AUDIENCE }),
      })
    ).toBe(false);
  });
  it('dm may reveal a DM-hidden element', () => {
    expect(
      authorize({
        ...base,
        userId: 'dm-1',
        role: 'dm',
        op: upsert('e1'),
        currentElement: el('e1', { ownerId: 'p1', audience: DM_AUDIENCE }),
      })
    ).toBe(true);
  });
  it('unknown op kinds fail closed for players', () => {
    // authorize is only ever invoked for upsert/remove/clear by the hub;
    // anything else (including a future mutating op kind) must be denied.
    expect(
      authorize({
        ...base,
        userId: 'p1',
        role: 'player',
        op: { kind: 'request-snapshot' } as never,
      })
    ).toBe(false);
  });
});

describe('canRead', () => {
  const base = { room: ROOM };
  it('shared elements visible to all', () => {
    expect(canRead({ ...base, role: 'dm', audience: undefined })).toBe(true);
    expect(canRead({ ...base, role: 'player', audience: undefined })).toBe(
      true
    );
    expect(canRead({ ...base, role: 'display', audience: undefined })).toBe(
      true
    );
  });
  it('dm audience visible to dm only', () => {
    expect(canRead({ ...base, role: 'dm', audience: DM_AUDIENCE })).toBe(true);
    expect(canRead({ ...base, role: 'player', audience: DM_AUDIENCE })).toBe(
      false
    );
    expect(canRead({ ...base, role: 'display', audience: DM_AUDIENCE })).toBe(
      false
    );
  });
});
