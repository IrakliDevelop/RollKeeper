import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { SheetDrawer } from '.';
import { SHEET_TAB_STORAGE_KEY } from './SheetDrawer.types';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type {
  CharacterState,
  ExtendedFeature,
  MulticlassInfo,
  Spell,
  SpellSlots,
  TemporaryBuff,
} from '@/types/character';

const EMPTY_SLOTS: SpellSlots = {
  1: { max: 0, used: 0 },
  2: { max: 0, used: 0 },
  3: { max: 0, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

function classInfo(overrides: Partial<MulticlassInfo>): MulticlassInfo {
  return {
    className: 'Adventurer',
    level: 1,
    isCustom: false,
    hitDie: 8,
    ...overrides,
  };
}

function spell(
  overrides: Partial<Spell> & Pick<Spell, 'id' | 'name' | 'level'>
): Spell {
  return {
    school: 'Divination',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Story fixture spell.',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// A cantrip (for the "Cantrips" group heading) plus one prepared and one
// unprepared leveled spell, so the Spells tab story exercises the prepare
// toggle and the pip row for a real slot.
const KAELEN_SPELLS: Spell[] = [
  spell({
    id: 'guidance',
    name: 'Guidance',
    level: 0,
    castingTime: '1 action',
    range: 'Touch',
    duration: 'Concentration, up to 1 minute',
    description: 'Touch a willing creature and give it a boost to a check.',
  }),
  spell({
    id: 'huntersmark',
    name: "Hunter's Mark",
    level: 1,
    castingTime: '1 bonus action',
    range: '90 feet',
    duration: 'Concentration, up to 1 hour',
    description: 'You choose a creature and mystically mark it as your quarry.',
    concentration: true,
    isPrepared: true,
  }),
  spell({
    id: 'curewounds',
    name: 'Cure Wounds',
    level: 1,
    school: 'Evocation',
    range: 'Touch',
    description: 'A creature you touch regains hit points.',
    isPrepared: false,
  }),
];

const KAELEN_FEATURES: ExtendedFeature[] = [
  {
    id: 'second-wind',
    name: 'Second Wind',
    sourceType: 'class',
    maxUses: 1,
    usedUses: 0,
    restType: 'short',
    displayOrder: 0,
    description: '<p>Regain 1d10 + fighter level hit points.</p>',
    createdAt: '',
    updatedAt: '',
  },
];

const KAELEN_BUFFS: TemporaryBuff[] = [
  {
    id: 'buff-marked-quarry',
    name: "Hunter's Mark",
    effects: [],
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
];

// Ranger 6 / Fighter 1 (not the brief's literal "Ranger 5 / Fighter 2"): the
// store's multiclass spell-slot recompute in `loadCharacterState` derives
// slot maxes from `floor(rangerLevel / 2)` (half caster) against the full
// caster table, discarding whatever max I set on `spellSlots` directly.
// Ranger 5 / Fighter 2 yields caster level 2 → only a 1st-level slot (max 3,
// no 2nd level). Ranger 6 / Fighter 1 yields caster level 3 → 1st max 4 / 2nd
// max 2, which is what actually renders as "3/4" and "2/2" remaining/max.
// Total level (7) and the hit dice pool (d10 4/7 remaining) match the brief.
const kaelenFixture: CharacterState = makeCharacter({
  name: 'Kaelen Voss',
  race: 'Half-Elf',
  background: 'Outlander',
  class: { name: 'Ranger', isCustom: false, spellcaster: 'half', hitDie: 10 },
  classes: [
    classInfo({
      className: 'Ranger',
      level: 6,
      hitDie: 10,
      spellcaster: 'half',
    }),
    classInfo({ className: 'Fighter', level: 1, hitDie: 10 }),
  ],
  level: 7,
  totalLevel: 7,
  hitDicePools: { d10: { max: 7, used: 3 } },
  spellSlots: {
    ...EMPTY_SLOTS,
    1: { max: 4, used: 1 },
    2: { max: 2, used: 0 },
  },
  concentration: { isConcentrating: true, spellName: "Hunter's Mark" },
  heroicInspiration: { count: 1, maxCount: 1 },
  spells: KAELEN_SPELLS,
  extendedFeatures: KAELEN_FEATURES,
  temporaryBuffs: KAELEN_BUFFS,
});

const nonCasterFixture: CharacterState = makeCharacter({
  name: 'Borin Ironfist',
  race: 'Dwarf',
  background: 'Soldier',
  class: { name: 'Fighter', isCustom: false, spellcaster: 'none', hitDie: 10 },
  classes: [classInfo({ className: 'Fighter', level: 5, hitDie: 10 })],
  level: 5,
  totalLevel: 5,
  hitDicePools: { d10: { max: 5, used: 0 } },
  spellSlots: { ...EMPTY_SLOTS },
});

function withCharacter(character: CharacterState): Decorator {
  function CharacterSeedDecorator(Story: Parameters<Decorator>[0]) {
    // Story/test-only: seeds the character store directly, same pattern the
    // component's own unit tests use in `beforeEach`.
    useCharacterStore.getState().loadCharacterState(character);
    return <Story />;
  }
  return CharacterSeedDecorator;
}

/** Pre-selects a tab by seeding the persisted-tab localStorage key before
 *  the drawer mounts — same key `useSheetTabs` reads on first render. */
function withStoredTab(tabId: string): Decorator {
  function StoredTabDecorator(Story: Parameters<Decorator>[0]) {
    try {
      window.localStorage.setItem(SHEET_TAB_STORAGE_KEY, tabId);
    } catch {
      // localStorage unavailable — the story still renders, just on Overview.
    }
    return <Story />;
  }
  return StoredTabDecorator;
}

function body() {
  // The drawer portals to document.body via Radix — query the whole document,
  // not the Storybook canvas element.
  return within(document.body);
}

const meta: Meta<typeof SheetDrawer> = {
  title: 'Campaign/PlayerVtt/SheetDrawer',
  component: SheetDrawer,
  args: {
    open: true,
    onClose: fn(),
    addToast: fn(),
    showAttackRoll: fn(),
    onRested: fn(),
    spellCasting: {
      onCastPlacement: fn(),
      connectionLive: true,
      hasPendingPlacement: false,
      onCancelPlacement: fn(),
    },
  },
};

export default meta;

type Story = StoryObj<typeof SheetDrawer>;

export const Desktop: Story = {
  decorators: [withCharacter(kaelenFixture)],
  parameters: {
    viewport: {
      viewports: {
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '900px' },
        },
      },
      defaultViewport: 'desktop',
    },
  },
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /kaelen voss/i })
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('button', { name: /locked/i }));
    await expect(screen.getByText(/editing unlocked/i)).toBeInTheDocument();
  },
};

