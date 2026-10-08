import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  DISPLAY_EXPIRED_ERROR,
  DISPLAY_IN_USE_ERROR,
  drawDisplayGeneration,
  generateDisplayCapability,
  hashDisplaySecret,
  parseDisplayAck,
  projectDisplayTarget,
  readDisplayStatus,
  recordDisplayAck,
  rotateDisplayCapability,
  verifyDisplayCapability,
} from './displayCapability';
import {
  DISPLAY_ACK_SCRIPT,
  DISPLAY_ROTATE_SCRIPT,
  DISPLAY_STATUS_SCRIPT,
  DISPLAY_VERIFY_SCRIPT,
} from './displayScripts';
import {
  tableControlKey,
  tableDisplayAckKey,
  tableDisplaySessionKey,
  tableRegistryKey,
} from './keys';

const CODE = 'DISP05';
const CAPABILITY = 'A'.repeat(43);
const NONCE = 'n'.repeat(22);
const EPOCH = '19a12345-1234-4123-8123-123456789abc';

function control(extra: Record<string, unknown> = {}) {
  return {
    v: 1,
    epoch: EPOCH,
    revision: 4,
    writerFence: 1,
    leaseUntil: 0,
    holderSessionId: null,
    presentation: { sceneId: 'scene-a', revision: 3, blanked: false },
    publicRunId: null,
    displayGeneration: 77,
    displayCapabilityHash: hashDisplaySecret(CAPABILITY),
    ...extra,
  };
}

function redisWith(stored: unknown, evalResult?: unknown) {
  return {
    get: vi.fn(async () =>
      stored === undefined ? null : JSON.stringify(stored)
    ),
    eval: vi.fn(async () =>
      typeof evalResult === 'string' ? evalResult : JSON.stringify(evalResult)
    ),
  };
}

describe('display capability material', () => {
  it('is 256 random bits as base64url, stored only as SHA-256 hex', () => {
    const first = generateDisplayCapability();
    const second = generateDisplayCapability();
    expect(first.capability).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(Buffer.from(first.capability, 'base64url')).toHaveLength(32);
    expect(first.capability).not.toBe(second.capability);
    expect(first.hash).toBe(
      createHash('sha256').update(first.capability, 'utf8').digest('hex')
    );
    expect(hashDisplaySecret(first.capability)).toBe(first.hash);
  });

  it('draws generations as safe integers in [1, 1e14) with one randomInt call', () => {
    for (let index = 0; index < 50; index += 1) {
      const generation = drawDisplayGeneration();
      expect(Number.isSafeInteger(generation)).toBe(true);
      expect(generation).toBeGreaterThanOrEqual(1);
      expect(generation).toBeLessThan(1e14);
    }
  });
});

