import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

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

/** S4 credential denial bodies (C4-1: the display clears only on these). */
export const DISPLAY_EXPIRED_ERROR = 'Display link expired';
export const DISPLAY_IN_USE_ERROR = 'Display link is in use on another screen';

const CAPABILITY = /^[A-Za-z0-9_-]{43}$/u;
const NONCE = /^[A-Za-z0-9_-]{22}$/u;
const SCENE_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const GENERATION_LIMIT = 1e14;

/**
 * The raw (non-deserializing) Redis surface the display helpers need. An
 * explicit structural type keeps this file runnable under Node type
 * stripping for the real-REST integration test.
 */
export interface DisplayRedis {
  get(key: string): Promise<unknown>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export interface DisplayAck {
  displayGeneration: number;
  epoch: string;
  presentationRevision: number;
  sceneId: string | null;
  blanked: boolean;
  phase: 'loaded' | 'blank';
}

export interface DisplayDescriptor {
  displayGeneration: number;
  epoch: string;
  presentation: { sceneId: string | null; revision: number; blanked: boolean };
  scene: { sceneId: string; sourceMapId: string; label: string } | null;
}

export type DisplayDenial = {
  status: 'denied';
  httpStatus: 403;
  error: typeof DISPLAY_EXPIRED_ERROR | typeof DISPLAY_IN_USE_ERROR;
};

export type DisplayVerification =
  | {
      status: 'ok';
      displayGeneration: number;
      epoch: string;
      control: Record<string, unknown>;
      presentedEntry: Record<string, unknown> | null;
    }
  | DisplayDenial
  /** No binding for this generation on a non-descriptor use: 409 stale. */
  | { status: 'stale' }
  | { status: 'error' };

export type DisplayStatusState =
  | 'none'
  | 'loaded'
  | 'blank'
  | 'waiting'
  | 'updating'
  | 'stale';

export interface DisplayStatus {
  state: DisplayStatusState;
  sceneId: string | null;
  ageMs: number | null;
}

const expired = (): DisplayDenial => ({
  status: 'denied',
  httpStatus: 403,
  error: DISPLAY_EXPIRED_ERROR,
});
const inUse = (): DisplayDenial => ({
  status: 'denied',
  httpStatus: 403,
  error: DISPLAY_IN_USE_ERROR,
});

function record(value: unknown): Record<string, unknown> | null {
  try {
    const decoded =
      typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function hashDisplaySecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** E2: 256 random bits, base64url; only the SHA-256 hex is stored. */
export function generateDisplayCapability(): {
  capability: string;
  hash: string;
} {
  const capability = randomBytes(32).toString('base64url');
  return { capability, hash: hashDisplaySecret(capability) };
}

/** M1: one cryptographically random integer in [1, 1e14). */
export function drawDisplayGeneration(): number {
  return randomInt(1, GENERATION_LIMIT);
}

export const isDisplayCapability = (value: unknown): value is string =>
  typeof value === 'string' && CAPABILITY.test(value);
export const isDisplayNonce = (value: unknown): value is string =>
  typeof value === 'string' && NONCE.test(value);

function hashesEqual(left: string, right: unknown): boolean {
  if (typeof right !== 'string' || !/^[0-9a-f]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

/**
 * E5: the one display credential check. The capability hash is compared in
 * constant time against current control first, then the verify script
 * re-checks it atomically with the nonce binding (compare-if-unbound only
 * when `bind`, i.e. the descriptor read).
 */
/**
 * E2 pre-check: format, then a constant-time comparison of the capability
 * hash with current control (read via the raw client). The scripts re-check
 * the hash under atomicity.
 */
async function precheck(
  rawRedis: DisplayRedis,
  code: string,
  capability: unknown,
  nonce: unknown
): Promise<
  | { status: 'ok'; hash: string; nonceHash: string }
  | DisplayDenial
  | { status: 'error' }
> {
  if (!isDisplayCapability(capability) || !isDisplayNonce(nonce))
    return expired();
  let controlKey: string;
  try {
    controlKey = tableControlKey(code);
  } catch {
    return expired();
  }
  const hash = hashDisplaySecret(capability);
  try {
    const stored = record(await rawRedis.get(controlKey));
    if (
      !stored ||
      stored.v !== 1 ||
      typeof stored.displayGeneration !== 'number' ||
      stored.displayGeneration < 1 ||
      !hashesEqual(hash, stored.displayCapabilityHash)
    )
      return expired();
  } catch {
    return { status: 'error' };
  }
  return { status: 'ok', hash, nonceHash: hashDisplaySecret(nonce) };
}

export async function verifyDisplayCapability(input: {
  rawRedis: DisplayRedis;
  code: string;
  capability: unknown;
  nonce: unknown;
  bind: boolean;
}): Promise<DisplayVerification> {
  const checked = await precheck(
    input.rawRedis,
    input.code,
    input.capability,
    input.nonce
  );
  if (checked.status !== 'ok') return checked;
  const keys = [
    tableControlKey(input.code),
    tableDisplaySessionKey(input.code),
    tableRegistryKey(input.code),
  ];
  try {
    const result = record(
      await input.rawRedis.eval(DISPLAY_VERIFY_SCRIPT, keys, [
        checked.hash,
        checked.nonceHash,
        input.bind ? '1' : '0',
      ])
    );
    switch (result?.status) {
      case 'ok': {
        const control = record(result.control);
        if (
          !control ||
          typeof control.displayGeneration !== 'number' ||
          typeof control.epoch !== 'string'
        )
          return { status: 'error' };
        return {
          status: 'ok',
          displayGeneration: control.displayGeneration,
          epoch: control.epoch,
          control,
          presentedEntry: record(result.entry),
        };
      }
      case 'expired':
        return expired();
      case 'in-use':
        return inUse();
      case 'unbound':
        return { status: 'stale' };
      default:
        return { status: 'error' };
    }
  } catch {
    return { status: 'error' };
  }
}

/**
 * E6: what the display may learn. Only an audience-visible scene (presented,
 * unblanked, registered v1, not deleted, with a source map) is disclosed,
 * as `{sceneId, sourceMapId, label}`; everything else is a null scene id.
 */
export function projectDisplayTarget(
  control: Record<string, unknown>,
  entry: Record<string, unknown> | null
): DisplayDescriptor {
  const presentation = record(control.presentation);
  const revision =
    typeof presentation?.revision === 'number' ? presentation.revision : 0;
  const blanked = presentation?.blanked === true;
  const presented =
    typeof presentation?.sceneId === 'string' ? presentation.sceneId : null;
  const visible =
    !blanked &&
    presented !== null &&
    entry?.v === 1 &&
    entry.deleted !== true &&
    entry.sceneId === presented &&
    typeof entry.sourceMapId === 'string' &&
    entry.sourceMapId.length > 0;
  return {
    displayGeneration: control.displayGeneration as number,
    epoch: control.epoch as string,
    presentation: {
      sceneId: visible ? presented : null,
      revision,
      blanked,
    },
    scene: visible
      ? {
          sceneId: presented!,
          sourceMapId: entry!.sourceMapId as string,
          label: typeof entry!.safeLabel === 'string' ? entry!.safeLabel : '',
        }
      : null,
  };
}

const ACK_KEYS = [
  'blanked',
  'displayGeneration',
  'epoch',
  'phase',
  'presentationRevision',
  'sceneId',
];

/** E7: exactly the six ACK keys; the client never sends a timestamp. */
export function parseDisplayAck(value: unknown): DisplayAck | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ack = value as Record<string, unknown>;
  const keys = Object.keys(ack).sort();
  if (
    keys.length !== ACK_KEYS.length ||
    keys.some((key, index) => key !== ACK_KEYS[index])
  )
    return null;
  const ok =
    Number.isSafeInteger(ack.displayGeneration) &&
    (ack.displayGeneration as number) >= 1 &&
    typeof ack.epoch === 'string' &&
    ack.epoch.length >= 1 &&
    ack.epoch.length <= 64 &&
    Number.isSafeInteger(ack.presentationRevision) &&
    (ack.presentationRevision as number) >= 0 &&
    (ack.sceneId === null ||
      (typeof ack.sceneId === 'string' && SCENE_ID.test(ack.sceneId))) &&
    typeof ack.blanked === 'boolean' &&
    (ack.phase === 'loaded' || ack.phase === 'blank');
  return ok ? (ack as unknown as DisplayAck) : null;
}

/** M2: lease-free rotation through the dedicated script (never the ledger). */
export async function rotateDisplayCapability(
  rawRedis: DisplayRedis,
  code: string
): Promise<
  | { status: 'rotated'; capability: string; displayGeneration: number }
  | { status: 'not-initialized' }
  | { status: 'error' }
> {
  const keys = [
    tableControlKey(code),
    tableDisplaySessionKey(code),
    tableDisplayAckKey(code),
  ];
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { capability, hash } = generateDisplayCapability();
      const generation = drawDisplayGeneration();
      const result = record(
        await rawRedis.eval(DISPLAY_ROTATE_SCRIPT, keys, [
          hash,
          String(generation),
        ])
      );
      if (result?.status === 'collision') continue;
      if (result?.status === 'not-initialized')
        return { status: 'not-initialized' };
      if (
        result?.status === 'rotated' &&
        result.displayGeneration === generation
      )
        return { status: 'rotated', capability, displayGeneration: generation };
      return { status: 'error' };
    }
  } catch {
    // Fall through: rotation state is unknown to the caller.
  }
  return { status: 'error' };
}

/** E7: records a device assertion for the exact current tuple. */
export async function recordDisplayAck(input: {
  rawRedis: DisplayRedis;
  code: string;
  capability: unknown;
  nonce: unknown;
  ack: DisplayAck;
}): Promise<
  | { status: 'recorded'; receivedAt: number }
  | DisplayDenial
  | { status: 'stale' }
  | { status: 'error' }
> {
  const checked = await precheck(
    input.rawRedis,
    input.code,
    input.capability,
    input.nonce
  );
  if (checked.status !== 'ok') return checked;
  try {
    const result = record(
      await input.rawRedis.eval(
        DISPLAY_ACK_SCRIPT,
        [
          tableControlKey(input.code),
          tableDisplaySessionKey(input.code),
          tableDisplayAckKey(input.code),
          tableRegistryKey(input.code),
        ],
        [checked.hash, checked.nonceHash, JSON.stringify(input.ack)]
      )
    );
    switch (result?.status) {
      case 'recorded':
        return typeof result.receivedAt === 'number'
          ? { status: 'recorded', receivedAt: result.receivedAt }
          : { status: 'error' };
      case 'stale':
      case 'unbound':
        return { status: 'stale' };
      case 'in-use':
        return inUse();
      case 'expired':
        return expired();
      default:
        return { status: 'error' };
    }
  } catch {
    return { status: 'error' };
  }
}

const STATES: ReadonlySet<string> = new Set([
  'none',
  'loaded',
  'blank',
  'waiting',
  'updating',
  'stale',
]);

/** E13: the DM-only display status, computed server-side. */
export async function readDisplayStatus(
  rawRedis: DisplayRedis,
  code: string
): Promise<{ status: 'ok'; display: DisplayStatus } | { status: 'error' }> {
  try {
    const result = record(
      await rawRedis.eval(
        DISPLAY_STATUS_SCRIPT,
        [
          tableControlKey(code),
          tableDisplayAckKey(code),
          tableRegistryKey(code),
        ],
        []
      )
    );
    if (
      !result ||
      typeof result.state !== 'string' ||
      !STATES.has(result.state)
    )
      return { status: 'error' };
    return {
      status: 'ok',
      display: {
        state: result.state as DisplayStatusState,
        sceneId: typeof result.sceneId === 'string' ? result.sceneId : null,
        ageMs: typeof result.ageMs === 'number' ? result.ageMs : null,
      },
    };
  } catch {
    return { status: 'error' };
  }
}
