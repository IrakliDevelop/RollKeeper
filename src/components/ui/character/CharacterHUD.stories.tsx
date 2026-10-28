import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { Button } from '@/components/ui/forms/button';
import {
  emulateCoarsePointer,
  emulateReducedMotion,
} from '@/test/storybook/emulateCoarsePointer';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type {
  ActiveCondition,
  CharacterState,
  TemporaryBuff,
} from '@/types/character';
import CharacterHUD from './CharacterHUD';

/** The sizes a story picks with `globals: PHONE`, `IPAD_PORTRAIT` or `IPAD_LANDSCAPE`. */
const VIEWPORTS = {
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
  ipadPortrait: {
    name: 'iPad portrait',
    styles: { width: '820px', height: '1180px' },
    type: 'tablet',
  },
  ipadLandscape: {
    name: 'iPad landscape',
    styles: { width: '1180px', height: '820px' },
    type: 'tablet',
  },
} as const;

const PHONE = { viewport: { value: 'phone', isRotated: false } };
const IPAD_PORTRAIT = { viewport: { value: 'ipadPortrait', isRotated: false } };
const IPAD_LANDSCAPE = {
  viewport: { value: 'ipadLandscape', isRotated: false },
};

const DARK = { theme: 'dark' };

function hp(current: number, max: number, temporary = 0) {
  return { current, max, temporary, calculationMode: 'auto' as const };
}

const fighter = makeCharacter({ hitPoints: hp(42, 42) });

const wizard = makeCharacter({
  id: 'test-wizard',
  name: 'Test Wizard',
  class: { name: 'Wizard', isCustom: false, spellcaster: 'full', hitDie: 6 },
  abilities: {
    strength: 8,
    dexterity: 14,
    constitution: 14,
    intelligence: 18,
    wisdom: 12,
    charisma: 10,
  },
  hitPoints: hp(31, 42, 5),
  flySpeed: 30,
});

function condition(name: string): ActiveCondition {
  return {
    id: `condition-${name}`,
    name,
    source: 'XPHB',
    description: '',
    stackable: false,
    count: 1,
    appliedAt: '2026-10-28T00:00:00.000Z',
  };
}

const bless: TemporaryBuff = {
  id: 'buff-bless',
  name: 'Bless',
  effects: [
    { id: 'bless-1', targetStat: 'attackBonus', mode: 'add', value: 2 },
  ],
  isActive: true,
  createdAt: '2026-10-28T00:00:00.000Z',
  updatedAt: '2026-10-28T00:00:00.000Z',
};

/** Concentrating, two conditions and a buff: the contextual group in full. */
function busy(character: CharacterState): CharacterState {
  return {
    ...character,
    concentration: { isConcentrating: true, spellName: 'Hold Person' },
    conditionsAndDiseases: {
      ...character.conditionsAndDiseases,
      activeConditions: [condition('Poisoned'), condition('Prone')],
    },
    temporaryBuffs: [bless],
  };
}

/**
 * Row 1 of the character sheet: hit points with the tier bar and word, AC
 * in the brass shield, initiative, speed and proficiency (plus spell attack
 * and save DC for casters), then concentration, conditions and buffs.
 */
