import { randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import {
  prepareAuthorityCheckpoint,
  type AuthorityCheckpointPayload,
} from '@fieldnotes/sync';
import { createFogAuthorityServerExtension } from '@fieldnotes/vtt/server';

import { getRawRedis } from '@/lib/redis';
import {
  tableAuthorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from './keys';

interface AdminContext {
  campaign: string;
  sceneId: string;
  room: string;
  epoch: string;
  writerFence: number;
  principal: string;
  roomGeneration: string | null;
  casToken: string | null;
}
type AuthorityState = Omit<AuthorityCheckpointPayload, 'cursor' | 'casToken'>;

function record(value: unknown): Record<string, unknown> | null {
  try {
    const parsed =
      typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((key, index) => actual[index] === key)
  );
}

/** Validates the released SDK checkpoint contract without retaining a capture. */
export async function validateAuthorityState(
  value: unknown
): Promise<AuthorityState | null> {
  const state = objectRecord(value);
  if (!state || !hasExactKeys(state, ['elements', 'layers', 'extensions']))
    return null;
  if (!Array.isArray(state.elements) || !Array.isArray(state.layers))
    return null;
  const extensions = objectRecord(state.extensions);
  if (!extensions || !hasExactKeys(extensions, ['fog'])) return null;
  const fog = objectRecord(extensions.fog);
  if (!fog || !hasExactKeys(fog, ['pluginName', 'version', 'data']))
    return null;
  const fogData = fog.data === null ? null : objectRecord(fog.data);
  if (
    fog.data !== null &&
    (!fogData ||
      !hasExactKeys(fogData, ['meta', 'tiles']) ||
      !Array.isArray(fogData.tiles))
  )
    return null;
  try {
    const prepared = await prepareAuthorityCheckpoint(
      {
        ...(state as unknown as AuthorityState),
        cursor: {
          generation: 'rollkeeper-validation',
          streamId: '00000000000000000000000000000000',
          revision: 0,
        },
        casToken: 'rollkeeper-validation',
      } as AuthorityCheckpointPayload,
      {
        requestId: 'rollkeeper-validation',
        checkpointId: 'rollkeeper-validation',
        requiredExtensions: [createFogAuthorityServerExtension().requirement],
      }
    );
    prepared.dispose();
    return state as unknown as AuthorityState;
  } catch {
    return null;
  }
}

function relayUrl(path: string): string | null {
  const raw =
    process.env.BATTLEMAP_RELAY_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    url.pathname = path;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export async function readAuthorityRequest(
  request: NextRequest
): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > 21 * 1024 * 1024) throw new Error('oversized');
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 21 * 1024 * 1024) throw new Error('oversized');
  const value = JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  const result = record(value);
  if (!result) throw new Error('invalid');
  return result;
}

export async function authorityAdminContext(
  campaign: string,
  sceneId: unknown,
  principal: string
): Promise<AdminContext | null> {
  if (typeof sceneId !== 'string') return null;
  const redis = getRawRedis();
  const [controlRaw, registryRaw] = await Promise.all([
    redis.get(tableControlKey(campaign)),
    redis.hget(tableRegistryKey(campaign), sceneId),
  ]);
  const control = record(controlRaw);
  const registry = record(registryRaw);
  if (
    control?.v !== 1 ||
    typeof control.epoch !== 'string' ||
    typeof control.writerFence !== 'number' ||
    typeof control.leaseUntil !== 'number' ||
    control.leaseUntil <= Date.now() ||
    control.holderPrincipal !== principal ||
    registry?.v !== 1 ||
    registry.sceneId !== sceneId ||
    registry.deleted === true ||
    typeof registry.roomId !== 'string'
  )
    return null;
  let meta: Record<string, unknown> | null = null;
  try {
    meta = record(
      await redis.get(tableAuthorityRoomKeys(campaign, registry.roomId).meta)
    );
  } catch {
    return null;
  }
  return {
    campaign,
    sceneId,
    room: registry.roomId,
    epoch: control.epoch,
    writerFence: control.writerFence,
    principal,
    roomGeneration:
      meta?.v === 1 && typeof meta.generation === 'string'
        ? meta.generation
        : null,
    casToken:
      meta?.v === 1 && typeof meta.casToken === 'string' ? meta.casToken : null,
  };
}

async function relayAdmin(
  path: string,
  body: unknown
): Promise<Response | null> {
  const endpoint = relayUrl(path);
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  if (!endpoint || !secret) return null;
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rollkeeper-relay-secret': secret,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }
}

export async function captureAuthorityCheckpoint(context: AdminContext) {
  if (!context.roomGeneration) return null;
  return relayAdmin('/authority-admin/checkpoint', {
    ...context,
    roomGeneration: context.roomGeneration,
  });
}

export async function provisionAuthorityRoom(
  context: AdminContext,
  state: AuthorityState,
  expected: { generation: string | null; casToken: string | null }
) {
  return relayAdmin('/authority-admin/provision', {
    ...context,
    state,
    expectedGeneration: expected.generation,
    expectedCasToken: expected.casToken,
    generation: randomUUID(),
    casToken: randomBytes(32).toString('hex'),
  });
}
