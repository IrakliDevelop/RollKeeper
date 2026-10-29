import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import {
  emulateCoarsePointer,
  emulateReducedMotion,
} from '@/test/storybook/emulateCoarsePointer';
import {
  calculateSavingThrowModifier,
  calculateSkillModifier,
} from '@/utils/calculations';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { AbilityName, CharacterState, SkillName } from '@/types/character';
import { AbilitiesSection } from '.';

/** The sizes a story picks with `globals: PHONE`, `IPAD_PORTRAIT`, `IPAD_LANDSCAPE` or `DESKTOP`. */
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
  desktop: {
    name: 'Desktop',
    styles: { width: '1024px', height: '768px' },
    type: 'desktop',
  },
} as const;

const PHONE = { viewport: { value: 'phone', isRotated: false } };
const IPAD_PORTRAIT = { viewport: { value: 'ipadPortrait', isRotated: false } };
const IPAD_LANDSCAPE = {
  viewport: { value: 'ipadLandscape', isRotated: false },
};
const DESKTOP = { viewport: { value: 'desktop', isRotated: false } };
const DARK = { theme: 'dark' };

const PREFS_KEY = 'rollkeeper-ui-prefs';

// A level 5 bard: Jack of All Trades, expertise, and a skill with two bonus
// abilities (the longest row).
const lyra: CharacterState = (() => {
  const base = makeCharacter({ level: 5, totalLevel: 5 });
  return {
    ...base,
    jackOfAllTrades: true,
    abilities: {
      strength: 8,
      dexterity: 16,
      constitution: 14,
      intelligence: 12,
      wisdom: 13,
      charisma: 18,
    },
    savingThrows: {
      ...base.savingThrows,
      strength: { proficient: false },
      dexterity: { proficient: true },
      charisma: { proficient: true },
    },
    skills: {
      ...base.skills,
      stealth: { proficient: true, expertise: true },
      perception: { proficient: true, expertise: false },
      performance: { proficient: true, expertise: true },
      persuasion: { proficient: true, expertise: false },
      sleightOfHand: {
        proficient: false,
        expertise: false,
        bonusAbilities: ['wisdom', 'intelligence'],
      },
    },
  };
})();

const onRollAbilityCheck = fn();
const onRollSavingThrow = fn();
const onRollSkillCheck = fn();

/** The section over a character it edits, like the sheet's store would. */
function Sheet({ editing }: { editing: boolean }) {
  const [character, setCharacter] = useState(lyra);
  const setSkill = (
    skill: SkillName,
    patch: Partial<CharacterState['skills'][SkillName]>
  ) =>
    setCharacter(c => ({
      ...c,
      skills: { ...c.skills, [skill]: { ...c.skills[skill], ...patch } },
    }));
  return (
    // The character page's padding.
    <div className="p-4">
      <AbilitiesSection
        abilities={character.abilities}
        savingThrows={character.savingThrows}
        skills={character.skills}
        jackOfAllTrades={character.jackOfAllTrades}
        getSavingThrowModifier={ability =>
          calculateSavingThrowModifier(character, ability)
        }
        getSkillModifier={skill => calculateSkillModifier(character, skill)}
        onUpdateAbilityScore={(ability, score) =>
          setCharacter(c => ({
            ...c,
            abilities: { ...c.abilities, [ability]: score },
          }))
        }
        onRollAbilityCheck={onRollAbilityCheck}
        onUpdateSavingThrowProficiency={(ability, proficient) =>
          setCharacter(c => ({
            ...c,
            savingThrows: { ...c.savingThrows, [ability]: { proficient } },
          }))
        }
        onRollSavingThrow={onRollSavingThrow}
        onUpdateSkillProficiency={(skill, proficient) =>
          setSkill(skill, { proficient })
        }
        onUpdateSkillExpertise={(skill, expertise) =>
          setSkill(skill, { expertise })
        }
        onToggleJackOfAllTrades={() =>
          setCharacter(c => ({ ...c, jackOfAllTrades: !c.jackOfAllTrades }))
        }
        onRollSkillCheck={onRollSkillCheck}
        onToggleSkillBonusAbility={(skill, ability) => {
          const current = character.skills[skill].bonusAbilities ?? [];
          setSkill(skill, {
            bonusAbilities: current.includes(ability)
              ? current.filter(a => a !== ability)
              : [...current, ability],
          });
        }}
        editing={editing}
      />
    </div>
  );
}