const meta: Meta<typeof CharacterHUD> = {
  component: CharacterHUD,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    viewport: { options: VIEWPORTS },
  },
  globals: IPAD_LANDSCAPE,
  args: {
    character: fighter,
    onShortRest: fn(),
    onLongRest: fn(),
    onIncrementDays: fn(),
    onDecrementDays: fn(),
    onToggleInspiration: fn(),
    onToggleReaction: fn(),
    onUseClassResource: fn(),
    onRestoreClassResource: fn(),
    onStopConcentration: fn(),
    onNavigateToConditions: fn(),
    onNavigateToBuffs: fn(),
    onNavigateToCombat: fn(),
    onNavigateToSpells: fn(),
    onToggleBuff: fn(),
    onUpdateCharacter: fn(),
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

function hpButtonIn(root: HTMLElement) {
  return within(root).getByRole('button', { name: /^Hit points / });
}

/** Every tier: the word under the bar, and the status the tests read. */
const TIERS = [
  ['healthy', 42, 'Healthy'],
  ['bloodied', 21, 'Bloodied'],
  ['critical', 5, 'Critical'],
  ['down', 0, 'Down'],
] as const;

function TierStack(args: Parameters<typeof CharacterHUD>[0]) {
  return (
    <div className="space-y-4">
      {TIERS.map(([status, current]) => (
        <div key={status} data-tier={status}>
          <CharacterHUD
            {...args}
            character={makeCharacter({ hitPoints: hp(current, 42) })}
          />
        </div>
      ))}
    </div>
  );
}

export const Tiers: Story = {
  render: args => <TierStack {...args} />,
  play: async ({ canvasElement }) => {
    for (const [status, current, word] of TIERS) {
      const frame = canvasElement.querySelector<HTMLElement>(
        `[data-tier="${status}"]`
      )!;
      const button = hpButtonIn(frame);
      await expect(button).toHaveAttribute('data-hp-status', status);
      await expect(button).toHaveAccessibleName(
        `Hit points ${current} of 42, ${word}. Open the Combat tab`
      );
      await expect(within(button).getByText(word)).toBeVisible();
    }
  },
};

export const TiersDark: Story = { ...Tiers, globals: DARK };

/** Temporary HP in frost, read to screen readers as the description. */
export const TemporaryHp: Story = {
  args: { character: makeCharacter({ hitPoints: hp(30, 44, 10) }) },
  play: async ({ canvasElement }) => {
    const button = hpButtonIn(canvasElement);
    await expect(within(button).getByText('+10 temp')).toBeVisible();
    await expect(button).toHaveAccessibleDescription('+10 temp');
  },
};

export const TemporaryHpDark: Story = { ...TemporaryHp, globals: DARK };

/** No max HP yet: the number plainly, an empty track and no tier. */
export const NoMaxHp: Story = {
  args: { character: makeCharacter({ hitPoints: hp(0, 0) }) },
  render: args => (
    <>
      <CharacterHUD {...args} />
      {/* Reference swatch the play test compares against. */}
      <span hidden data-probe="heading" style={{ color: 'var(--heading)' }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const button = hpButtonIn(canvasElement);
    // Not blood: with no max there is no tier to colour it by.
    await expect(
      getComputedStyle(button.querySelector('.type-num-xl')!).color
    ).toBe(
      getComputedStyle(
        canvasElement.querySelector<HTMLElement>('[data-probe="heading"]')!
      ).color
    );
    await expect(button).not.toHaveAttribute('data-hp-status');
    await expect(button).toHaveAccessibleName(
      'Hit points 0 of 0. Open the Combat tab'
    );
    const bar = button.querySelector<HTMLElement>('[data-part="bar"]')!;
    await expect(bar.getBoundingClientRect().width).toBe(0);
  },
};

export const NoMaxHpDark: Story = { ...NoMaxHp, globals: DARK };

/** A caster gets spell attack and save DC tiles, which open the Spells tab. */
export const Caster: Story = {
  args: { character: wizard },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: '+7 Spell attack' })
    );
    await userEvent.click(
      canvas.getByRole('button', { name: '15 Spell save DC' })
    );
    await expect(args.onNavigateToSpells).toHaveBeenCalledTimes(2);
    await userEvent.click(hpButtonIn(canvasElement));
    await userEvent.click(canvas.getByRole('button', { name: '16 AC' }));
    await expect(args.onNavigateToCombat).toHaveBeenCalledTimes(2);
  },
};

export const CasterDark: Story = { ...Caster, globals: DARK };

/** A non-caster has no spell tiles; the stats keep their order. */
export const NonCaster: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Spell attack')).toBeNull();
    await expect(canvas.queryByText('Spell save DC')).toBeNull();
    const captions = ['AC', 'Initiative', 'Speed', 'Proficiency'].map(text =>
      canvas.getByText(text, { exact: true })
    );
    for (let i = 1; i < captions.length; i++) {
      await expect(
        captions[i - 1].compareDocumentPosition(captions[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  },
};

export const NonCasterDark: Story = { ...NonCaster, globals: DARK };

/** Concentration as a lapis chip, the conditions count in ember, no pulse. */
export const Contextual: Story = {
  args: { character: busy(wizard) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Concentrating on Hold Person')
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'End concentration' })
    );
    await expect(args.onStopConcentration).toHaveBeenCalledTimes(1);
    const count = canvas.getByRole('button', {
      name: '2 conditions. Open the Combat tab',
    });
    await expect(getComputedStyle(count).animationName).toBe('none');
    await userEvent.click(count);
    await expect(args.onNavigateToConditions).toHaveBeenCalledTimes(1);
  },
};

