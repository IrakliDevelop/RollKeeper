import { describe, it, expect } from 'vitest';

import { resolveSubmissionTargets } from '@/utils/initiativeSubmission';

import type { Encounter, EncounterEntity } from '@/types/encounter';
import type { InitiativeSubmission } from '@/types/sharedState';

const entity = (o: Partial<EncounterEntity>): EncounterEntity =>
  ({
    id: 'e1',
    type: 'player',
    name: 'Fjord',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 20,
    maxHp: 20,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    playerCharacterId: 'char-1',
    ...o,
  }) as EncounterEntity;

const encounter = (o: Partial<Encounter>): Encounter =>
  ({
    id: 'enc-1',
    name: 'Ambush',
    isActive: false,
    round: 0,
    currentTurn: 0,
    entities: [entity({})],
    ...o,
  }) as Encounter;

const sub = (o: Partial<InitiativeSubmission>): InitiativeSubmission => ({
  requestId: 'req-1',
  playerId: 'char-1',
  value: 17,
  submittedAt: 1,
  ...o,
});

const req = { requestId: 'req-1', encounterId: 'enc-1' };

describe('resolveSubmissionTargets', () => {
  it('applies a matching submission to the entity by playerCharacterId', () => {
    const r = resolveSubmissionTargets(
      { 'char-1': sub({}) },
      req,
      encounter({})
    );
    expect(r.apply).toEqual([
      { entityId: 'e1', playerId: 'char-1', value: 17 },
    ]);
    expect(r.discard).toEqual([]);
  });

  it('discards stale requestIds without applying', () => {
    const r = resolveSubmissionTargets(
      { 'char-1': sub({ requestId: 'old' }) },
      req,
      encounter({})
    );
    expect(r.apply).toEqual([]);
    expect(r.discard).toEqual(['char-1']);
  });

  it('discards submissions with no matching entity', () => {
    const r = resolveSubmissionTargets(
      { 'char-9': sub({ playerId: 'char-9' }) },
      req,
      encounter({})
    );
    expect(r.apply).toEqual([]);
    expect(r.discard).toEqual(['char-9']);
  });

  it('applies nothing when combat is active or the encounter differs', () => {
    expect(
      resolveSubmissionTargets(
        { 'char-1': sub({}) },
        req,
        encounter({ isActive: true })
      ).apply
    ).toEqual([]);
    expect(
      resolveSubmissionTargets(
        { 'char-1': sub({}) },
        { requestId: 'req-1', encounterId: 'other' },
        encounter({})
      ).apply
    ).toEqual([]);
  });
});
