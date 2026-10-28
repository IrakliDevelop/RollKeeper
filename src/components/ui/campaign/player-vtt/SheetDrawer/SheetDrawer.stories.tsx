import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { SheetDrawer } from '.';
import {
  INVENTORY_VIEW_STORAGE_KEY,
  SHEET_TAB_STORAGE_KEY,
} from './SheetDrawer.types';
import { useCharacterStore } from '@/store/characterStore';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import type {
  ArmorItem,
  CharacterState,
  ExtendedFeature,
  InventoryItem,
  MagicItem,
  MulticlassInfo,
  Spell,
  SpellSlots,
  TemporaryBuff,
  Weapon,
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

const KAELEN_WEAPONS: Weapon[] = [
  {
    id: 'longbow',
    name: 'Longbow',
    category: 'martial',
    weaponType: ['ranged'],
    damage: [{ dice: '1d8', type: 'piercing' }],
    enhancementBonus: 0,
    properties: ['ammunition', 'heavy', 'two-handed'],
    isEquipped: true,
    weight: 2,
    createdAt: '',
    updatedAt: '',
  },
];

const KAELEN_ARMOR: ArmorItem[] = [
  {
    id: 'studded-leather',
    name: 'Studded Leather',
    category: 'light',
    type: 'studded-leather',
    baseAC: 12,
    stealthDisadvantage: false,
    enhancementBonus: 0,
    isEquipped: true,
    weight: 13,
    createdAt: '',
    updatedAt: '',
  },
];

const KAELEN_MAGIC_ITEMS: MagicItem[] = [
  {
    id: 'ring-of-protection',
    name: 'Ring of Protection',
    category: 'ring',
    rarity: 'rare',
    description: 'A magic ring that grants a +1 bonus to AC and saving throws.',
    properties: [],
    requiresAttunement: true,
    isAttuned: true,
    createdAt: '',
    updatedAt: '',
  },
];

const KAELEN_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: 'rope-hempen',
    name: 'Rope, Hempen (50 feet)',
    category: 'misc',
    quantity: 1,
    weight: 10,
    tags: ['adventuring gear'],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'potion-of-healing',
    name: 'Potion of Healing',
    category: 'consumable',
    quantity: 2,
    weight: 0.5,
    tags: [],
    createdAt: '',
    updatedAt: '',
  },
];

const inventoryFixture: CharacterState = {
  ...kaelenFixture,
  weapons: KAELEN_WEAPONS,
  armorItems: KAELEN_ARMOR,
  magicItems: KAELEN_MAGIC_ITEMS,
  inventoryItems: KAELEN_INVENTORY_ITEMS,
  currency: { copper: 0, silver: 0, electrum: 0, gold: 25, platinum: 0 },
  attunementSlots: { max: 3, used: 1 },
};

const favoritesFixture: CharacterState = {
  ...inventoryFixture,
  sheetFavorites: [
    { kind: 'item', id: 'longbow' },
    // Guidance (not Hunter's Mark) — Hunter's Mark's name is also shown by
    // the header's concentration badge (kaelenFixture.concentration), which
    // would make it ambiguous for a story's play function to query.
    { kind: 'spell', id: 'guidance' },
    { kind: 'feature', id: 'second-wind' },
  ],
  // resolveSheetFavorites (src/utils/sheetFavorites.ts) treats the legacy
  // flags as authoritative for spell/feature membership — sheetFavorites
  // alone isn't enough for those two kinds.
  favoriteFeatureIds: ['second-wind'],
  spellbook: { ...kaelenFixture.spellbook, favoriteSpells: ['guidance'] },
};

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

/** Pre-selects the Inventory tab's grid view by seeding its persisted
 *  localStorage key before the drawer mounts — same pattern as
 *  `withStoredTab`, for `INVENTORY_VIEW_STORAGE_KEY`. */
function withInventoryView(mode: 'list' | 'grid'): Decorator {
  function InventoryViewDecorator(Story: Parameters<Decorator>[0]) {
    try {
      window.localStorage.setItem(INVENTORY_VIEW_STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable — the story still renders, just on list view.
    }
    return <Story />;
  }
  return InventoryViewDecorator;
}

// A party ally sharing their full public sheet — for the PartySheet branch's
// "shared" story.
const SHARED_ALLY: PartyMemberHP = {
  characterId: 'ally-elowen',
  characterName: 'Elowen Brightwood',
  playerName: 'Priya',
  className: 'Cleric',
  level: 5,
  armorClass: 18,
  hitPoints: { current: 18, max: 40, temporary: 0 },
  lastSynced: '2025-01-01T00:00:00.000Z',
  publicSheet: {
    subtitle: 'Cleric 5',
    hpState: 'Bloodied',
    speed: 30,
    passivePerception: 15,
    conditions: ['Prone'],
    concentration: 'Bless',
    equippedGear: ['Mace', 'Shield', 'Holy Symbol'],
  },
};

// The same ally with `sharePartyView` opted out — `publicSheet` is null.
const NOT_SHARED_ALLY: PartyMemberHP = {
  ...SHARED_ALLY,
  characterId: 'ally-dorric',
  characterName: 'Dorric Stonefist',
  playerName: 'Malik',
  publicSheet: null,
};

/** The switch's ::after hit box, centred on the track. */
function switchHitBox(toggle: HTMLElement) {
  const box = toggle.getBoundingClientRect();
  const after = getComputedStyle(toggle, '::after');
  const width = parseFloat(after.width);
  const height = parseFloat(after.height);
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height / 2,
    bottom: y + height / 2,
    width,
    height,
  };
}

