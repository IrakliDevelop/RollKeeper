// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { useDmStore } from '@/store/dmStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';
import type { Spell } from '@/types/character';
import type {
  CampaignNPC,
  EncounterEntity,
  NPCSpellcasting,
} from '@/types/encounter';

import {
  findConfirmDialog,
  queryConfirmDialog,
  renderConfirmDialogHost,
} from '@/test/confirmDialog';

import { NPCSpellTab } from '../NPCSpellTab';
import { castMessage } from '../NPCSpellTab/NPCSpellTab.utils';

vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({
    spells: [],
    loading: false,
    error: null,
    searchResults: () => [],
    getSpellById: () => undefined,
    getSpellByName: () => undefined,
  }),
}));

const CODE = 'ABCD';
const NPC_ID = 'npc-1';
const NOW = '2026-01-01T00:00:00.000Z';

function makeSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 'spell-1',
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'A mote of fire.',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const FIRE_BOLT = makeSpell();
const DETECT_MAGIC = makeSpell({
  id: 'spell-2',
  name: 'Detect Magic',
  level: 1,
  ritual: true,
});
const MISTY_STEP = makeSpell({ id: 'spell-3', name: 'Misty Step', level: 2 });

function makeNpc(
  spellcasting: Partial<NPCSpellcasting> = {},
  overrides: Partial<CampaignNPC> = {}
): CampaignNPC {
  return {
    id: NPC_ID,
    campaignCode: CODE,
    name: 'Mira',
    armorClass: '12',
    maxHp: 20,
    speed: '30 ft',
    inventory: [],
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
    spellcasting: {
      casterLevel: 5,
      ability: 'wisdom',
      slotsUsed: {},
      spells: [FIRE_BOLT, DETECT_MAGIC, MISTY_STEP],
      ...spellcasting,
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Reads the NPC from the store so writes re-render the tab. */
function Harness(
  props: Omit<React.ComponentProps<typeof NPCSpellTab>, 'npc' | 'campaignCode'>
) {
  const npc = useNPCStore(state =>
    state.npcsByCampaign[CODE]?.find(n => n.id === NPC_ID)
  );
  return npc ? <NPCSpellTab npc={npc} campaignCode={CODE} {...props} /> : null;
}

function setup(
  npc: CampaignNPC = makeNpc(),
  props: React.ComponentProps<typeof Harness> = {}
) {
  useNPCStore.setState({ npcsByCampaign: { [CODE]: [npc] } });
  return render(<Harness {...props} />);
}

function storedNpc() {
  return useNPCStore.getState().getNPC(CODE, NPC_ID)!;
}

function useTrackerMode() {
  useDmStore.setState({
    campaigns: [
      {
        code: CODE,
        name: 'Table',
        createdAt: NOW,
        dmDashboardUi: {
          npcInlineSpellSlots: false,
          npcSeparateSpellSlotTracker: true,
        },
      },
    ],
  });
}

/** Opens the row's cast modal and returns a scope for its dialog. */
async function openCastModal(
  user: ReturnType<typeof userEvent.setup>,
  spell: string
) {
  await user.click(screen.getByRole('button', { name: `Cast ${spell}` }));
  return within(screen.getByRole('dialog', { name: `Cast ${spell}` }));
}

beforeEach(() => {
  useNPCStore.setState({ npcsByCampaign: {} });
  useDmStore.setState({ campaigns: [] });
  useEncounterStore.setState({ encounters: [] });
  // Without a host, confirmDialog resolves false and Remove never happens.
  renderConfirmDialogHost();
});

afterEach(() => {
  cleanup();
  useNPCStore.setState({ npcsByCampaign: {} });
  useDmStore.setState({ campaigns: [] });
  useEncounterStore.setState({ encounters: [] });
});

describe('NPCSpellTab summary line', () => {
  it('reads as one line with a described Reset slots button and no long rest', () => {
    setup();
    const summary = screen.getByText(/^Caster level/, { selector: 'p' });
    expect(summary).toHaveTextContent(
      'Caster level 5 · Wisdom · Spell attack +7 · Spell save DC 15'
    );
    expect(screen.queryByText('Spellcasting Stats')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reset slots' })
    ).toHaveAccessibleDescription('Restores spell slots and innate casts.');
    expect(screen.queryByRole('button', { name: /long rest/i })).toBeNull();
  });
});

describe('NPCSpellTab slot pips', () => {
  it('bug 1: pips spend and restore one slot', async () => {
    const user = userEvent.setup();
    setup(makeNpc({ slotsUsed: { 1: 1 } }));
    expect(
      screen.getByRole('group', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Restore a level 1 slot' })
    );
    expect(storedNpc().spellcasting?.slotsUsed[1]).toBe(0);

    await user.click(
      screen.getAllByRole('button', { name: 'Spend a level 1 slot' })[1]
    );
    expect(storedNpc().spellcasting?.slotsUsed[1]).toBe(1);

    await user.click(
      screen.getAllByRole('button', { name: 'Spend a level 1 slot' })[0]
    );
    expect(storedNpc().spellcasting?.slotsUsed[1]).toBe(2);
  });
});

describe('castMessage', () => {
  it('prefers cantrip, then ritual, then innate, else the level', () => {
    expect(castMessage(0, false, false)).toBe('Cast as a cantrip');
    expect(castMessage(3, false, true)).toBe('Cast as a ritual');
    expect(castMessage(3, true, false)).toBe('Innate cast');
    expect(castMessage(3, false, false)).toBe('Cast at level 3');
  });
});

describe('NPCSpellTab casting', () => {
  it('bug 2: a ritual spends nothing', async () => {
    const user = userEvent.setup();
    setup(
      makeNpc({
        spells: [
          FIRE_BOLT,
          DETECT_MAGIC,
          makeSpell({
            id: 'spell-4',
            name: 'Fly',
            level: 3,
            freeCastMax: 1,
            freeCastsUsed: 0,
          }),
        ],
      })
    );
    const modal = await openCastModal(user, 'Detect Magic');
    await user.click(
      modal.getByRole('radio', { name: 'Cast as a ritual (no slot)' })
    );
    await user.click(modal.getByRole('button', { name: 'Cast Detect Magic' }));

    const sc = storedNpc().spellcasting!;
    expect(sc.slotsUsed[1] ?? 0).toBe(0);
    expect(sc.spells.map(s => s.freeCastsUsed ?? 0)).toEqual([0, 0, 0]);
    expect(
      document.body.querySelector('[data-toast-type="success"]')
    ).toHaveTextContent('Cast as a ritual');
  });

  it('casting at level 2 spends one level 2 slot', async () => {
    const user = userEvent.setup();
    setup(makeNpc({ slotsUsed: { 2: 1 } }));
    const modal = await openCastModal(user, 'Misty Step');
    await user.click(modal.getByRole('button', { name: 'Cast Misty Step' }));
    expect(storedNpc().spellcasting?.slotsUsed[2]).toBe(2);
    expect(
      document.body.querySelector('[data-toast-type="success"]')
    ).toHaveTextContent('Cast at level 2');
  });

  it('concentration writes to the encounter entity', async () => {
    const user = userEvent.setup();
    const entity: EncounterEntity = {
      id: 'ent-1',
      type: 'npc',
      name: 'Mira',
      initiative: 12,
      initiativeModifier: 0,
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      armorClass: 12,
      conditions: [],
    };
    useEncounterStore.setState({
      encounters: [{ id: 'enc-1', entities: [entity] } as never],
    });
    setup(
      makeNpc({
        spells: [
          makeSpell({
            id: 'spell-5',
            name: 'Bless',
            level: 1,
            concentration: true,
          }),
        ],
      }),
      { encounterId: 'enc-1', npcEntityId: 'ent-1' }
    );
    const modal = await openCastModal(user, 'Bless');
    await user.click(modal.getByRole('button', { name: 'Cast Bless' }));
    const stored = useEncounterStore
      .getState()
      .encounters.find(e => e.id === 'enc-1')
      ?.entities.find(e => e.id === 'ent-1');
    expect(stored?.concentrationSpell).toBe('Bless');
  });

  it('keeps the toast outside a surrounding dialog', async () => {
    const user = userEvent.setup();
    useNPCStore.setState({ npcsByCampaign: { [CODE]: [makeNpc()] } });
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mira</DialogTitle>
          </DialogHeader>
          <Harness />
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole('button', { name: 'Cast Fire Bolt' }));
    const modal = within(
      screen.getByRole('dialog', { name: 'Cast Fire Bolt' })
    );
    await user.click(modal.getByRole('button', { name: 'Cast Fire Bolt' }));
    const card = document.body.querySelector('[data-toast-type="success"]');
    expect(card).toHaveTextContent('Cast as a cantrip');
    expect(card?.closest('[role="dialog"]')).toBeNull();
  });
});

describe('NPCSpellTab reset slots', () => {
  it('zeroes slots and innate casts and leaves HP alone', async () => {
    const user = userEvent.setup();
    setup(
      makeNpc(
        {
          slotsUsed: { 1: 2, 2: 1 },
          spells: [
            FIRE_BOLT,
            makeSpell({
              id: 'spell-4',
              name: 'Fly',
              level: 3,
              freeCastMax: 2,
              freeCastsUsed: 1,
            }),
          ],
        },
        { currentHp: 3 }
      )
    );
    await user.click(screen.getByRole('button', { name: 'Reset slots' }));
    const npc = storedNpc();
    expect(Object.values(npc.spellcasting!.slotsUsed).every(n => n === 0)).toBe(
      true
    );
    expect(npc.spellcasting!.spells.map(s => s.freeCastsUsed ?? 0)).toEqual([
      0, 0,
    ]);
    expect(npc.currentHp).toBe(3);
  });
});

describe('NPCSpellTab sections', () => {
  it('lists spells under h3 Spells and h4 level headings, each collapsible', async () => {
    const user = userEvent.setup();
    setup();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Spells' })
    ).toBeInTheDocument();
    for (const name of ['Cantrips', 'Level 1', 'Level 2']) {
      expect(
        screen.getByRole('heading', { level: 4, name })
      ).toBeInTheDocument();
    }
    const level1 = screen.getByRole('button', { name: 'Level 1' });
    expect(level1).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Detect Magic')).toBeInTheDocument();

    await user.click(level1);
    expect(level1).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Detect Magic')).toBeNull();
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    // A heading carries its name (and pips for slotted levels), no count badge.
    const cantripsRow = screen.getByRole('heading', {
      level: 4,
      name: 'Cantrips',
    }).parentElement!;
    expect(cantripsRow).toHaveTextContent(/^Cantrips$/);
  });

  it('summarizes a collapsed Spells section with slots inline', () => {
    setup(
      makeNpc({ slotsUsed: { 1: 1 } }, { collapsedSpellSections: ['spells'] })
    );
    expect(screen.getByRole('region', { name: 'Spells' })).toHaveTextContent(
      '3 spells · 1 of 9 slots used'
    );
  });

  it('summarizes a collapsed Spells section without slots in tracker mode', () => {
    useTrackerMode();
    setup(
      makeNpc({ slotsUsed: { 1: 1 } }, { collapsedSpellSections: ['spells'] })
    );
    const region = screen.getByRole('region', { name: 'Spells' });
    expect(region).toHaveTextContent('3 spells');
    expect(region).not.toHaveTextContent('slots used');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Spell slots' })
    ).toBeInTheDocument();
    // The shared tracker renders its own controls under the heading.
    expect(
      screen.getAllByRole('button', { name: 'Spend a level 1 slot' }).length
    ).toBeGreaterThan(0);
  });

  it('summarizes a collapsed Spell slots section', () => {
    useTrackerMode();
    setup(
      makeNpc(
        { slotsUsed: { 1: 1 } },
        { collapsedSpellSections: ['slotTracker'] }
      )
    );
    expect(
      screen.getByRole('region', { name: 'Spell slots' })
    ).toHaveTextContent('1 of 9 slots used');
  });

  it('writes the Spells disclosure through updateNPC', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Spells' }));
    expect(storedNpc().collapsedSpellSections).toEqual(['spells']);
  });

  it('tracker spends through the store action', async () => {
    const user = userEvent.setup();
    useTrackerMode();
    setup();
    await user.click(
      screen.getAllByRole('button', { name: 'Spend a level 1 slot' })[0]
    );
    expect(storedNpc().spellcasting?.slotsUsed[1]).toBe(1);
  });
});

