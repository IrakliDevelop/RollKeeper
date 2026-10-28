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
  room: 'ABC123_bm-xyz',
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

  it('round-trips an exact v1 authority token', () => {
    const authorityPayload: BattleMapTokenPayload = {
      v: 1,
      userId: 'dm-abc123',
      role: 'dm',
      room: '123e4567-e89b-42d3-a456-426614174000',
      exp: payload.exp,
      campaign: 'ABC123',
      resourceKind: 'scene',
      sceneId: 'scene-1',
      epoch: '123e4567-e89b-42d3-a456-426614174001',
      roomGeneration: '123e4567-e89b-42d3-a456-426614174002',
      writerFence: 7,
    };
    expect(
      verifyBattleMapToken(
        signBattleMapToken(authorityPayload, SECRET),
        SECRET,
        payload.exp - 1
      )
    ).toEqual(authorityPayload);
  });

  it('rejects malformed role-specific v1 claims and extra auth context', () => {
    const base = {
      v: 1 as const,
      userId: 'player-1',
      role: 'player' as const,
      room: '123e4567-e89b-42d3-a456-426614174000',
      exp: payload.exp,
      campaign: 'ABC123',
      resourceKind: 'scene' as const,
      sceneId: 'scene-1',
      epoch: '123e4567-e89b-42d3-a456-426614174001',
      roomGeneration: '123e4567-e89b-42d3-a456-426614174002',
      playerPrincipal: 'player-1',
    };
    for (const bad of [
      { ...base, playerPrincipal: 'player-2' },
      { ...base, writerFence: 1 },
      { ...base, room: 'ABC123_map-1' },
      { ...base, unexpected: true },
    ]) {
      expect(
        verifyBattleMapToken(
          signBattleMapToken(bad as BattleMapTokenPayload, SECRET),
          SECRET,
          payload.exp - 1
        )
      ).toBeNull();
    }
  });
});