export const ContextualDark: Story = { ...Contextual, globals: DARK };

/** Story-only harness: buttons change HP the way the Combat tab does. */
function DamageHarness(args: Parameters<typeof CharacterHUD>[0]) {
  const [character, setCharacter] = useState(() =>
    makeCharacter({ hitPoints: hp(42, 42) })
  );
  const change = (delta: number) =>
    setCharacter(c => ({
      ...c,
      hitPoints: {
        ...c.hitPoints,
        current: Math.max(
          0,
          Math.min(c.hitPoints.max, c.hitPoints.current + delta)
        ),
      },
    }));
  return (
    <div className="space-y-4">
      <CharacterHUD {...args} character={character} />
      <div className="flex gap-2">
        <Button onClick={() => change(-5)}>Take 5 damage</Button>
        <Button onClick={() => change(5)}>Heal 5</Button>
      </div>
    </div>
  );
}

function flashOf(root: HTMLElement) {
  const button = hpButtonIn(root);
  return button.querySelector<HTMLElement>('[data-hp-flash]')!;
}

function flashState(el: HTMLElement) {
  return {
    name: getComputedStyle(el).animationName,
    duration: getComputedStyle(el).animationDuration,
  };
}

/** The `rk-hp-flash` keyframes as the browser parsed them. */
function flashKeyframes() {
  const visit = (rules: CSSRuleList): CSSKeyframesRule | undefined => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSKeyframesRule && rule.name === 'rk-hp-flash') {
        return rule;
      }
      if ('cssRules' in rule) {
        const found = visit((rule as CSSGroupingRule).cssRules);
        if (found) return found;
      }
    }
    return undefined;
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const found = visit(sheet.cssRules);
      if (found) return found;
    } catch {
      // cross-origin sheet
    }
  }
  return undefined;
}

/** Damage flashes the HP readout blood for 180ms; healing doesn't. */
export const DamageFlash: Story = {
  render: args => <DamageHarness {...args} />,
  play: async ({ canvasElement }) => {
    const keyframes = flashKeyframes();
    await expect(keyframes).toBeDefined();
    await expect(keyframes!.findRule('from')!.style.backgroundColor).toBe(
      'var(--blood-fill)'
    );
    await expect(keyframes!.findRule('to')).toBeNull();

    // The layer paints above the HUD's background only inside the
    // button's own stacking context.
    const layer = flashOf(canvasElement);
    await expect(getComputedStyle(hpButtonIn(canvasElement)).isolation).toBe(
      'isolate'
    );
    await expect(getComputedStyle(layer).position).toBe('absolute');
    await expect(getComputedStyle(layer).zIndex).toBe('-10');

    const canvas = within(canvasElement);
    await expect(flashState(flashOf(canvasElement)).name).toBe('none');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Take 5 damage' })
    );
    await expect(flashState(flashOf(canvasElement))).toEqual({
      name: 'rk-hp-flash',
      duration: '0.18s',
    });
    // A blood wash at 30%: the numbers stay readable through it.
    await expect(getComputedStyle(flashOf(canvasElement)).opacity).toBe('0.3');
    // A second hit plays again (the flash element is new).
    const first = flashOf(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Take 5 damage' })
    );
    await expect(flashOf(canvasElement)).not.toBe(first);
    await expect(flashState(flashOf(canvasElement)).name).toBe('rk-hp-flash');
    // Healing keeps the same element: nothing replays.
    const afterHits = flashOf(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Heal 5' }));
    await expect(flashOf(canvasElement)).toBe(afterHits);
  },
};

export const DamageFlashDark: Story = { ...DamageFlash, globals: DARK };

