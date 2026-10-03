import { describe, it, expect } from 'vitest';
import {
  signBattleMapToken,
  verifyBattleMapToken,
  type BattleMapTokenPayload,
} from './token.js';

const SECRET = 'test-secret';
const payload: BattleMapTokenPayload = {
  userId: 'dm-abc123',
  role: 'dm',
  room: 'ABC123_bm-xyz',
  exp: 1_700_000_000_000,
};

describe('relay token verify', () => {
  it('round-trips', () => {
    const token = signBattleMapToken(payload, SECRET);
    expect(verifyBattleMapToken(token, SECRET, payload.exp - 1)).toEqual(
      payload
    );
  });
  it('rejects expiry, bad signature, garbage', () => {
    const token = signBattleMapToken(payload, SECRET);
    expect(verifyBattleMapToken(token, SECRET, payload.exp + 1)).toBeNull();
    expect(verifyBattleMapToken(token, 'wrong', payload.exp - 1)).toBeNull();
    expect(verifyBattleMapToken('garbage', SECRET)).toBeNull();
  });
  it('verifies a token produced by the app-side module format', () => {
    // Cross-check fixture: regenerate with
    //   npx tsx -e "…sign in app module…"  if the format ever changes.
    const token = signBattleMapToken(payload, SECRET);
    const [body] = token.split('.');
    expect(JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))).toEqual(
      payload
    );
  });

  it('freezes the exact v1 claim schema and role-specific claims', () => {
    const v1: BattleMapTokenPayload = {
      v: 1,
      userId: 'display-ABC123',
      role: 'display',
      room: '123e4567-e89b-42d3-a456-426614174000',
      exp: payload.exp,
      campaign: 'ABC123',
      resourceKind: 'scene',
      sceneId: 'scene-1',
      epoch: '123e4567-e89b-42d3-a456-426614174001',
      roomGeneration: '123e4567-e89b-42d3-a456-426614174002',
      displayGeneration: 2,
    };
    expect(
      verifyBattleMapToken(
        signBattleMapToken(v1, SECRET),
        SECRET,
        payload.exp - 1
      )
    ).toEqual(v1);
    expect(
      verifyBattleMapToken(
        signBattleMapToken(
          { ...v1, displayGeneration: undefined } as never,
          SECRET
        ),
        SECRET,
        payload.exp - 1
      )
    ).toBeNull();
  });
});