function intersects(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number }
) {
  return (
    Math.round(a.left) < Math.round(b.right) &&
    Math.round(b.left) < Math.round(a.right) &&
    Math.round(a.top) < Math.round(b.bottom) &&
    Math.round(b.top) < Math.round(a.bottom)
  );
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
      options: {
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /kaelen voss/i })
      ).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('switch', { name: 'Edit sheet' }));
    await expect(
      screen.getByText(/changes save and sync to the dm/i)
    ).toBeInTheDocument();
  },
};

export const Tablet: Story = {
  decorators: [withCharacter(kaelenFixture)],
  parameters: {
    viewport: {
      options: {
        tablet: {
          name: 'Tablet',
          styles: { width: '1180px', height: '820px' },
          type: 'tablet',
        },
      },
    },
  },
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async () => {
    const screen = body();
    const dialog = await waitFor(() =>
      screen.getByRole('dialog', { name: /kaelen voss/i })
    );
    await expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(580);

    // Touch: the tabs reach 44px and the strip stays inside the drawer.
    const restore = emulateCoarsePointer();
    try {
      for (const tab of within(dialog).getAllByRole('tab')) {
        await expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(
          44
        );
      }
      // Taller tabs don't push the drawer into sideways scrolling, and all
      // six fit the strip without it scrolling either.
      await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
      const tablist = within(dialog).getByRole('tablist');
      await expect(tablist.scrollWidth).toBeLessThanOrEqual(
        tablist.clientWidth
      );
    } finally {
      restore();
    }
  },
};

/**
 * On a touch screen the Edit sheet switch reaches 44×44 and its hit box
 * touches neither Close nor any rest button.
 */
export const TouchTargets: Story = {
  decorators: [withCharacter(kaelenFixture)],
  beforeEach: () => emulateCoarsePointer(),
  play: async () => {
    const dialog = await waitFor(() =>
      body().getByRole('dialog', { name: /kaelen voss/i })
    );
    const drawer = within(dialog);
    const area = switchHitBox(
      drawer.getByRole('switch', { name: 'Edit sheet' })
    );
    await expect(area.width).toBeGreaterThanOrEqual(44);
    await expect(area.height).toBeGreaterThanOrEqual(44);
    for (const name of [/close sheet/i, /short rest/i, /long rest/i]) {
      const box = drawer.getByRole('button', { name }).getBoundingClientRect();
      await expect(intersects(area, box)).toBe(false);
    }
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

export const InventoryTabStory: Story = {
  name: 'Inventory tab',
  decorators: [withStoredTab('inventory'), withCharacter(inventoryFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /inventory/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(screen.getByText('Longbow')).toBeInTheDocument();
    await expect(screen.getByText('Studded Leather')).toBeInTheDocument();
    await expect(screen.getByText('Ring of Protection')).toBeInTheDocument();
    await expect(
      screen.getByText('Rope, Hempen (50 feet)')
    ).toBeInTheDocument();
  },
};

export const InventoryTabGridStory: Story = {
  name: 'Inventory tab (grid)',
  decorators: [
    withStoredTab('inventory'),
    withInventoryView('grid'),
    withCharacter(inventoryFixture),
  ],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /inventory/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await expect(
      screen.getByRole('button', { name: 'Grid view' })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
  },
};

export const OverviewFavoritesStory: Story = {
  name: 'Overview with favorites',
  // Explicit — otherwise it'd inherit whatever tab the previous story in
  // this file left in the persisted-tab localStorage key.
  decorators: [withStoredTab('overview'), withCharacter(favoritesFixture)],
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /kaelen voss/i })
      ).toBeInTheDocument()
    );
    // Scoped to the Favorites section: "Second Wind" is also a built-in
    // Fighter class resource rendered by SheetResources just below it on
    // this same tab, so an unscoped query would match both.
    const favoritesHeading = screen.getByRole('heading', {
      name: 'Favorites',
      level: 3,
    });
    const favorites = within(favoritesHeading.closest('div')!);
    await expect(favorites.getByText('Longbow')).toBeInTheDocument();
    await expect(favorites.getByText('Guidance')).toBeInTheDocument();
    await expect(favorites.getByText('Second Wind')).toBeInTheDocument();
  },
};

export const Party: Story = {
  name: 'Party member (shared)',
  decorators: [withCharacter(kaelenFixture)],
  args: {
    openTarget: { kind: 'party', characterId: SHARED_ALLY.characterId },
    partyMembers: [SHARED_ALLY],
  },
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /elowen brightwood limited view/i })
      ).toBeInTheDocument()
    );
    await expect(screen.getByText(/played by priya/i)).toBeInTheDocument();
    await expect(screen.getByText('Bloodied')).toBeInTheDocument();
    await expect(screen.getByText('Bless')).toBeInTheDocument();
    await expect(screen.getByText('Holy Symbol')).toBeInTheDocument();
    // This fixture has shareHpWithParty on (hitPoints non-null), so the exact
    // reading renders alongside the coarse word.
    await expect(screen.getByText('18/40')).toBeInTheDocument();
  },
};

export const PartyNotShared: Story = {
  name: 'Party member (not shared)',
  decorators: [withCharacter(kaelenFixture)],
  args: {
    openTarget: { kind: 'party', characterId: NOT_SHARED_ALLY.characterId },
    partyMembers: [NOT_SHARED_ALLY],
  },
  play: async () => {
    const screen = body();
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /dorric stonefist limited view/i })
      ).toBeInTheDocument()
    );
    await expect(
      screen.getByText(/dorric stonefist hasn't shared their sheet/i)
    ).toBeInTheDocument();
  },
};