/** Opening the sheet doesn't flash, at any HP. */
export const NoFlashOnLoad: Story = {
  args: { character: makeCharacter({ hitPoints: hp(5, 42) }) },
  play: async ({ canvasElement }) => {
    const el = flashOf(canvasElement);
    await expect(flashState(el).name).toBe('none');
    await expect(el.getAnimations()).toHaveLength(0);
  },
};

/** Reduced motion: the flash is cut to nothing. */
export const DamageFlashReducedMotion: Story = {
  render: args => <DamageHarness {...args} />,
  beforeEach: () => emulateReducedMotion(),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Take 5 damage' })
    );
    await waitFor(() =>
      expect(flashState(flashOf(canvasElement)).duration).toBe('1e-05s')
    );
  },
};

/** Caster with everything on and a plain fighter, for the layout checks. */
function LayoutPair(args: Parameters<typeof CharacterHUD>[0]) {
  return (
    <div className="space-y-4">
      <div data-hud-frame="caster">
        <CharacterHUD {...args} character={busy(wizard)} />
      </div>
      <div data-hud-frame="fighter">
        <CharacterHUD {...args} character={fighter} />
      </div>
    </div>
  );
}

function rowOneOf(frame: HTMLElement) {
  const hud = frame.firstElementChild as HTMLElement;
  return { hud, row: hud.firstElementChild as HTMLElement };
}

/** One line: no taller than its line box, no wider than its box. */
async function expectOneLine(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
  await expect(rect.height).toBeLessThan(lineHeight * 1.5);
  await expect(el.scrollWidth).toBeLessThanOrEqual(Math.ceil(rect.width));
}

async function checkLayout(canvasElement: HTMLElement) {
  for (const name of ['caster', 'fighter']) {
    const frame = canvasElement.querySelector<HTMLElement>(
      `[data-hud-frame="${name}"]`
    )!;
    const { hud, row } = rowOneOf(frame);
    await expect(hud.scrollWidth).toBeLessThanOrEqual(hud.clientWidth);
    const hudBox = hud.getBoundingClientRect();
    for (const el of Array.from(
      row.querySelectorAll<HTMLElement>(
        '.type-num-xl, .type-num-lg, .type-caption'
      )
    )) {
      await expectOneLine(el);
      const box = el.getBoundingClientRect();
      await expect(box.right).toBeLessThanOrEqual(Math.ceil(hudBox.right));
    }
    // The HP number line ("31 / 42 +5 temp") stays on one line.
    const xl = hpButtonIn(frame).querySelector<HTMLElement>('.type-num-xl')!;
    const numberLine = xl.parentElement!;
    await expect(numberLine.getBoundingClientRect().height).toBeLessThan(
      parseFloat(getComputedStyle(xl).lineHeight) * 1.5
    );
  }
}

/** Phone: tiles wrap, nothing overflows, every number and caption one line. */
export const LayoutPhone: Story = {
  render: args => <LayoutPair {...args} />,
  globals: PHONE,
  play: ({ canvasElement }) => checkLayout(canvasElement),
};

export const LayoutPhoneDark: Story = {
  ...LayoutPhone,
  globals: { ...PHONE, ...DARK },
};

export const LayoutIpadPortrait: Story = {
  render: args => <LayoutPair {...args} />,
  globals: IPAD_PORTRAIT,
  play: ({ canvasElement }) => checkLayout(canvasElement),
};

export const LayoutIpadPortraitDark: Story = {
  ...LayoutIpadPortrait,
  globals: { ...IPAD_PORTRAIT, ...DARK },
};

export const LayoutIpadLandscape: Story = {
  render: args => <LayoutPair {...args} />,
  globals: IPAD_LANDSCAPE,
  play: ({ canvasElement }) => checkLayout(canvasElement),
};

export const LayoutIpadLandscapeDark: Story = {
  ...LayoutIpadLandscape,
  globals: { ...IPAD_LANDSCAPE, ...DARK },
};

/**
 * The row-1 controls this part styles, by accessible name. The buffs
 * indicator is checked by its title: its name is the bare count.
 */