describe('verifyDisplayCapability', () => {
  it('denies malformed capability or nonce with the expired body and no Redis call', async () => {
    for (const [capability, nonce] of [
      ['short', NONCE],
      [`${CAPABILITY}=`, NONCE],
      ['123e4567-e89b-42d3-a456-426614174000', NONCE],
      [CAPABILITY, 'short'],
      [CAPABILITY, undefined],
      [undefined, NONCE],
    ] as const) {
      const rawRedis = redisWith(control());
      const result = await verifyDisplayCapability({
        rawRedis,
        code: CODE,
        capability,
        nonce,
        bind: true,
      });
      expect(result).toEqual({
        status: 'denied',
        httpStatus: 403,
        error: DISPLAY_EXPIRED_ERROR,
      });
      expect(rawRedis.get).not.toHaveBeenCalled();
      expect(rawRedis.eval).not.toHaveBeenCalled();
    }
  });

  it('denies a missing control, a null hash or another hash before any script runs', async () => {
    for (const stored of [
      undefined,
      control({ displayCapabilityHash: null, displayGeneration: 0 }),
      control({ displayCapabilityHash: hashDisplaySecret('B'.repeat(43)) }),
    ]) {
      const rawRedis = redisWith(stored);
      const result = await verifyDisplayCapability({
        rawRedis,
        code: CODE,
        capability: CAPABILITY,
        nonce: NONCE,
        bind: true,
      });
      expect(result).toMatchObject({
        status: 'denied',
        error: DISPLAY_EXPIRED_ERROR,
      });
      expect(rawRedis.eval).not.toHaveBeenCalled();
    }
  });

  it('runs the verify script on the same-slot keys with hashes only', async () => {
    const rawRedis = redisWith(control(), {
      status: 'ok',
      control: JSON.stringify(control()),
      entry: null,
    });
    const result = await verifyDisplayCapability({
      rawRedis,
      code: CODE,
      capability: CAPABILITY,
      nonce: NONCE,
      bind: true,
    });
    expect(result).toMatchObject({
      status: 'ok',
      displayGeneration: 77,
      epoch: EPOCH,
    });
    expect(rawRedis.eval).toHaveBeenCalledWith(
      DISPLAY_VERIFY_SCRIPT,
      [
        tableControlKey(CODE),
        tableDisplaySessionKey(CODE),
        tableRegistryKey(CODE),
      ],
      [hashDisplaySecret(CAPABILITY), hashDisplaySecret(NONCE), '1']
    );
    const sent = JSON.stringify(rawRedis.eval.mock.calls);
    expect(sent).not.toContain(CAPABILITY);
    expect(sent).not.toContain(NONCE);
  });

  it('maps script answers: in-use 403, unbound 409 stale, failures 503', async () => {
    const answer = async (evalResult: unknown, bind = false) =>
      verifyDisplayCapability({
        rawRedis: redisWith(control(), evalResult),
        code: CODE,
        capability: CAPABILITY,
        nonce: NONCE,
        bind,
      });
    expect(await answer({ status: 'in-use' })).toEqual({
      status: 'denied',
      httpStatus: 403,
      error: DISPLAY_IN_USE_ERROR,
    });
    expect(await answer({ status: 'unbound' })).toEqual({ status: 'stale' });
    expect(await answer({ status: 'expired' })).toMatchObject({
      error: DISPLAY_EXPIRED_ERROR,
    });
    expect(await answer({ status: 'unavailable' })).toEqual({
      status: 'error',
    });
    const throwing = redisWith(control());
    throwing.eval.mockRejectedValue(new Error('offline'));
    expect(
      await verifyDisplayCapability({
        rawRedis: throwing,
        code: CODE,
        capability: CAPABILITY,
        nonce: NONCE,
        bind: false,
      })
    ).toEqual({ status: 'error' });
    const failingRead = redisWith(control());
    failingRead.get.mockRejectedValue(new Error('offline'));
    expect(
      await verifyDisplayCapability({
        rawRedis: failingRead,
        code: CODE,
        capability: CAPABILITY,
        nonce: NONCE,
        bind: false,
      })
    ).toEqual({ status: 'error' });
  });
});

describe('projectDisplayTarget (E6)', () => {
  const entry = (extra: Record<string, unknown> = {}) => ({
    v: 1,
    sceneId: 'scene-a',
    sourceMapId: 'map-a',
    safeLabel: 'Tavern',
    deleted: false,
    roomId: 'room',
    workspaceInstanceId: 'private-workspace',
    ...extra,
  });

  it('discloses only the visible scene id, source map and label', () => {
    expect(projectDisplayTarget(control(), entry())).toEqual({
      displayGeneration: 77,
      epoch: EPOCH,
      presentation: { sceneId: 'scene-a', revision: 3, blanked: false },
      scene: { sceneId: 'scene-a', sourceMapId: 'map-a', label: 'Tavern' },
    });
  });

  it('hides the scene id when blanked, unregistered, deleted, mapless or nothing shown', () => {
    const blanked = control({
      presentation: { sceneId: 'scene-a', revision: 5, blanked: true },
    });
    expect(projectDisplayTarget(blanked, entry())).toMatchObject({
      presentation: { sceneId: null, revision: 5, blanked: true },
      scene: null,
    });
    for (const hidden of [
      null,
      entry({ deleted: true }),
      entry({ sourceMapId: null }),
      entry({ sourceMapId: '' }),
      entry({ sceneId: 'scene-b' }),
      entry({ v: 2 }),
    ]) {
      expect(projectDisplayTarget(control(), hidden)).toMatchObject({
        presentation: { sceneId: null, revision: 3, blanked: false },
        scene: null,
      });
    }
    const none = control({
      presentation: { sceneId: null, revision: 9, blanked: false },
    });
    expect(projectDisplayTarget(none, null)).toMatchObject({
      presentation: { sceneId: null, revision: 9, blanked: false },
      scene: null,
    });
  });
});

