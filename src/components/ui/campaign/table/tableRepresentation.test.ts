import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElementStore, type CanvasElement } from '@fieldnotes/core';

import { fieldnotesElementRegistry } from '@/lib/fieldnotesVtt';
import {
  runCombatCommand,
  type TableCombatCommandV1,
} from '@/lib/table/combat';
import {
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from '@/lib/table/combat.fixture';
import type { TableRepository } from '@/lib/table/repository';
import {
  deriveSceneRoster,
  dmTokenFields,
  partyTokenFields,
  runRosterCommand,
  type TableRosterCommandV1,
  type TableSceneRoster,
} from '@/lib/table/roster';

import { createDisplayProjection } from './display/displayProjection';
import {
  representationFields,
  representationPatches,
  representationSummary,
  useTableRepresentationSync,
} from './tableRepresentation';
import type { TableRosterCanvas } from './useTableRosterState';

/**
 * PR07 P10 / R3-3: the DM canvas keeps `tableRepresentation: 'physical'` on
 * exactly the bound and alias tokens of physical members (live holder
 * only), clears orphan tags on token-like elements and never touches other
 * elements; a mixed fight is otherwise unchanged.
 */

afterEach(() => {
  cleanup();
  repositories.splice(0).forEach(repository => repository.dispose());
});

const goblinToken = {
  id: 'token-goblin',
  ...dmTokenFields('m-goblin'),
};
const orcToken = { id: 'token-orc', ...dmTokenFields('m-orc') };
const ariaToken = {
  id: 'token-aria',
  ...partyTokenFields('m-aria', 'legacy-aria'),
};

let counter = 0;
async function roster(
  repository: TableRepository,
  command: TableRosterCommandV1
) {
  const result = await runRosterCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId: `representation-${(counter += 1)}`,
    command,
    players: [
      { playerId: 'legacy-aria', characterId: 'legacy-aria', name: 'Aria' },
    ],
  });
  expect(['committed', 'unchanged']).toContain(result.status);
}
async function combat(
  repository: TableRepository,
  command: TableCombatCommandV1
) {
  const result = await runCombatCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId: `combat-${(counter += 1)}`,
    command,
  });
  expect(result.status).toBe('committed');
}
const bind = (
  sceneMemberId: string,
  tokenId: string
): TableRosterCommandV1 => ({
  type: 'roster.bindToken',
  sceneId: SCENE_ID,
  sceneMemberId,
  tokenId,
  at: AT,
});
const physical = (sceneMemberId: string): TableRosterCommandV1 => ({
  type: 'roster.setRepresentation',
  sceneId: SCENE_ID,
  sceneMemberId,
  representation: 'physical',
  at: AT,
});

function deriveRoster(
  repository: TableRepository,
  elements: Record<string, unknown>[]
): TableSceneRoster {
  return deriveSceneRoster({
    snapshot: readySnapshot(repository),
    sceneId: SCENE_ID,
    players: [
      { playerId: 'legacy-aria', characterId: 'legacy-aria', name: 'Aria' },
    ],
    canvasElements: elements,
    dmPrincipals: ['dm-1'],
  });
}

function fakeCanvas(elements: Record<string, unknown>[]) {
  const applyTokenPatch = vi.fn(
    (
      tokenId: string,
      patch: { set: Record<string, unknown>; unset: string[] }
    ) => {
      const element = elements.find(item => item.id === tokenId);
      if (!element) return false;
      Object.assign(element, patch.set);
      for (const key of patch.unset) delete element[key];
      return true;
    }
  );
  return {
    canvas: {
      elements: () => elements,
      subscribe: () => () => {},
      select: vi.fn(),
      armPlacement: vi.fn(),
      applyTokenPatch,
      ensurePlayerBand: vi.fn(),
    } satisfies TableRosterCanvas,
    applyTokenPatch,
  };
}