/**
 * The Stats tab's abilities: six blocks (medallion, name, save line,
 * skills) in one, two or three columns, under "Abilities" with the "Scores
 * large" switch. Play mode rolls from the names and save lines; edit mode
 * opens the score editor and turns the dots into controls.
 */
const meta: Meta<typeof Sheet> = {
  title: 'Character/Abilities section',
  component: Sheet,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    viewport: { options: VIEWPORTS },
  },
  globals: IPAD_LANDSCAPE,
  args: { editing: false },
  beforeEach: () => {
    localStorage.removeItem(PREFS_KEY);
    onRollAbilityCheck.mockClear();
    onRollSavingThrow.mockClear();
    onRollSkillCheck.mockClear();
    return () => localStorage.removeItem(PREFS_KEY);
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const ABILITIES: AbilityName[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

function blocks(canvasElement: HTMLElement) {
  return ABILITIES.map(
    ability =>
      canvasElement.querySelector<HTMLElement>(
        `[data-ability-block="${ability}"]`
      )!
  );
}

/** How many blocks share the first block's row. */
function columns(canvasElement: HTMLElement) {
  const tops = blocks(canvasElement).map(b =>
    Math.round(b.getBoundingClientRect().top)
  );
  return tops.filter(top => top === tops[0]).length;
}

async function expectNoSidewaysScroll(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument.documentElement;
  await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
}

/** The heading row: "Abilities" and the switch on one line. */
async function expectHeadingRowOnOneLine(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const heading = canvas.getByRole('heading', { level: 2, name: 'Abilities' });
  const control = canvas.getByRole('switch', { name: 'Scores large' });
  const h = heading.getBoundingClientRect();
  const s = control.getBoundingClientRect();
  // Same line: the switch's middle sits inside the heading's line box.
  const middle = s.top + s.height / 2;
  await expect(middle).toBeGreaterThan(h.top);
  await expect(middle).toBeLessThan(h.bottom);
}

async function expectHeadings(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  for (const name of [
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma',
  ]) {
    await expect(
      canvas.getByRole('heading', { level: 3, name })
    ).toBeInTheDocument();
  }
}

/** Play mode at 1180: three columns, rolls from names and save lines. */
export const Play: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(columns(canvasElement)).toBe(3);
    await expectHeadings(canvasElement);
    await expectHeadingRowOnOneLine(canvasElement);
    await expectNoSidewaysScroll(canvasElement);

    // Named by content in a real browser too.
    const save = canvas.getByRole('button', {
      name: 'Roll Dexterity Save +6, proficient',
    });
    await expect(save).toHaveTextContent('Save +6');
    await expect(
      canvas.getByRole('button', { name: 'Roll Strength Save -1' })
    ).toBeInTheDocument();
    await userEvent.click(save);
    await expect(onRollSavingThrow).toHaveBeenCalledWith('dexterity');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Roll Dexterity check' })
    );
    await expect(onRollAbilityCheck).toHaveBeenCalledWith('dexterity');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Roll Stealth check' })
    );
    await expect(onRollSkillCheck).toHaveBeenCalledWith('stealth');

    // Half dots for Jack of All Trades; no edit controls.
    const acrobatics = canvasElement.querySelector(
      '[data-skill="acrobatics"]'
    )!;
    await expect(
      within(acrobatics as HTMLElement).getByRole('img', {
        name: 'Jack of All Trades',
      })
    ).toBeInTheDocument();
    await expect(canvas.queryByText('+WIS')).toBeNull();
    await expect(
      canvas.queryByRole('switch', { name: 'Jack of All Trades' })
    ).toBeNull();

    // Keyboard: Tab goes name → save line → skills, with the brass ring.
    const check = canvas.getByRole('button', { name: 'Roll Strength check' });
    check.focus();
    await userEvent.tab();
    const strengthSave = canvas.getByRole('button', {
      name: 'Roll Strength Save -1',
    });
    await expect(strengthSave).toHaveFocus();
    await waitFor(() =>
      expect(getComputedStyle(strengthSave).outlineStyle).toBe('solid')
    );
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: 'Roll Athletics check' })
    ).toHaveFocus();
  },
};

