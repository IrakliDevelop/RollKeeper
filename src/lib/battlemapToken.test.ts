import { describe, it, expect } from 'vitest';
import {
  signBattleMapToken,
  verifyBattleMapToken,
  type BattleMapTokenPayload,
} from '@/lib/battlemapToken';

const SECRET = 'test-secret';
const payload: BattleMapTokenPayload = {
  userId: 'dm-abc123',
  role: 'dm',
  room: 'ABC123:bm-xyz',
  exp: 1_700_000_000_000,
};

describe('battlemapToken', () => {
  it('round-trips a valid token', () => {
    const token = signBattleMapToken(payload, SECRET);
    expect(verifyBattleMapToken(token, SECRET, payload.exp - 1000)).toEqual(
      payload
    );
  });

  it('rejects an expired token', () => {
    const token = signBattleMapToken(payload, SECRET);
    expect(verifyBattleMapToken(token, SECRET, payload.exp + 1)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = signBattleMapToken(payload, 'other-secret');
    expect(verifyBattleMapToken(token, SECRET, payload.exp - 1000)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signBattleMapToken(payload, SECRET);
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...payload, role: 'dm', userId: 'attacker' }),
      'utf8'
    ).toString('base64url');
    expect(
      verifyBattleMapToken(`${forged}.${sig}`, SECRET, payload.exp - 1000)
    ).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(verifyBattleMapToken('not-a-token', SECRET)).toBeNull();
    expect(verifyBattleMapToken('a.b', SECRET)).toBeNull();
    expect(verifyBattleMapToken('', SECRET)).toBeNull();
  });

  it('rejects an invalid role', () => {
    const bad = { ...payload, role: 'admin' as never };
    const token = signBattleMapToken(bad, SECRET);
    expect(verifyBattleMapToken(token, SECRET, payload.exp - 1000)).toBeNull();
  });
});
