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

    expect(result).toEqual({ name: 'Goblin', walkFeet: 25, entityId: 'e-1' });
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
    ).toEqual({ name: 'Bat Swarm', walkFeet: 0, entityId: 'e-flyer' });

    expect(
      resolveDmMovement({ key: 'e-gibberish', kind: 'combatant' }, ['enc-1'])
    ).toEqual({ name: 'Mystery', walkFeet: 30, entityId: 'e-gibberish' });
  });

  it('finds a player entity by playerCharacterId with the default speed, and returns the entity id (not the characterId) as entityId', () => {
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

    expect(result).toEqual({ name: 'Aria', walkFeet: 30, entityId: 'e-2' });
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

  it("writes one event with the active encounter round/currentTurn when the archive belongs to the entity's own encounter", () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          round: 3,
          currentTurn: 2,
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
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

  // Ended-encounter guard: an encounter whose only archive has already been
  // ended must not accept further movement logging, even though it's still
  // the entity's own containing encounter and would otherwise resolve.
  it("no-ops when the entity's own encounter has only an ENDED archive", () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
      ],
    });
    const archiveId = useCombatLogStore.getState().startArchive('enc-1')!;
    useCombatLogStore.getState().endArchive(archiveId);

    logDmMovement(['enc-1'], PAYLOAD);

    expect(useCombatLogStore.getState().getEvents(archiveId)).toHaveLength(0);
  });

  // Restart case: an old ended archive for the encounter must not shadow a
  // newer open one — logging must land in the NEW (latest, still-open)
  // archive, not silently no-op and not write into the ended one.
  it('logs into the NEW open archive when the encounter has an old ended archive and a new open one', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          round: 4,
          currentTurn: 2,
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
      ],
    });
    const oldArchiveId = useCombatLogStore.getState().startArchive('enc-1')!;
    useCombatLogStore.getState().endArchive(oldArchiveId);
    const newArchiveId = useCombatLogStore.getState().startArchive('enc-1')!;
    expect(newArchiveId).not.toBe(oldArchiveId);

    logDmMovement(['enc-1'], PAYLOAD);

    expect(useCombatLogStore.getState().getEvents(oldArchiveId)).toHaveLength(
      0
    );
    const events = useCombatLogStore.getState().getEvents(newArchiveId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'movement',
      encounterId: 'enc-1',
      round: 4,
      turn: 2,
      ...PAYLOAD,
    });
  });

  // Reported P1: two concurrently active encounters (combat started on X,
  // then on Y). Y owns the global `activeArchiveId` pointer, and ending Y
  // correctly clears it (Y's archive IS the active one) — but X is still in
  // combat with an OPEN archive of its own. Movement logging must resolve
  // PER ENCOUNTER, not via the now-null global pointer, or every X movement
  // silently no-ops for the rest of X's combat.
  it("start X then Y, end Y (pointer cleared): a movement of an X entity still logs into X's open archive with X's round/turn", () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-x',
          round: 2,
          currentTurn: 1,
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
        createMockEncounter({ id: 'enc-y', round: 9, currentTurn: 9 }),
      ],
    });
    const archiveX = useCombatLogStore.getState().startArchive('enc-x')!;
    const archiveY = useCombatLogStore.getState().startArchive('enc-y')!;
    expect(useCombatLogStore.getState().activeArchiveId).toBe(archiveY);

    // End Y: EncounterView clears the pointer since Y IS the active archive.
    useCombatLogStore.getState().endArchive(archiveY);
    useCombatLogStore.getState().setActiveArchive(null);
    expect(useCombatLogStore.getState().activeArchiveId).toBeNull();

    // X is still open — a movement for an X entity must still log, even
    // though the global pointer no longer names anything.
    logDmMovement(['enc-x', 'enc-y'], PAYLOAD);

    const events = useCombatLogStore.getState().getEvents(archiveX);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'movement',
      encounterId: 'enc-x',
      round: 2,
      turn: 1,
      ...PAYLOAD,
    });
  });

  it('no-ops when the entity has no open archive for its own linked encounter', () => {
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

  // Wrong-encounter attribution guard: the OLD gate only checked that the
  // active archive's encounter was somewhere in the linked list, so an
  // entity that actually lives in linked encounter B could log into an
  // archive active for linked encounter A, stamped with A's round/turn.
  // The gate must key off the moved entity's OWN containing encounter.
  it('multi-encounter map: active archive for enc-A logs nothing when the moved entity lives in enc-B', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({ id: 'enc-A', round: 1, currentTurn: 0 }),
        createMockEncounter({
          id: 'enc-B',
          round: 5,
          currentTurn: 3,
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
      ],
    });
    const archiveId = useCombatLogStore.getState().startArchive('enc-A')!;

    logDmMovement(['enc-A', 'enc-B'], PAYLOAD);

    expect(useCombatLogStore.getState().getEvents(archiveId)).toHaveLength(0);
  });

  it("multi-encounter map: active archive for enc-B (the entity's own encounter) logs with enc-B's round/turn", () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({ id: 'enc-A', round: 1, currentTurn: 0 }),
        createMockEncounter({
          id: 'enc-B',
          round: 5,
          currentTurn: 3,
          entities: [createMockEncounterEntity({ id: 'e-1', name: 'Goblin' })],
        }),
      ],
    });
    const archiveId = useCombatLogStore.getState().startArchive('enc-B')!;

    logDmMovement(['enc-A', 'enc-B'], PAYLOAD);

    const events = useCombatLogStore.getState().getEvents(archiveId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'movement',
      encounterId: 'enc-B',
      round: 5,
      turn: 3,
      ...PAYLOAD,
    });
  });
});