export const PlayDark: Story = { ...Play, globals: DARK };

/** Edit mode at 820 (iPad portrait): two columns, dots are controls. */
export const Edit: Story = {
  args: { editing: true },
  globals: IPAD_PORTRAIT,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(columns(canvasElement)).toBe(2);
    await expectHeadings(canvasElement);
    await expectHeadingRowOnOneLine(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
    await expect(canvas.queryByRole('button', { name: /^Roll / })).toBeNull();

    // The skill dot cycles: expertise → none (a half dot with Jack of All
    // Trades) → proficient → expertise.
    const stealth = canvasElement.querySelector<HTMLElement>(
      '[data-skill="stealth"]'
    )!;
    // The row's first button is its dot; the second chooses bonus abilities.
    const dot = () => within(stealth).getAllByRole('button')[0];
    await expect(dot()).toHaveAccessibleName(
      'Stealth: expertise. Remove proficiency.'
    );
    await userEvent.click(dot());
    await expect(dot()).toHaveAccessibleName(
      'Stealth: Jack of All Trades. Make proficient.'
    );
    await expect(dot()).toHaveAttribute('data-level', 'half');
    await userEvent.click(dot());
    await expect(dot()).toHaveAttribute('data-level', 'proficient');
    await userEvent.click(dot());
    await expect(dot()).toHaveAttribute('data-level', 'expertise');

    // Jack of All Trades off: half dots become hollow.
    const joat = canvas.getByRole('switch', { name: 'Jack of All Trades' });
    await userEvent.click(joat);
    await expect(
      canvasElement.querySelector('[data-skill="acrobatics"] [data-level]')
    ).toHaveAttribute('data-level', 'none');

    // The save dot toggles, and the medallion ring follows.
    const medallion = canvas.getByRole('button', {
      name: 'Strength: modifier -1, score 8',
    });
    await expect(medallion).toHaveAttribute('data-save-proficient', 'false');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Strength save proficiency' })
    );
    await expect(
      canvas.getByRole('button', { name: 'Strength save proficiency' })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(medallion).toHaveAttribute('data-save-proficient', 'true');

    // Tab order inside a block: medallion, save dot, then each skill's dot
    // and bonus ability control.
    medallion.focus();
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: 'Strength save proficiency' })
    ).toHaveFocus();
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', { name: /^Athletics: / })
    ).toHaveFocus();
    await userEvent.tab();
    await expect(
      canvas.getByRole('button', {
        name: 'Choose ability modifiers for Athletics',
      })
    ).toHaveFocus();
  },
};

export const EditDark: Story = {
  ...Edit,
  globals: { ...IPAD_PORTRAIT, ...DARK },
};

