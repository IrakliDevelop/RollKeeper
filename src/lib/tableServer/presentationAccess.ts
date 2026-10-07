import { NextResponse, type NextRequest } from 'next/server';

import { authorizeBattleMapSession } from '@/lib/battleMapSessionAuth';
import { getRawRedis, getRedis } from '@/lib/redis';
import { authorizeTableDm } from './auth';
import { resolveTableResource, type TableResource } from './presentation';

/**
 * Generic shared-state features that in-repo callers POST to `/shared`
 * (default and explicit branches). Under Table v1 any other feature is 400.
 */
export const TABLE_V1_SHARED_FEATURES: ReadonlySet<string> = new Set([
  'message',
  'effects',
  'xp',
  'item_transfer',
  'calendar',
  'settings',
  'counters',
]);

/** One body for every hidden/unpresented/blanked/deleted/other answer. */
export const notFoundResponse = (): NextResponse =>
  NextResponse.json({ error: 'Not found' }, { status: 404 });

const unavailableResponse = (): NextResponse =>
  NextResponse.json(
    { error: 'Live authority is unavailable' },
    { status: 503 }
  );

export interface TableAccessCredential {
  role?: string | null;
  dmId?: string | null;
  playerId?: string | null;
  displayKey?: string | null;
}

export type TableAudienceRole = 'dm' | 'player' | 'display';

export type TableResourceAccess =
  | {
      status: 'allowed';
      role: TableAudienceRole;
      resource: Exclude<TableResource, { kind: 'error' | 'location' }>;
    }
  /** A verified location: the route applies its existing location auth. */
  | { status: 'location' }
  | { status: 'denied'; response: NextResponse };

/** Q4 wire shape: `role=player&playerId=` | `role=display&displayKey=` | `role=dm&dmId=`. */
export function credentialFromQuery(
  request: NextRequest
): TableAccessCredential {
  const search = request.nextUrl.searchParams;
  return {
    role: search.get('role'),
    dmId: search.get('dmId'),
    playerId: search.get('playerId'),
    displayKey: search.get('displayKey'),
  };
}

async function resolve(code: string, id: string): Promise<TableResource> {
  let rawRedis: ReturnType<typeof getRawRedis>;
  let redis: ReturnType<typeof getRedis>;
  try {
    rawRedis = getRawRedis();
    redis = getRedis();
  } catch {
    return { kind: 'error' };
  }
  return resolveTableResource({
    rawRedis,
    locationRedis: redis,
    campaign: code,
    id,
  });
}

/**
 * Verifies the caller's claimed identity with the existing checks (never
 * trusting `role` alone): DM through `authorizeTableDm`, player/display
 * through `authorizeBattleMapSession`. Missing or invalid → 403.
 */
export async function verifyTableCredential(
  request: NextRequest,
  code: string,
  credential: TableAccessCredential,
  mutation: boolean
): Promise<
  { ok: true; role: TableAudienceRole } | { ok: false; response: NextResponse }
> {
  const denied = (error: string) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status: 403 }),
  });
  if (credential.role === 'dm') {
    const auth = await authorizeTableDm(
      request,
      code,
      credential.dmId,
      mutation
    );
    return auth.ok ? { ok: true, role: 'dm' } : denied(auth.error);
  }
  if (credential.role === 'player' || credential.role === 'display') {
    const session = await authorizeBattleMapSession(
      getRedis(),
      code,
      request,
      {
        role: credential.role,
        playerId: credential.playerId ?? undefined,
        displayKey: credential.displayKey ?? undefined,
      },
      { mutation }
    );
    return session.authorized && session.role === credential.role
      ? { ok: true, role: credential.role }
      : denied(session.authorized ? 'Invalid credential' : session.error);
  }
  return denied('Valid table credentials are required');
}

/**
 * PR04 P5: the one presentation access decision for map-keyed HTTP reads
 * under `TABLE_PROTOCOL_V1_REQUIRED`. The resource kind is resolved server
 * side by id (path family and caller `kind` never matter); a verified
 * location returns `location` so the route keeps its own existing path.
 * Otherwise the credential is verified (403), then: a scene is readable by
 * the DM unless deleted, and by player/display only while it is the current
 * unblanked presentation; registered source maps and unregistered maps are
 * DM-only. Every audience miss is the same generic 404; read errors are 503.
 */
export async function authorizeTableResourceAccess(input: {
  request: NextRequest;
  code: string;
  id: string;
  credential: TableAccessCredential;
}): Promise<TableResourceAccess> {
  const resource = await resolve(input.code, input.id);
  if (resource.kind === 'error')
    return { status: 'denied', response: unavailableResponse() };
  if (resource.kind === 'location') return { status: 'location' };
  const identity = await verifyTableCredential(
    input.request,
    input.code,
    input.credential,
    false
  );
  if (!identity.ok) return { status: 'denied', response: identity.response };
  const visible =
    resource.kind === 'scene'
      ? identity.role === 'dm'
        ? !resource.deleted
        : resource.audienceVisible
      : identity.role === 'dm';
  return visible
    ? { status: 'allowed', role: identity.role, resource }
    : { status: 'denied', response: notFoundResponse() };
}

/**
 * Scene-id writes (marker publish PUT, fog-appearance PUT): campaign DM
 * mutation authority (origin/CSRF + account role + `verifyDmAuthority`) and
 * a registered, non-deleted scene; no lease is required. Non-scene ids keep
 * the route's existing write authorization (`legacy`).
 */
export async function authorizeTableSceneWrite(input: {
  request: NextRequest;
  code: string;
  id: string;
  dmId: unknown;
}): Promise<
  | { status: 'allowed' }
  | { status: 'legacy' }
  | { status: 'denied'; response: NextResponse }
> {
  const resource = await resolve(input.code, input.id);
  if (resource.kind === 'error')
    return { status: 'denied', response: unavailableResponse() };
  if (resource.kind !== 'scene') return { status: 'legacy' };
  const auth = await authorizeTableDm(
    input.request,
    input.code,
    input.dmId,
    true
  );
  if (!auth.ok)
    return {
      status: 'denied',
      response: NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      ),
    };
  return resource.deleted
    ? { status: 'denied', response: notFoundResponse() }
    : { status: 'allowed' };
}

/**
 * Audience writes (loot claim POST) after the route's own player checks:
 * only the presented, unblanked scene accepts them; source and unregistered
 * maps are 404; a verified location keeps its existing behavior.
 */
export async function authorizeTableAudienceWrite(input: {
  code: string;
  id: string;
}): Promise<
  | { status: 'allowed' }
  | { status: 'location' }
  | { status: 'denied'; response: NextResponse }
> {
  const resource = await resolve(input.code, input.id);
  if (resource.kind === 'error')
    return { status: 'denied', response: unavailableResponse() };
  if (resource.kind === 'location') return { status: 'location' };
  return resource.kind === 'scene' && resource.audienceVisible
    ? { status: 'allowed' }
    : { status: 'denied', response: notFoundResponse() };
}