describe('parseDisplayAck', () => {
  const ack = {
    displayGeneration: 77,
    epoch: EPOCH,
    presentationRevision: 3,
    sceneId: 'scene-a',
    blanked: false,
    phase: 'loaded',
  };
  it('accepts exactly the six ACK keys', () => {
    expect(parseDisplayAck(ack)).toEqual(ack);
    expect(parseDisplayAck({ ...ack, sceneId: null, phase: 'blank' })).toEqual({
      ...ack,
      sceneId: null,
      phase: 'blank',
    });
  });
  it('rejects extra keys, client timestamps and wrong types', () => {
    for (const bad of [
      { ...ack, receivedAt: 1 },
      { ...ack, phase: 'displaying' },
      { ...ack, displayGeneration: 1.5 },
      { ...ack, presentationRevision: -1 },
      { ...ack, blanked: 'false' },
      { ...ack, sceneId: 7 },
      { ...ack, epoch: 'x'.repeat(200) },
      Object.fromEntries(
        Object.entries(ack).filter(([key]) => key !== 'phase')
      ),
      null,
      [],
    ])
      expect(parseDisplayAck(bad)).toBeNull();
  });
});

describe('PR07 M1 calibration self-report', () => {
  const ack = {
    displayGeneration: 77,
    epoch: EPOCH,
    presentationRevision: 3,
    sceneId: 'scene-a',
    blanked: false,
    phase: 'loaded',
  };
  it('accepts the six keys plus one optional calibration enum', () => {
    for (const calibration of [
      'uncalibrated',
      'verified',
      'verify-required',
      'unsupported',
    ])
      expect(parseDisplayAck({ ...ack, calibration })).toEqual({
        ...ack,
        calibration,
      });
    expect(parseDisplayAck(ack)).toEqual(ack);
  });
  it('rejects an invalid enum, null and any other extra key', () => {
    for (const bad of [
      { ...ack, calibration: 'calibrated' },
      { ...ack, calibration: null },
      { ...ack, calibration: 1 },
      { ...ack, calibration: 'verified', extra: true },
      { ...ack, calibrationState: 'verified' },
    ])
      expect(parseDisplayAck(bad)).toBeNull();
  });
  it('the ACK and status scripts carry the enum and fresh-match rule', () => {
    expect(DISPLAY_ACK_SCRIPT).toContain('calibration=calibration');
    for (const value of [
      'uncalibrated',
      'verified',
      'verify-required',
      'unsupported',
    ]) {
      expect(DISPLAY_ACK_SCRIPT).toContain(`'${value}'`);
      expect(DISPLAY_STATUS_SCRIPT).toContain(`'${value}'`);
    }
  });
  it('status returns calibration only as a valid enum string', async () => {
    const rawRedis = {
      get: vi.fn(),
      eval: vi.fn(async () =>
        JSON.stringify({
          state: 'loaded',
          sceneId: 'scene-a',
          ageMs: 5,
          calibration: 'verify-required',
        })
      ),
    };
    expect(await readDisplayStatus(rawRedis, CODE)).toEqual({
      status: 'ok',
      display: {
        state: 'loaded',
        sceneId: 'scene-a',
        ageMs: 5,
        calibration: 'verify-required',
      },
    });
    rawRedis.eval.mockResolvedValueOnce(
      JSON.stringify({
        state: 'blank',
        sceneId: null,
        ageMs: 5,
        calibration: 'bogus',
      })
    );
    const bogus = await readDisplayStatus(rawRedis, CODE);
    expect(bogus).toEqual({
      status: 'ok',
      display: { state: 'blank', sceneId: null, ageMs: 5 },
    });
    rawRedis.eval.mockResolvedValueOnce(
      JSON.stringify({
        state: 'updating',
        sceneId: 'scene-a',
        ageMs: 5,
        calibration: 'verified',
      })
    );
    expect(await readDisplayStatus(rawRedis, CODE)).toEqual({
      status: 'ok',
      display: { state: 'updating', sceneId: 'scene-a', ageMs: 5 },
    });
  });
});

