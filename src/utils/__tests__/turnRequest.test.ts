import { describe, it, expect } from 'vitest';
import { shouldApplyTurnRequest } from '../turnRequest';
import type { Encounter } from '@/types/encounter';
import type { TurnEndRequest } from '@/types/sharedState';

function enc(o: Partial<Encounter> = {}): Encounter {
  return {
    id: 'enc-1',
    name: 'Fight',
    entities: [
      {
        id: 'a',
        type: 'player',
        name: 'Aragorn',
        initiative: 20,
        initiativeModifier: 0,
        currentHp: 10,
        maxHp: 10,
        tempHp: 0,
        armorClass: 10,
        conditions: [],
      },
    ],
    currentTurn: 0,
    round: 2,
    isActive: true,
    sortOrder: 'initiative',
    createdAt: '',
    updatedAt: '',
    ...o,
  };
}

const req = (o: Partial<TurnEndRequest> = {}): TurnEndRequest => ({
  encounterId: 'enc-1',
  round: 2,
  entityId: 'a',
  playerId: 'char-a',
  requestedAt: '',
  ...o,
});

describe('shouldApplyTurnRequest', () => {
  it('applies when encounter, round and current entity all match', () => {
    expect(shouldApplyTurnRequest(enc(), req())).toBe(true);
  });
  it('rejects when the round no longer matches (stale)', () => {
    expect(shouldApplyTurnRequest(enc({ round: 3 }), req({ round: 2 }))).toBe(
      false
    );
  });
  it("rejects when it is not that entity's turn", () => {
    expect(
      shouldApplyTurnRequest(
        enc({ currentTurn: 0 }),
        req({ entityId: 'someone-else' })
      )
    ).toBe(false);
  });
  it('rejects when the encounter id differs', () => {
    expect(
      shouldApplyTurnRequest(
        enc({ id: 'enc-2' }),
        req({ encounterId: 'enc-1' })
      )
    ).toBe(false);
  });
  it('rejects when combat is not active', () => {
    expect(shouldApplyTurnRequest(enc({ isActive: false }), req())).toBe(false);
  });
});