describe('representation patches (P10, R3-3)', () => {
  it('tags bound and alias tokens of physical members; no patch when already matching', async () => {
    const repository = await openFixture();
    await roster(repository, physical('m-goblin'));
    // `goblin-alias` is unbound but carries the goblin's member key: the DM
    // roster resolves it as an alias of the (physical) goblin.
    const elements: Record<string, unknown>[] = [
      { ...goblinToken },
      { ...orcToken },
      { id: 'goblin-alias', ...dmTokenFields('m-goblin') },
    ];
    const derived = deriveRoster(repository, elements);
    expect(
      derived.entries.find(entry => entry.actorId === 'goblin')!.aliasTokenIds
    ).toEqual(['goblin-alias']);
    const patches = representationPatches(elements, derived);
    expect(patches).toEqual([
      {
        tokenId: 'token-goblin',
        patch: { set: { tableRepresentation: 'physical' }, unset: [] },
      },
      {
        tokenId: 'goblin-alias',
        patch: { set: { tableRepresentation: 'physical' }, unset: [] },
      },
    ]);
    elements[0]!.tableRepresentation = 'physical';
    elements[2]!.tableRepresentation = 'physical';
    expect(
      representationPatches(elements, deriveRoster(repository, elements))
    ).toEqual([]);
  });

  it('removes the tag for digital members, removed members and orphans; leaves non-token elements alone', async () => {
    const repository = await openFixture();
    const elements: Record<string, unknown>[] = [
      { ...goblinToken, tableRepresentation: 'physical' },
      {
        id: 'self-tagged',
        tokenKind: 'player',
        characterId: 'legacy-x',
        tableRepresentation: 'physical',
      },
      { id: 'drawing', type: 'stroke', tableRepresentation: 'physical' },
    ];
    expect(
      representationPatches(elements, deriveRoster(repository, elements))
    ).toEqual([
      {
        tokenId: 'token-goblin',
        patch: { set: {}, unset: ['tableRepresentation'] },
      },
      {
        tokenId: 'self-tagged',
        patch: { set: {}, unset: ['tableRepresentation'] },
      },
    ]);
  });

  it('stamps new tokens of a physical member with the field', () => {
    expect(representationFields({ representation: 'physical' })).toEqual({
      tableRepresentation: 'physical',
    });
    expect(representationFields({ representation: 'digital' })).toEqual({});
  });

  it('summarises a mixed roster', async () => {
    const repository = await openFixture();
    await roster(repository, physical('m-goblin'));
    await roster(repository, physical('m-aria'));
    const entries = deriveRoster(repository, []).entries;
    const live = entries.filter(entry => !entry.removed).length;
    expect(representationSummary(entries)).toBe(
      `2 physical · ${live - 2} digital`
    );
    expect(
      representationSummary(
        entries.map(entry => ({ ...entry, representation: 'digital' as const }))
      )
    ).toBeNull();
  });
});

describe('useTableRepresentationSync (P10, R3-3)', () => {
  it('writes only while live holder, with a full pass on the holder transition and on canvas mount', async () => {
    const repository = await openFixture();
    await roster(repository, physical('m-goblin'));
    const elements: Record<string, unknown>[] = [{ ...goblinToken }];
    const value = deriveRoster(repository, elements);
    const { canvas, applyTokenPatch } = fakeCanvas(elements);
    const { rerender } = renderHook(
      props => useTableRepresentationSync(props),
      {
        initialProps: {
          canvas: null as TableRosterCanvas | null,
          roster: value,
          liveHolder: true,
        },
      }
    );
    expect(applyTokenPatch).not.toHaveBeenCalled();
    rerender({ canvas, roster: value, liveHolder: false });
    expect(applyTokenPatch).not.toHaveBeenCalled();
    rerender({ canvas, roster: value, liveHolder: true });
    expect(applyTokenPatch).toHaveBeenCalledTimes(1);
    expect(elements[0]!.tableRepresentation).toBe('physical');
    // Idempotent: a later pass on the same state writes nothing.
    rerender({
      canvas,
      roster: deriveRoster(repository, elements),
      liveHolder: true,
    });
    expect(applyTokenPatch).toHaveBeenCalledTimes(1);
  });

  it('a player move of a physical token keeps the field and causes no DM write (Lua parity)', async () => {
    const repository = await openFixture();
    await roster(repository, bind('m-aria', 'token-aria'));
    await roster(repository, physical('m-aria'));
    const store = new ElementStore(fieldnotesElementRegistry);
    store.add(
      {
        ...ariaToken,
        type: 'shape',
        position: { x: 0, y: 0 },
        size: { w: 1, h: 1 },
        zIndex: 1,
        locked: false,
        tableRepresentation: 'physical',
      } as unknown as CanvasElement,
      { origin: 'remote' }
    );
    // The relay lets a player change only `position` on a control-bearing
    // token (equal_except PLAYER_MOVE); the rest of the element, including
    // the field, is carried unchanged.
    store.update('token-aria', { position: { x: 3, y: 4 } } as never, {
      origin: 'remote',
    });
    const elements = store.getAll() as unknown as Record<string, unknown>[];
    expect(elements[0]!.tableRepresentation).toBe('physical');
    expect(
      representationPatches(elements, deriveRoster(repository, elements))
    ).toEqual([]);
  });
});