export const Tablet: Story = {
  decorators: [withCharacter(kaelenFixture)],
  parameters: {
    viewport: {
      viewports: {
        tablet: {
          name: 'Tablet',
          styles: { width: '1180px', height: '820px' },
        },
      },
      defaultViewport: 'tablet',
    },
  },
  play: async () => {
    const screen = body();
    const dialog = await waitFor(() =>
      screen.getByRole('dialog', { name: /kaelen voss/i })
    );
    await expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(580);
  },
};

// The repo's dark-mode mechanism is the `theme` global (see
// `.storybook/preview.tsx`'s `withTheme` decorator), not a `theme` parameter.
export const Dark: Story = {
  decorators: [withCharacter(kaelenFixture)],
  globals: { theme: 'dark' },
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /kaelen voss/i })
      ).toBeInTheDocument()
    );
  },
};

export const NonCaster: Story = {
  decorators: [withCharacter(nonCasterFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /borin ironfist/i })
      ).toBeInTheDocument()
    );
    await expect(screen.queryByText(/spell slots/i)).not.toBeInTheDocument();
  },
};

export const AbilitiesTabStory: Story = {
  name: 'Abilities tab',
  decorators: [withStoredTab('abilities'), withCharacter(kaelenFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /abilities/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(screen.getByText('Stealth')).toBeInTheDocument();
  },
};

export const SpellsTabStory: Story = {
  name: 'Spells tab',
  decorators: [withStoredTab('spells'), withCharacter(kaelenFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /spells/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(
      screen.getByRole('heading', { name: 'Cantrips', level: 3 })
    ).toBeInTheDocument();
  },
};

export const FeaturesTabStory: Story = {
  name: 'Features tab',
  decorators: [withStoredTab('features'), withCharacter(kaelenFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /features/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(screen.getByText('Second Wind')).toBeInTheDocument();
  },
};

export const EffectsTabStory: Story = {
  name: 'Effects tab',
  decorators: [withStoredTab('effects'), withCharacter(kaelenFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /effects/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(
      screen.getByRole('button', { name: 'Prone' })
    ).toBeInTheDocument();
  },
};