describe('NPCSpellTab innate casting', () => {
  const FLY = makeSpell({
    id: 'spell-4',
    name: 'Fly',
    level: 3,
    freeCastMax: 2,
    freeCastsUsed: 0,
  });

  it('a plain innate cast spends one innate cast', async () => {
    const user = userEvent.setup();
    setup(makeNpc({ spells: [FLY] }));
    const modal = await openCastModal(user, 'Fly');
    await user.click(modal.getByRole('button', { name: 'Cast Fly' }));
    expect(storedNpc().spellcasting?.spells[0].freeCastsUsed).toBe(1);
    expect(storedNpc().spellcasting?.slotsUsed[3] ?? 0).toBe(0);
  });

  it('a ritual cast of an innate spell spends neither a cast nor a slot', async () => {
    const user = userEvent.setup();
    const spell = makeSpell({
      id: 'spell-5',
      name: 'Augury',
      level: 2,
      ritual: true,
      freeCastMax: 1,
      freeCastsUsed: 0,
    });
    setup(makeNpc({ spells: [spell] }));
    const modal = await openCastModal(user, 'Augury');
    await user.click(
      modal.getByRole('radio', { name: 'Cast as a ritual (no slot)' })
    );
    await user.click(modal.getByRole('button', { name: 'Cast Augury' }));
    expect(storedNpc().spellcasting?.spells[0].freeCastsUsed ?? 0).toBe(0);
    expect(storedNpc().spellcasting?.slotsUsed[2] ?? 0).toBe(0);
  });
});

