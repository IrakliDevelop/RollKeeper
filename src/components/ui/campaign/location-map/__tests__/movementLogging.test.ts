import { describe, it, expect, beforeEach } from 'vitest';

import { useCombatLogStore } from '@/store/combatLogStore';
import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';

import { resolveDmMovement, logDmMovement } from '../movementLogging';

function resetEncounterStore() {
  useEncounterStore.setState({
    encounters: [],
    activeEncounterId: null,
  });
}

function resetCombatLogStore() {
  useCombatLogStore.setState({
    encounters: {},
    combatLogTombstones: {},
    activeArchiveId: null,
    lastAdmissionError: null,
  });
}

describe('resolveDmMovement', () => {
  beforeEach(() => {
    resetEncounterStore();
  });

  it('finds a combatant by id with parsed walking speed', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          entities: [
            createMockEncounterEntity({
              id: 'e-1',
              name: 'Goblin',
              monsterStatBlock: {
                speed: '25 ft., climb 25 ft.',
              } as never,
            }),
          ],
        }),
      ],
    });

    const result = resolveDmMovement({ key: 'e-1', kind: 'combatant' }, [
      'enc-1',
    ]);

    expect(result).toEqual({ name: 'Goblin', walkFeet: 25 });
  });

  it('distinguishes no-walk (fly-only) speed from unknown/malformed speed', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          entities: [
            createMockEncounterEntity({
              id: 'e-flyer',
              name: 'Bat Swarm',
              monsterStatBlock: {
                speed: 'fly 60 ft. (hover)',
              } as never,
            }),
            createMockEncounterEntity({
              id: 'e-gibberish',
              name: 'Mystery',
              monsterStatBlock: {
                speed: 'gibberish',
              } as never,
            }),
          ],
        }),
      ],
    });

    expect(
      resolveDmMovement({ key: 'e-flyer', kind: 'combatant' }, ['enc-1'])
    ).toEqual({ name: 'Bat Swarm', walkFeet: 0 });

    expect(
      resolveDmMovement({ key: 'e-gibberish', kind: 'combatant' }, ['enc-1'])
    ).toEqual({ name: 'Mystery', walkFeet: 30 });
  });

  it('finds a player entity by playerCharacterId with the default speed', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          entities: [
            createMockEncounterEntity({
              id: 'e-2',
              type: 'player',
              name: 'Aria',
              playerCharacterId: 'char-1',
            }),
          ],
        }),
      ],
    });

    const result = resolveDmMovement({ key: 'char-1', kind: 'player' }, [
      'enc-1',
    ]);

    expect(result).toEqual({ name: 'Aria', walkFeet: 30 });
  });

  it('returns null for an entity in a non-linked encounter', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-unlinked',
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
      ],
    });

    const result = resolveDmMovement({ key: 'e-1', kind: 'combatant' }, [
      'enc-linked-only',
    ]);

    expect(result).toBeNull();
  });
});

describe('logDmMovement', () => {
  const PAYLOAD = {
    entityId: 'e-1',
    entityName: 'Goblin',
    feet: 30,
    cells: 6,
    from: { x: 0, y: 0 },
    to: { x: 150, y: 0 },
  };

  beforeEach(() => {
    resetEncounterStore();
    resetCombatLogStore();
  });

  it('writes one event with the active encounter round/currentTurn when the archive is linked', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({ id: 'enc-1', round: 3, currentTurn: 2 }),
      ],
    });
    const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;

    logDmMovement(['enc-1'], PAYLOAD);

    const events = useCombatLogStore.getState().getEvents(archiveId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'movement',
      encounterId: 'enc-1',
      round: 3,
      turn: 2,
      ...PAYLOAD,
    });
  });

  it('no-ops when there is no active archive', () => {
    useEncounterStore.setState({
      encounters: [createMockEncounter({ id: 'enc-1' })],
    });
    const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;
    useCombatLogStore.getState().setActiveArchive(null);

    logDmMovement(['enc-1'], PAYLOAD);

    expect(useCombatLogStore.getState().getEvents(archiveId)).toHaveLength(0);
  });

  it('no-ops when the active archive belongs to an unlinked encounter', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({ id: 'enc-1' }),
        createMockEncounter({ id: 'enc-2' }),
      ],
    });
    const archiveId = useCombatLogStore.getState().startArchive('enc-2')!;

    logDmMovement(['enc-1'], PAYLOAD);

    expect(useCombatLogStore.getState().getEvents(archiveId)).toHaveLength(0);
  });
});
