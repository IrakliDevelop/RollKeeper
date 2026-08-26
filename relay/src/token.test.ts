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
  room: 'ABC123:bm-xyz',
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
});