/** A phone: one column, the heading row still on one line. */
export const Phone: Story = {
  globals: PHONE,
  play: async ({ canvasElement }) => {
    await expect(columns(canvasElement)).toBe(1);
    await expectHeadingRowOnOneLine(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const PhoneEditDark: Story = {
  args: { editing: true },
  globals: { ...PHONE, ...DARK },
  play: async ({ canvasElement }) => {
    await expect(columns(canvasElement)).toBe(1);
    await expectHeadingRowOnOneLine(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
    await expect(
      within(canvasElement).getByRole('switch', { name: 'Jack of All Trades' })
    ).toBeVisible();
  },
};

/**
 * 1024px: three columns of about 315px. The longest row (Sleight of Hand
 * with two badges and the control) stays inside its column.
 */
export const LongestRow: Story = {
  args: { editing: true },
  globals: DESKTOP,
  play: async ({ canvasElement }) => {
    await expect(columns(canvasElement)).toBe(3);
    const [, dexterity] = blocks(canvasElement);
    const width = dexterity.getBoundingClientRect().width;
    // About 315px; a little less beside a scrollbar.
    await expect(Math.round(width)).toBeGreaterThanOrEqual(300);
    await expect(Math.round(width)).toBeLessThanOrEqual(320);
    const row = dexterity.querySelector<HTMLElement>(
      '[data-skill="sleightOfHand"]'
    )!;
    await expect(within(row).getByText('+WIS')).toBeVisible();
    await expect(within(row).getByText('+INT')).toBeVisible();
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    const rowBox = row.getBoundingClientRect();
    for (const child of Array.from(row.children)) {
      await expect(child.getBoundingClientRect().right).toBeLessThanOrEqual(
        Math.ceil(rowBox.right)
      );
    }
    await expectNoSidewaysScroll(canvasElement);
  },
};

type Box = { left: number; right: number; top: number; bottom: number };

/** A control's hit area: its box, or its centred ::after when bigger. */
function hitBox(el: Element): Box {
  const box = el.getBoundingClientRect();
  const after = getComputedStyle(el, '::after');
  const w = parseFloat(after.width);
  const h = parseFloat(after.height);
  if (after.position !== 'absolute' || !(w > box.width)) return box;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return {
    left: cx - w / 2,
    right: cx + w / 2,
    top: cy - h / 2,
    bottom: cy + h / 2,
  };
}

function overlaps(a: Box, b: Box) {
  // Rounded: fractional display scaling puts edges on fractions.
  return (
    Math.round(a.left) < Math.round(b.right) &&
    Math.round(b.left) < Math.round(a.right) &&
    Math.round(a.top) < Math.round(b.bottom) &&
    Math.round(b.top) < Math.round(a.bottom)
  );
}

async function expectTargets(
  canvasElement: HTMLElement,
  min: number,
  { switches = true } = {}
) {
  const canvas = within(canvasElement);
  const controls = canvas
    .getAllByRole('button')
    .concat(switches ? canvas.getAllByRole('switch') : []);
  for (const control of controls) {
    const box = hitBox(control);
    await expect(Math.round(box.right - box.left)).toBeGreaterThanOrEqual(min);
    await expect(Math.round(box.bottom - box.top)).toBeGreaterThanOrEqual(min);
  }
}

/**
 * Touch, edit mode: every control reaches 44×44, the save dot's hit area
 * clears the medallion and a skill dot's clears the bonus ability control.
 */
export const TouchTargets: Story = {
  args: { editing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const restore = emulateCoarsePointer();
    try {
      await expectTargets(canvasElement, 44);
      for (const ability of ABILITIES) {
        const block = canvasElement.querySelector<HTMLElement>(
          `[data-ability-block="${ability}"]`
        )!;
        const medallion = block.querySelector('[data-medallion]')!;
        const saveDot = within(block).getByRole('button', {
          name: /save proficiency$/,
        });
        await expect(
          overlaps(hitBox(saveDot), medallion.getBoundingClientRect())
        ).toBe(false);
      }
      for (const row of Array.from(
        canvasElement.querySelectorAll<HTMLElement>('[data-skill]')
      )) {
        await expect(
          Math.round(row.getBoundingClientRect().height)
        ).toBeGreaterThanOrEqual(44);
        const [dot, control] = within(row).getAllByRole('button');
        await expect(
          overlaps(hitBox(dot), control.getBoundingClientRect())
        ).toBe(false);
      }
      // Stacked rows: one row's dot doesn't reach into the next row's.
      const dots = canvas
        .getAllByRole('button')
        .filter(b => b.closest('[data-skill]') && b.hasAttribute('data-level'));
      for (let i = 1; i < dots.length; i++) {
        await expect(overlaps(hitBox(dots[i - 1]), hitBox(dots[i]))).toBe(
          false
        );
      }
    } finally {
      restore();
    }
  },
};

/** Touch, play mode: names and save lines reach 44px. */
export const TouchTargetsPlay: Story = {
  play: async ({ canvasElement }) => {
    const restore = emulateCoarsePointer();
    try {
      await expectTargets(canvasElement, 44);
    } finally {
      restore();
    }
  },
};

/**
 * A mouse: dots keep a 24px hit area and every button is at least 24px.
 * (The switches' own size is the primitive's; their labels are clickable.)
 */
export const FinePointerTargets: Story = {
  args: { editing: true },
  play: async ({ canvasElement }) => {
    await expectTargets(canvasElement, 24, { switches: false });
  },
};

function strengthNumbers(canvasElement: HTMLElement) {
  const medallion = canvasElement.querySelector(
    '[data-ability-block="strength"] [data-medallion]'
  )!;
  return {
    medallion,
    large: medallion.querySelector<HTMLElement>('[data-number="large"]')!,
  };
}

/** "Scores large" swaps the numbers once, and the choice is kept. */
export const ScoresLarge: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      getComputedStyle(strengthNumbers(canvasElement).large).animationName
    ).toBe('none');
    await userEvent.click(canvas.getByRole('switch', { name: 'Scores large' }));
    const { medallion, large } = strengthNumbers(canvasElement);
    await expect(medallion).toHaveAttribute('data-display', 'score');
    await expect(large).toHaveTextContent('8');
    await expect(getComputedStyle(large).animationName).toBe('rk-number-swap');
    await waitFor(() =>
      expect(getComputedStyle(large).animationName).toBe('none')
    );
    await expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')).toEqual({
      abilityDisplay: 'score',
    });
  },
};