describe('NPCSpellTab rows', () => {
  it('shows Cast, View, Edit and Remove buttons named after the spell', () => {
    setup();
    for (const verb of ['Cast', 'View', 'Edit', 'Remove']) {
      expect(
        screen.getByRole('button', { name: `${verb} Fire Bolt` })
      ).toBeInTheDocument();
    }
  });
});

describe('NPCSpellTab readOnly', () => {
  it('bug 17: hides Edit and Remove but keeps casting, pips and Reset slots', async () => {
    const user = userEvent.setup();
    setup(makeNpc({ slotsUsed: { 1: 1 } }), { readOnly: true });
    expect(
      screen.getByRole('button', { name: 'Cast Fire Bolt' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'View Fire Bolt' })
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();

    const modal = await openCastModal(user, 'Misty Step');
    await user.click(modal.getByRole('button', { name: 'Cast Misty Step' }));
    expect(storedNpc().spellcasting?.slotsUsed[2]).toBe(1);

    await user.click(
      screen.getByRole('button', { name: 'Restore a level 1 slot' })
    );
    expect(storedNpc().spellcasting?.slotsUsed[1]).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Reset slots' }));
    expect(storedNpc().spellcasting?.slotsUsed[2] ?? 0).toBe(0);
  });
});

describe('NPCSpellTab remove', () => {
  const spellNames = () =>
    storedNpc().spellcasting?.spells.map(s => s.name) ?? [];

  it('bug 18: asks first and removes only on confirm', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Remove Fire Bolt' }));
    const dialog = await findConfirmDialog();
    expect(
      within(dialog).getByRole('heading', { name: 'Remove Fire Bolt?' })
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Mira no longer knows this spell.');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(queryConfirmDialog()).toBeNull());
    expect(spellNames()).toContain('Fire Bolt');

    await user.click(screen.getByRole('button', { name: 'Remove Fire Bolt' }));
    const again = await findConfirmDialog();
    fireEvent.click(
      within(again).getByRole('button', { name: 'Remove spell' })
    );
    await waitFor(() => expect(spellNames()).not.toContain('Fire Bolt'));
  });

  describe('focus', () => {
    const THREE = [
      makeSpell({ id: 'a', name: 'Alarm', level: 1 }),
      makeSpell({ id: 'b', name: 'Bless', level: 1 }),
      makeSpell({ id: 'c', name: 'Command', level: 1 }),
    ];

    async function remove(
      user: ReturnType<typeof userEvent.setup>,
      name: string
    ) {
      await user.click(screen.getByRole('button', { name: `Remove ${name}` }));
      const dialog = await findConfirmDialog();
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Remove spell' })
      );
    }

    it('moves to the next row, else the previous row', async () => {
      const user = userEvent.setup();
      setup(makeNpc({ spells: THREE }));
      await remove(user, 'Bless');
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Cast Command' })
        ).toHaveFocus()
      );
      await remove(user, 'Command');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Cast Alarm' })).toHaveFocus()
      );
    });

    it('moves to the Add spell button when the last spell goes', async () => {
      const user = userEvent.setup();
      const only = makeSpell({ id: 'a', name: 'Alarm', level: 1 });
      function WithAddButton() {
        const ref = useRef<HTMLButtonElement>(null);
        return (
          <>
            <button type="button" ref={ref}>
              Add spell
            </button>
            <Harness addSpellButtonRef={ref} />
          </>
        );
      }
      useNPCStore.setState({
        npcsByCampaign: { [CODE]: [makeNpc({ spells: [only] })] },
      });
      render(<WithAddButton />);
      await remove(user, 'Alarm');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add spell' })).toHaveFocus()
      );
    });
  });
});