describe('rotation, ACK and status script calls', () => {
  it('rotates through the dedicated script and redraws on a generation collision', async () => {
    const rawRedis = {
      get: vi.fn(),
      eval: vi
        .fn()
        .mockResolvedValueOnce(JSON.stringify({ status: 'collision' }))
        .mockImplementationOnce(async (_script, _keys, args: string[]) =>
          JSON.stringify({
            status: 'rotated',
            displayGeneration: Number(args[1]),
          })
        ),
    };
    const result = await rotateDisplayCapability(rawRedis, CODE);
    expect(result.status).toBe('rotated');
    if (result.status !== 'rotated') return;
    expect(rawRedis.eval).toHaveBeenCalledTimes(2);
    const [script, keys, args] = rawRedis.eval.mock.calls[1]!;
    expect(script).toBe(DISPLAY_ROTATE_SCRIPT);
    expect(keys).toEqual([
      tableControlKey(CODE),
      tableDisplaySessionKey(CODE),
      tableDisplayAckKey(CODE),
    ]);
    expect(args[0]).toBe(hashDisplaySecret(result.capability));
    expect(Number(args[1])).toBe(result.displayGeneration);
    expect(JSON.stringify(rawRedis.eval.mock.calls)).not.toContain(
      result.capability
    );
  });

  it('reports not-initialized and Redis failures without a capability', async () => {
    const missing = {
      get: vi.fn(),
      eval: vi.fn(async () => JSON.stringify({ status: 'not-initialized' })),
    };
    expect(await rotateDisplayCapability(missing, CODE)).toEqual({
      status: 'not-initialized',
    });
    const failing = {
      get: vi.fn(),
      eval: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    expect(await rotateDisplayCapability(failing, CODE)).toEqual({
      status: 'error',
    });
  });

  it('records ACKs through the ACK script and maps stale/expired/in-use', async () => {
    const ack = {
      displayGeneration: 77,
      epoch: EPOCH,
      presentationRevision: 3,
      sceneId: 'scene-a',
      blanked: false,
      phase: 'loaded' as const,
    };
    const call = (evalResult: unknown) => {
      const rawRedis = redisWith(control(), evalResult);
      return {
        rawRedis,
        result: recordDisplayAck({
          rawRedis,
          code: CODE,
          capability: CAPABILITY,
          nonce: NONCE,
          ack,
        }),
      };
    };
    const recorded = call({ status: 'recorded', receivedAt: 123 });
    expect(await recorded.result).toEqual({
      status: 'recorded',
      receivedAt: 123,
    });
    expect(recorded.rawRedis.eval).toHaveBeenCalledWith(
      DISPLAY_ACK_SCRIPT,
      [
        tableControlKey(CODE),
        tableDisplaySessionKey(CODE),
        tableDisplayAckKey(CODE),
        tableRegistryKey(CODE),
      ],
      [
        hashDisplaySecret(CAPABILITY),
        hashDisplaySecret(NONCE),
        JSON.stringify(ack),
      ]
    );
    expect(await call({ status: 'stale' }).result).toEqual({
      status: 'stale',
    });
    expect(await call({ status: 'unbound' }).result).toEqual({
      status: 'stale',
    });
    expect(await call({ status: 'in-use' }).result).toMatchObject({
      error: DISPLAY_IN_USE_ERROR,
    });
    expect(await call({ status: 'expired' }).result).toMatchObject({
      error: DISPLAY_EXPIRED_ERROR,
    });
  });

  it('reads DM status through one script with no secret material', async () => {
    const rawRedis = {
      get: vi.fn(),
      eval: vi.fn(async () =>
        JSON.stringify({ state: 'loaded', sceneId: 'scene-a', ageMs: 1200 })
      ),
    };
    expect(await readDisplayStatus(rawRedis, CODE)).toEqual({
      status: 'ok',
      display: { state: 'loaded', sceneId: 'scene-a', ageMs: 1200 },
    });
    expect(rawRedis.eval).toHaveBeenCalledWith(
      DISPLAY_STATUS_SCRIPT,
      [tableControlKey(CODE), tableDisplayAckKey(CODE), tableRegistryKey(CODE)],
      []
    );
    rawRedis.eval.mockResolvedValueOnce(JSON.stringify({ state: 'bogus' }));
    expect(await readDisplayStatus(rawRedis, CODE)).toEqual({
      status: 'error',
    });
  });
});