describe('mixed fight: two physical and one digital actor (S5)', () => {
  it('keeps roster, initiative, HP and turns unchanged and hides exactly the two physical tokens on the table only', async () => {
    const plain = await openFixture();
    const mixed = await openFixture();
    for (const repository of [plain, mixed]) {
      await roster(repository, bind('m-orc', 'token-orc'));
      await roster(repository, bind('m-aria', 'token-aria'));
    }
    await roster(mixed, physical('m-goblin'));
    await roster(mixed, physical('m-aria'));
    const fight = async (repository: TableRepository) => {
      await combat(repository, {
        type: 'combat.createRun',
        sceneId: SCENE_ID,
        runId: 'run-mixed',
        label: 'Mixed',
        at: AT,
      });
      await combat(repository, {
        type: 'combat.setParticipants',
        runId: 'run-mixed',
        actorIds: ['goblin', 'orc', 'aria'],
        at: AT,
      });
      for (const [actorId, value] of [
        ['goblin', 15],
        ['orc', 12],
        ['aria', 18],
      ] as const)
        await combat(repository, {
          type: 'combat.setInitiative',
          runId: 'run-mixed',
          actorId,
          value,
          at: AT,
        });
      await combat(repository, {
        type: 'combat.start',
        runId: 'run-mixed',
        at: AT,
      });
      await combat(repository, {
        type: 'combat.applyStat',
        runId: 'run-mixed',
        actorId: 'goblin',
        change: { kind: 'damage', value: 4 },
        at: AT,
      });
      await combat(repository, {
        type: 'combat.nextTurn',
        runId: 'run-mixed',
        at: AT,
      });
      await combat(repository, {
        type: 'combat.nextTurn',
        runId: 'run-mixed',
        at: AT,
      });
      const snapshot = readySnapshot(repository);
      const run = snapshot.encounters.find(item => item.runId === 'run-mixed')!;
      return {
        run: {
          round: run.round,
          currentActorId: run.currentActorId,
          participants: run.participants,
        },
        hp: snapshot.actors
          .filter(actor => ['goblin', 'orc'].includes(actor.actorId))
          .map(actor => [actor.actorId, actor.liveStats?.currentHp]),
      };
    };
    expect(await fight(mixed)).toEqual(await fight(plain));

    const mixedRoster = deriveRoster(mixed, [goblinToken, orcToken, ariaToken]);
    expect(
      mixedRoster.entries
        .filter(entry => ['goblin', 'orc', 'aria'].includes(entry.actorId))
        .map(entry => [entry.actorId, entry.representation])
    ).toEqual([
      ['goblin', 'physical'],
      ['orc', 'digital'],
      ['aria', 'physical'],
    ]);
    // DM canvas reconciliation, then the relay delivers the same elements
    // to the display (projection) and to the player (plain store).
    const elements: Record<string, unknown>[] = [
      { ...goblinToken },
      { ...orcToken },
      { ...ariaToken },
    ];
    const { canvas } = fakeCanvas(elements);
    renderHook(() =>
      useTableRepresentationSync({
        canvas,
        roster: deriveRoster(mixed, elements),
        liveHolder: true,
      })
    );
    const relayed = new ElementStore(fieldnotesElementRegistry);
    const display = new ElementStore(fieldnotesElementRegistry);
    const player = new ElementStore(fieldnotesElementRegistry);
    const stop = createDisplayProjection(relayed, display);
    for (const element of elements) {
      const full = {
        type: 'shape',
        position: { x: 0, y: 0 },
        size: { w: 1, h: 1 },
        zIndex: 1,
        locked: false,
        ...element,
      } as unknown as CanvasElement;
      relayed.add(full, { origin: 'remote' });
      player.add({ ...full }, { origin: 'remote' });
    }
    stop();
    expect(
      display
        .getAll()
        .map(element => element.id)
        .sort()
    ).toEqual(['token-orc']);
    expect(player.getById('token-aria')).toBeDefined();
    expect(player.count).toBe(3);
  });
});
