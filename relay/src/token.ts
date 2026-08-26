import { createHmac, timingSafeEqual } from 'node:crypto';

export type BattleMapRole = 'dm' | 'player' | 'display';

export interface BattleMapTokenPayload {
  userId: string;
  role: BattleMapRole;
  /** `${campaignCode}:${battleMapId}` */
  room: string;
  /** Expiry, unix epoch milliseconds */
  exp: number;
}

const ROLES: readonly string[] = ['dm', 'player', 'display'];

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
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
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
  if (payload.exp < now) return null;
  return payload;
}
