import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTableControl } from '../useTableControl';
import type { TableDescriptor } from '@/lib/tableServer/control';

/**
 * PR05 R4-F1: Open display rotates the display generation and capability
 * hash WITHOUT bumping the fenced control revision, so the mapless live
 * initiative holder (no stale-control retry) keeps renewing and broadcasting
 * across a rotation. The fake server reproduces the control Lua rule
 * (exact expected revision; every commit bumps `revision`) and the rotation
 * Lua rule (display fields only).
 */
const epoch = '19a12345-1234-4123-8123-123456789abc';
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function luaServer() {
  let current: TableDescriptor | null = null;
  const display = { displayGeneration: 0, displayCapabilityHash: '' };
  const renewals: string[] = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/capability')) return json({ required: true });
    if (init?.method !== 'POST') return json({ current });
    const command = JSON.parse(String(init.body)).command as Record<
      string,
      unknown
    >;
    if (command.type === 'initialize') {
      current = {
        epoch,
        revision: 0,
        writerFence: 0,
        leaseUntil: 0,
        holderSessionId: null,
        presentation: { sceneId: null, revision: 0, blanked: false },
        publicRunId: null,
      };
      return json({ status: 'committed', reason: 'current', current });
    }
    if (
      command.expectedEpoch !== current!.epoch ||
      command.expectedRevision !== current!.revision
    )
      return json(
        { status: 'conflict', reason: 'stale-control', current },
        409
      );
    if (command.type === 'acquire')
      current = {
        ...current!,
        writerFence: current!.writerFence + 1,
        holderSessionId: String(command.holderSessionId),
        leaseUntil: Date.now() + 30_000,
      };
    if (command.type === 'renew') {
      renewals.push(String(command.operationId));
      current = { ...current!, leaseUntil: Date.now() + 30_000 };
    }
    if (command.type === 'publishInitiative')
      current = { ...current!, publicRunId: String(command.runId) };
    current = { ...current!, revision: current!.revision + 1 };
    return json({ status: 'committed', reason: 'current', current });
  });
  return {
    fetcher,
    renewals,
    display,
    /** Rotation Lua: display generation + hash only (no revision bump). */
    rotate() {
      display.displayGeneration += 1;
      display.displayCapabilityHash = `hash-${display.displayGeneration}`;
    },
    /** A foreign fenced commit (the rejected M2 alternative's effect). */
    bumpRevision() {
      current = { ...current!, revision: current!.revision + 1 };
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Runs the hook's current 10 s renew interval callback once. */
async function tickRenew(interval: { mock: { calls: unknown[][] } }) {
  const call = interval.mock.calls
    .filter((item: unknown[]) => item[1] === 10_000)
    .at(-1);
  if (!call) throw new Error('no renew interval');
  await act(async () => {
    (call[0] as () => void)();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function broadcasting(server: ReturnType<typeof luaServer>) {
  vi.stubGlobal('fetch', server.fetcher);
  const hook = renderHook(() => useTableControl('SYNTHA', 'dm-one'));
  await waitFor(() => expect(hook.result.current.status).toBe('waiting'));
  await act(async () => hook.result.current.initialize());
  await act(async () => hook.result.current.acquire());
  await act(async () =>
    hook.result.current.publish('publishInitiative', {
      runId: 'run-one',
      initiative: {},
    })
  );
  expect(hook.result.current.status).toBe('broadcasting');
  return hook;
}

describe('useTableControl across a display rotation (PR05 R4-F1)', () => {
  it('keeps renewing and broadcasting after Open display rotates the capability', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    const server = luaServer();
    const { result } = await broadcasting(server);
    server.rotate();
    await tickRenew(interval);
    server.rotate();
    await tickRenew(interval);
    expect(server.renewals).toHaveLength(2);
    expect(result.current.status).toBe('broadcasting');
    expect(result.current.error).toBeNull();
  });

  it('would stop broadcasting if anything bumped the fenced revision (discriminating control)', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    const server = luaServer();
    const { result } = await broadcasting(server);
    server.bumpRevision();
    await tickRenew(interval);
    expect(result.current.status).toBe('error');
  });
});