export const ScoresLargeReducedMotion: Story = {
  beforeEach: () => emulateReducedMotion(),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('switch', { name: 'Scores large' })
    );
    const { large } = strengthNumbers(canvasElement);
    await waitFor(() =>
      expect(getComputedStyle(large).animationDuration).toBe('1e-05s')
    );
  },
};

/**
 * The "+WIS" control: a popover of ability buttons. Escape or a tap
 * outside closes it, and the tap outside doesn't press what's under it.
 */
export const BonusAbilities: Story = {
  args: { editing: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const row = canvasElement.querySelector<HTMLElement>(
      '[data-skill="sleightOfHand"]'
    )!;
    const toggle = canvas.getByRole('button', {
      name: 'Choose ability modifiers for Sleight of Hand',
    });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const popover = await page.findByRole('dialog', {
      name: 'Add ability modifiers:',
    });
    const wis = within(popover).getByRole('button', { name: 'WIS' });
    await expect(wis).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(wis);
    await expect(wis).toHaveAttribute('aria-pressed', 'false');
    await expect(within(row).queryByText('+WIS')).toBeNull();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
    await expect(toggle).toHaveFocus();

    // A tap outside closes it without pressing what's under it: while it's
    // open the page takes no pointer events, so the tap only reaches the
    // popover's outside-press handler.
    await userEvent.click(toggle);
    await page.findByRole('dialog', { name: 'Add ability modifiers:' });
    const body = canvasElement.ownerDocument.body;
    await expect(getComputedStyle(body).pointerEvents).toBe('none');
    // The modal popover hides the page from the accessibility tree, so find
    // the dot by its place.
    const stealthDot = canvasElement.querySelector<HTMLElement>(
      '[data-skill="stealth"] button'
    )!;
    stealthDot.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0 })
    );
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(getComputedStyle(body).pointerEvents).not.toBe('none')
    );
  },
};