const TARGETS = [
  /^Hit points /,
  '16 AC',
  /Speed$/,
  '+7 Spell attack',
  '15 Spell save DC',
  '2 conditions. Open the Combat tab',
] as const;

async function checkTargets(canvasElement: HTMLElement, min: number) {
  const canvas = within(canvasElement);
  for (const name of TARGETS) {
    const box = canvas.getByRole('button', { name }).getBoundingClientRect();
    await expect(Math.round(box.width)).toBeGreaterThanOrEqual(min);
    await expect(Math.round(box.height)).toBeGreaterThanOrEqual(min);
  }
  const buffs = canvas
    .getByTitle('Active buffs — click to view')
    .getBoundingClientRect();
  await expect(Math.round(buffs.width)).toBeGreaterThanOrEqual(min);
  await expect(Math.round(buffs.height)).toBeGreaterThanOrEqual(min);
  // The chip's X draws a 16px glyph; its hit area is the ::after.
  const end = canvas.getByRole('button', { name: 'End concentration' });
  const after = getComputedStyle(end, '::after');
  await expect(Math.round(parseFloat(after.width))).toBeGreaterThanOrEqual(min);
  await expect(Math.round(parseFloat(after.height))).toBeGreaterThanOrEqual(
    min
  );
}

/** The X's 44px touch area, centred on its 16px glyph. */
function touchAreaOf(end: HTMLElement) {
  const box = end.getBoundingClientRect();
  const size = parseFloat(getComputedStyle(end, '::after').width);
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return {
    left: x - size / 2,
    right: x + size / 2,
    top: y - size / 2,
    bottom: y + size / 2,
  };
}

/** On a touch screen every row-1 control is at least 44×44. */
export const TouchTargets: Story = {
  args: { character: busy(wizard) },
  globals: PHONE,
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => {
    await checkTargets(canvasElement, 44);
    // The X's touch area covers no other control (the group's coarse gaps).
    const canvas = within(canvasElement);
    const area = touchAreaOf(
      canvas.getByRole('button', { name: 'End concentration' })
    );
    const buffs = canvas.getByTitle('Active buffs — click to view');
    for (const button of [
      ...TARGETS.map(name => canvas.getByRole('button', { name })),
      buffs,
    ]) {
      const box = button.getBoundingClientRect();
      const overlaps =
        Math.round(box.left) < Math.round(area.right) &&
        Math.round(area.left) < Math.round(box.right) &&
        Math.round(box.top) < Math.round(area.bottom) &&
        Math.round(area.top) < Math.round(box.bottom);
      await expect(overlaps).toBe(false);
    }
  },
};

/** Keyboard focus on every row-1 button shows the brass ring. */
export const KeyboardFocus: Story = {
  args: { character: busy(wizard) },
  render: args => (
    <>
      <CharacterHUD {...args} />
      {/* Reference swatch the play test compares against. */}
      <span hidden data-probe="ring" style={{ color: 'var(--ring)' }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ring = getComputedStyle(
      canvasElement.querySelector<HTMLElement>('[data-probe="ring"]')!
    ).color;
    await userEvent.tab();
    await expect(hpButtonIn(canvasElement)).toHaveFocus();
    // The buffs indicator comes last; its name is the bare count.
    const buttons = [
      ...TARGETS.map(name => canvas.getByRole('button', { name })),
      canvas.getByTitle('Active buffs — click to view'),
    ];
    for (const button of buttons) {
      // Tab forward to it (the chip's X sits between the tiles and the count).
      for (let i = 0; i < 4 && button !== document.activeElement; i++) {
        await userEvent.tab();
      }
      await expect(button).toHaveFocus();
      await expect(getComputedStyle(button).outlineStyle).toBe('solid');
      // transition-colors fades the outline colour in too.
      await waitFor(() =>
        expect(getComputedStyle(button).outlineColor).toBe(ring)
      );
    }
  },
};

export const KeyboardFocusDark: Story = { ...KeyboardFocus, globals: DARK };

/** With a mouse they are at least 24×24. */
export const PointerTargets: Story = {
  args: { character: busy(wizard) },
  play: ({ canvasElement }) => checkTargets(canvasElement, 24),
};
