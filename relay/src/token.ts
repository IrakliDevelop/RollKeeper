import { createHmac, timingSafeEqual } from 'node:crypto';

export type BattleMapRole = 'dm' | 'player' | 'display';

export interface LegacyBattleMapTokenPayload {
  userId: string;
  role: BattleMapRole;
  /** Fieldnotes-safe battle-map room identifier minted by the application. */
  room: string;
  /** Expiry, unix epoch milliseconds */
  exp: number;
}

interface BattleMapAuthorityTokenBase {
  v: 1;
  userId: string;
  role: BattleMapRole;
  room: string;
  exp: number;
  campaign: string;
  resourceKind: 'scene';
  sceneId: string;
  epoch: string;
  roomGeneration: string;
}

export type BattleMapAuthorityTokenPayload =
  | (BattleMapAuthorityTokenBase & { role: 'dm'; writerFence: number })
  | (BattleMapAuthorityTokenBase & { role: 'player'; playerPrincipal: string })
  | (BattleMapAuthorityTokenBase & {
      role: 'display';
      displayGeneration: number;
    });
export type BattleMapTokenPayload =
  LegacyBattleMapTokenPayload | BattleMapAuthorityTokenPayload;

const ROLES: readonly string[] = ['dm', 'player', 'display'];
const CAMPAIGN = /^[A-Za-z0-9_-]{1,64}$/u;
const IDENTIFIER = /^[\x20-\x7e]{1,128}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function exactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    keys.length === wanted.length &&
    keys.every((key, index) => key === wanted[index])
  );
}

function validV1(payload: unknown): payload is BattleMapAuthorityTokenPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  const common =
    candidate.v === 1 &&
    typeof candidate.userId === 'string' &&
    IDENTIFIER.test(candidate.userId) &&
    typeof candidate.room === 'string' &&
    UUID.test(candidate.room) &&
    typeof candidate.exp === 'number' &&
    Number.isSafeInteger(candidate.exp) &&
    typeof candidate.campaign === 'string' &&
    CAMPAIGN.test(candidate.campaign) &&
    candidate.resourceKind === 'scene' &&
    typeof candidate.sceneId === 'string' &&
    IDENTIFIER.test(candidate.sceneId) &&
    typeof candidate.epoch === 'string' &&
    UUID.test(candidate.epoch) &&
    typeof candidate.roomGeneration === 'string' &&
    UUID.test(candidate.roomGeneration);
  if (!common) return false;
  const base = [
    'v',
    'userId',
    'role',
    'room',
    'exp',
    'campaign',
    'resourceKind',
    'sceneId',
    'epoch',
    'roomGeneration',
  ];
  if (candidate.role === 'dm')
    return (
      exactKeys(candidate, [...base, 'writerFence']) &&
      Number.isSafeInteger(candidate.writerFence) &&
      (candidate.writerFence as number) >= 0
    );
  if (candidate.role === 'player')
    return (
      exactKeys(candidate, [...base, 'playerPrincipal']) &&
      candidate.playerPrincipal === candidate.userId
    );
  if (candidate.role === 'display')
    return (
      exactKeys(candidate, [...base, 'displayGeneration']) &&
      Number.isSafeInteger(candidate.displayGeneration) &&
      (candidate.displayGeneration as number) >= 0
    );
  return false;
}

function hmac(body: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(body).digest();
}

export function signBattleMapToken(
  payload: BattleMapTokenPayload,
  secret: string
): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  return `${body}.${hmac(body, secret).toString('base64url')}`;
}

export function verifyBattleMapToken(
  token: string,
  secret: string,
  now: number = Date.now()
): BattleMapTokenPayload | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const expected = hmac(body, secret);
  const given = Buffer.from(token.slice(dot + 1), 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  let payload: BattleMapTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as BattleMapTokenPayload;
  } catch {
    return null;
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof payload.userId !== 'string' ||
    typeof payload.room !== 'string' ||
    typeof payload.exp !== 'number' ||
    !ROLES.includes(payload.role)
  ) {
    return null;
  }
  if ('v' in payload && !validV1(payload as unknown as Record<string, unknown>))
    return null;
  if (payload.exp < now) return null;
  return payload;
}
