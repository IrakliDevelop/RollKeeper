import { describe, it, expect } from 'vitest';
import { getOnDeckEntity } from '@/utils/encounterTurn';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';

describe('getOnDeckEntity', () => {
  it('returns null when encounter is not active', () => {
    const enc = createMockEncounter({
      isActive: false,
      currentTurn: 0,
      entities: [
        createMockEncounterEntity({ id: 'a' }),
        createMockEncounterEntity({ id: 'b' }),
      ],
    });
    expect(getOnDeckEntity(enc)).toBeNull();
  });

  it('returns null when there is only one entity', () => {
    const enc = createMockEncounter({
      isActive: true,
      currentTurn: 0,
      entities: [createMockEncounterEntity({ id: 'a' })],
    });
    expect(getOnDeckEntity(enc)).toBeNull();
  });

  it('returns null when there are no entities', () => {
    const enc = createMockEncounter({
      isActive: true,
      currentTurn: 0,
      entities: [],
    });
    expect(getOnDeckEntity(enc)).toBeNull();
  });

  it('returns the entity at (currentTurn + 1) % length', () => {
    const entityA = createMockEncounterEntity({ id: 'a', name: 'Alpha' });
    const entityB = createMockEncounterEntity({ id: 'b', name: 'Beta' });
    const entityC = createMockEncounterEntity({ id: 'c', name: 'Gamma' });
    const enc = createMockEncounter({
      isActive: true,
      currentTurn: 0,
      entities: [entityA, entityB, entityC],
    });
    expect(getOnDeckEntity(enc)).toEqual(entityB);
  });

  it('wraps around to the first entity after the last', () => {
    const entityA = createMockEncounterEntity({ id: 'a', name: 'Alpha' });
    const entityB = createMockEncounterEntity({ id: 'b', name: 'Beta' });
    const enc = createMockEncounter({
      isActive: true,
      currentTurn: 1, // last index → on-deck wraps to index 0
      entities: [entityA, entityB],
    });
    expect(getOnDeckEntity(enc)).toEqual(entityA);
  });

  it('returns second entity when currentTurn is middle of three', () => {
    const entityA = createMockEncounterEntity({ id: 'a' });
    const entityB = createMockEncounterEntity({ id: 'b' });
    const entityC = createMockEncounterEntity({ id: 'c' });
    const enc = createMockEncounter({
      isActive: true,
      currentTurn: 1,
      entities: [entityA, entityB, entityC],
    });
    expect(getOnDeckEntity(enc)).toEqual(entityC);
  });
});