describe('NPCSpellTab filters', () => {
  const SPELLS = [
    makeSpell({ id: 'a', name: 'Alarm', level: 1, tags: ['Utility'] }),
    makeSpell({ id: 'b', name: 'Bless', level: 1 }),
    makeSpell({ id: 'c', name: 'Light', level: 0, freeCastMax: 0 }),
  ];

  it('toggles types, keeps the last one on, and clears tags', async () => {
    const user = userEvent.setup();
    setup(makeNpc({ spells: SPELLS }));
    const type = within(screen.getByRole('group', { name: 'Type' }));
    const slots = type.getByRole('button', { name: /^Uses slots/ });
    const atWill = type.getByRole('button', { name: /^At will/ });
    expect(slots).toHaveAttribute('aria-pressed', 'true');
    expect(atWill).toHaveAttribute('aria-pressed', 'true');
    expect(slots).toHaveTextContent('2');
    expect(atWill).toHaveTextContent('1');

    await user.click(atWill);
    expect(atWill).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Light')).toBeNull();

    await user.click(slots);
    expect(slots).toHaveAttribute('aria-pressed', 'true');

    const tags = within(screen.getByRole('group', { name: 'Tags' }));
    expect(screen.queryByRole('button', { name: 'Clear tags' })).toBeNull();
    const utility = tags.getByRole('button', { name: 'Utility' });
    await user.click(utility);
    expect(utility).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Bless')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear tags' }));
    expect(utility).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Clear tags' })).toBeNull();
    expect(utility).toHaveFocus();
    expect(screen.getByText('Bless')).toBeInTheDocument();
  });

  it('shows no filters for one type and no tags', () => {
    setup(makeNpc({ spells: [SPELLS[1]] }));
    expect(screen.queryByRole('group', { name: 'Type' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Tags' })).toBeNull();
  });
});

describe('NPCSpellTab empty state', () => {
  it('says there are no spells and offers no second Add button', () => {
    setup(makeNpc({ casterLevel: 1, slotOverrides: { 1: 0 }, spells: [] }));
    expect(screen.getByText('No spells yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add spell' })).toBeNull();
  });
});

describe('NPCSpellTab add and edit', () => {
  it('opens the add dialog through addSpellRef, adds, and focuses the new Cast', async () => {
    const user = userEvent.setup();
    const addSpellRef: React.MutableRefObject<(() => void) | null> = {
      current: null,
    };
    setup(makeNpc(), { addSpellRef });
    act(() => addSpellRef.current?.());
    const dialog = await screen.findByRole('dialog', {
      name: 'Add a spell to Mira',
    });
    await user.type(within(dialog).getByLabelText(/Spell Name/), 'Shield');
    await user.click(within(dialog).getByRole('button', { name: 'Add spell' }));

    await waitFor(() =>
      expect(storedNpc().spellcasting?.spells.map(s => s.name)).toContain(
        'Shield'
      )
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Cast Shield' })).toHaveFocus()
    );
  });

  it('edits through the dialog, keeps createdAt, and returns focus to Edit', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Edit Fire Bolt' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Edit Fire Bolt',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Save spell' })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Edit Fire Bolt' })
      ).toBeNull()
    );
    expect(storedNpc().spellcasting?.spells[0].createdAt).toBe(NOW);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Fire Bolt' })
      ).toHaveFocus()
    );
  });
});
