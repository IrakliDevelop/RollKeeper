import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { Button } from '@/components/ui/forms/button';
import {
  emulateCoarsePointer,
  emulateReducedMotion,
} from '@/test/storybook/emulateCoarsePointer';
import { UI_PREFS_KEY, useUiPrefs } from '@/hooks/useUiPrefs';
import { calculateModifier } from '@/utils/calculations';
import { Medallion } from './Medallion';
import type { AbilityDisplay } from './abilityNumbers';

/** The sizes a story picks with `globals: DESKTOP` or `globals: PHONE`. */
const VIEWPORTS = {
  desktop: {
    name: 'Desktop',
    styles: { width: '1024px', height: '768px' },
    type: 'desktop',
  },
  phone: {
    name: 'Phone',
    styles: { width: '390px', height: '844px' },
    type: 'mobile',
  },
} as const;

const DESKTOP = { viewport: { value: 'desktop', isRotated: false } };
const PHONE = { viewport: { value: 'phone', isRotated: false } };

/**
 * An ability as a ring: the large number inside, the small one on a tab.
 * A brass ring marks a proficient saving throw. Which number is large is the
 * viewer's "Scores large" preference; switching it swaps the two numbers.
 */
const meta: Meta = {
  title: 'Game/Medallion',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    viewport: { options: VIEWPORTS },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

const DISPLAYS: AbilityDisplay[] = ['modifier', 'score'];

function StatesPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          {DISPLAYS.map(display => (
            <div key={display} className="flex items-center gap-6 pb-3">
              <Medallion
                ability="strength"
                score={16}
                modifier={3}
                saveProficient
                abilityDisplay={display}
              />
              <Medallion
                ability="dexterity"
                score={9}
                modifier={-1}
                saveProficient={false}
                abilityDisplay={display}
              />
              <Medallion
                ability="constitution"
                score={30}
                modifier={10}
                saveProficient={false}
                abilityDisplay={display}
              />
            </div>
          ))}
          {/* Reference swatches the play test compares against. */}
          <span
            hidden
            data-probe="brass"
            style={{ borderColor: 'var(--brass-border)' }}
          />
          <span
            hidden
            data-probe="plain"
            style={{ borderColor: 'var(--divider-strong)' }}
          />
        </section>
      ))}
    </div>
  );
}

function numbersOf(medallion: HTMLElement) {
  return {
    large: medallion.querySelector<HTMLElement>('[data-number="large"]')!,
    small: medallion.querySelector<HTMLElement>('[data-number="small"]')!,
  };
}

export const States: Story = {
  render: () => <StatesPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label } of THEMES) {
      const panel = canvas
        .getByRole('heading', { name: label })
        .closest<HTMLElement>('[data-theme]')!;
      const probe = (name: string) =>
        getComputedStyle(panel.querySelector(`[data-probe="${name}"]`)!)
          .borderTopColor;
      const [strModifier, strScore] = within(panel).getAllByRole('img', {
        name: 'Strength: modifier +3, score 16',
      });
      const [dexModifier] = within(panel).getAllByRole('img', {
        name: 'Dexterity: modifier -1, score 9',
      });

      const ringOf = (el: HTMLElement) =>
        getComputedStyle(el.querySelector('[data-ring] circle')!);
      const proficient = ringOf(strModifier);
      await expect(proficient.strokeWidth).toBe('2.5px');
      await expect(proficient.stroke).toBe(probe('brass'));
      const plain = ringOf(dexModifier);
      await expect(plain.strokeWidth).toBe('1.5px');
      await expect(plain.stroke).toBe(probe('plain'));

      const box = strModifier.getBoundingClientRect();
      await expect(box.width).toBe(48);
      await expect(box.height).toBe(48);

      // Modifier large by default; the score swaps in when chosen.
      const byModifier = numbersOf(strModifier);
      await expect(byModifier.large).toHaveTextContent('+3');
      await expect(byModifier.small).toHaveTextContent('16');
      await expect(getComputedStyle(byModifier.large).fontSize).toBe('26px');
      await expect(getComputedStyle(byModifier.small).fontSize).toBe('13px');
      const byScore = numbersOf(strScore);
      await expect(byScore.large).toHaveTextContent('16');
      await expect(byScore.small).toHaveTextContent('+3');

      // The tab sits over the ring's bottom edge.
      const tab = byModifier.small.parentElement!.getBoundingClientRect();
      await expect(tab.top).toBeLessThan(box.bottom);
      await expect(tab.bottom).toBeGreaterThan(box.bottom);

      // "+10" fits inside the ring.
      const [conModifier] = within(panel).getAllByRole('img', {
        name: 'Constitution: modifier +10, score 30',
      });
      const wide = numbersOf(conModifier).large.getBoundingClientRect();
      await expect(wide.width).toBeLessThan(43);
    }
    // Play mode: nothing to tab to.
    await expect(canvasElement.querySelector('button')).toBeNull();
  },
};

function EditableMedallion() {
  const [score, setScore] = useState(16);
  return (
    <div className="p-8">
      <Medallion
        ability="strength"
        score={score}
        modifier={calculateModifier(score)}
        saveProficient
        abilityDisplay="modifier"
        editing
        onScoreChange={setScore}
      />
    </div>
  );
}

async function openEditor(canvasElement: HTMLElement) {
  const page = within(canvasElement.ownerDocument.body);
  const trigger = within(canvasElement).getByRole('button', {
    name: /^Strength: modifier/,
  });
  await userEvent.click(trigger);
  const editor = await page.findByRole('dialog', { name: 'Strength score' });
  const field = page.getByRole('textbox', { name: 'Strength score' });
  await waitFor(() => expect(field).toHaveFocus());
  return { page, trigger, editor, field };
}

async function checkEditing(canvasElement: HTMLElement) {
  const trigger = within(canvasElement).getByRole('button', {
    name: 'Strength: modifier +3, score 16',
  });
  // The dashed edit cue follows the circle; keyboard focus turns it solid.
  await expect(getComputedStyle(trigger).outlineStyle).toBe('dashed');
  await userEvent.tab();
  await expect(trigger).toHaveFocus();
  await waitFor(() =>
    expect(getComputedStyle(trigger).outlineStyle).toBe('solid')
  );

  const { page, editor, field } = await openEditor(canvasElement);
  await expect(editor).toHaveAttribute('data-anchored-editor', 'popover');
  // Visible once the popover's fade-in ends.
  await waitFor(() => expect(page.getByText('Modifier +3')).toBeVisible());
  await userEvent.click(
    page.getByRole('button', { name: 'Increase Strength score' })
  );
  await expect(field).toHaveValue('17');
  await userEvent.click(
    page.getByRole('button', { name: 'Increase Strength score' })
  );
  // The modifier follows the draft.
  await expect(page.getByText('Modifier +4')).toBeVisible();
  await userEvent.click(page.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(trigger).toHaveAccessibleName('Strength: modifier +4, score 18');

  // Cancel drops the draft; Escape too.
  const again = await openEditor(canvasElement);
  await userEvent.click(
    again.page.getByRole('button', { name: 'Decrease Strength score' })
  );
  await userEvent.click(again.page.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(again.page.queryByRole('dialog')).toBeNull());
  await expect(trigger).toHaveAccessibleName('Strength: modifier +4, score 18');
  const third = await openEditor(canvasElement);
  await userEvent.clear(third.field);
  await userEvent.keyboard('40{Enter}');
  await waitFor(() => expect(third.page.queryByRole('dialog')).toBeNull());
  // Clamped to 30.
  await expect(trigger).toHaveAccessibleName(
    'Strength: modifier +10, score 30'
  );
}

export const Editing: Story = {
  render: () => <EditableMedallion />,
  globals: DESKTOP,
  play: ({ canvasElement }) => checkEditing(canvasElement),
};

export const EditingDark: Story = {
  render: () => <EditableMedallion />,
  globals: { ...DESKTOP, theme: 'dark' },
  play: ({ canvasElement }) => checkEditing(canvasElement),
};

/** Below 640px the editor is a bottom sheet; the ring is a 44px+ target. */
export const EditingOnPhone: Story = {
  render: () => <EditableMedallion />,
  globals: PHONE,
  play: async ({ canvasElement }) => {
    const restore = emulateCoarsePointer();
    try {
      const trigger = within(canvasElement).getByRole('button', {
        name: /^Strength: modifier/,
      });
      const box = trigger.getBoundingClientRect();
      // To the nearest pixel: fractional display scaling puts edges on
      // fractions.
      await expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
      await expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    } finally {
      restore();
    }
    const { page, editor, trigger } = await openEditor(canvasElement);
    await expect(editor).toHaveAttribute('data-anchored-editor', 'sheet');
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** Story-only harness: a button flips the display, as the switch will. */
function SwapHarness({
  initial,
  animateSwap,
}: {
  initial: AbilityDisplay;
  animateSwap: boolean;
}) {
  const [display, setDisplay] = useState(initial);
  return (
    <div className="flex items-center gap-6 p-4">
      <div data-panel="">
        <Medallion
          ability="strength"
          score={16}
          modifier={3}
          saveProficient
          abilityDisplay={display}
          animateSwap={animateSwap}
        />
      </div>
      <Button
        onClick={() =>
          setDisplay(d => (d === 'modifier' ? 'score' : 'modifier'))
        }
      >
        Swap numbers
      </Button>
    </div>
  );
}

function medallionIn(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('img', {
    name: 'Strength: modifier +3, score 16',
  });
}

function swapState(el: HTMLElement) {
  return {
    name: getComputedStyle(el).animationName,
    duration: getComputedStyle(el).animationDuration,
  };
}

/** The `rk-number-swap` keyframes as the browser parsed them. */
function swapKeyframes() {
  const visit = (rules: CSSRuleList): CSSKeyframesRule | undefined => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSKeyframesRule && rule.name === 'rk-number-swap') {
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

/** A toggle in this tab: the two numbers trade places in 180ms, once. */
export const Swap: Story = {
  render: () => <SwapHarness initial="modifier" animateSwap />,
  play: async ({ canvasElement }) => {
    const keyframes = swapKeyframes();
    await expect(keyframes).toBeDefined();
    await expect(keyframes!.findRule('from')!.style.transform).toBe(
      'var(--rk-swap-from, none)'
    );
    await expect(keyframes!.findRule('to')!.style.transform).toBe('none');

    const medallion = medallionIn(canvasElement);
    const swap = within(canvasElement).getByRole('button', {
      name: 'Swap numbers',
    });
    await expect(swapState(numbersOf(medallion).large).name).toBe('none');
    await userEvent.click(swap);
    const { large, small } = numbersOf(medallion);
    await expect(large).toHaveTextContent('16');
    await expect(small).toHaveTextContent('+3');
    for (const el of [large, small]) {
      await expect(swapState(el)).toEqual({
        name: 'rk-number-swap',
        duration: '0.18s',
      });
    }
    // The ring number starts at the tab, the tab number in the ring.
    await expect(
      getComputedStyle(large).getPropertyValue('--rk-swap-from')
    ).toMatch(/^translateY\(24px\) scale\(0\.5\)$/);
    await expect(
      getComputedStyle(small).getPropertyValue('--rk-swap-from')
    ).toMatch(/^translateY\(-24px\) scale\(2\)$/);
    // The label doesn't follow the visual order.
    await expect(medallion).toHaveAccessibleName(
      'Strength: modifier +3, score 16'
    );

    // Once it ends the class comes off, so showing a hidden panel again
    // (a tab switch) doesn't replay it.
    await waitFor(() => expect(swapState(large).name).toBe('none'));
    await expect(swapState(small).name).toBe('none');
    const panel = medallion.closest<HTMLElement>('[data-panel]')!;
    panel.hidden = true;
    await new Promise(requestAnimationFrame);
    panel.hidden = false;
    await expect(numbersOf(medallion).large.getAnimations()).toHaveLength(0);

    // The next toggle plays again.
    await userEvent.click(swap);
    await expect(swapState(numbersOf(medallion).large).name).toBe(
      'rk-number-swap'
    );
  },
};

/** Reduced motion: the swap is instant. */
export const SwapReducedMotion: Story = {
  render: () => <SwapHarness initial="modifier" animateSwap />,
  beforeEach: () => emulateReducedMotion(),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Swap numbers' })
    );
    const { large, small } = numbersOf(medallionIn(canvasElement));
    for (const el of [large, small]) {
      await waitFor(() => expect(swapState(el).duration).toBe('1e-05s'));
    }
  },
};

/** Opening a page with scores large shows them large, without motion. */
export const NoAnimationOnMount: Story = {
  render: () => <SwapHarness initial="score" animateSwap />,
  play: async ({ canvasElement }) => {
    const { large, small } = numbersOf(medallionIn(canvasElement));
    await expect(large).toHaveTextContent('16');
    for (const el of [large, small]) {
      await expect(swapState(el).name).toBe('none');
      await expect(el.getAnimations()).toHaveLength(0);
    }
  },
};

/** A change from elsewhere (another tab, the stored value) snaps. */
export const SnapWhenNotLocal: Story = {
  render: () => <SwapHarness initial="modifier" animateSwap={false} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Swap numbers' })
    );
    const { large, small } = numbersOf(medallionIn(canvasElement));
    await expect(large).toHaveTextContent('16');
    for (const el of [large, small]) {
      await expect(swapState(el).name).toBe('none');
      await expect(el.getAnimations()).toHaveLength(0);
    }
  },
};

/**
 * The real preference: the button writes `rollkeeper-ui-prefs` on this
 * device. Open this story in two tabs: a swap in one moves the other's
 * numbers without animating.
 */
function LivePreference() {
  const { prefs, setPref, localChange } = useUiPrefs();
  return (
    <div className="flex items-center gap-6 p-4">
      <Medallion
        ability="strength"
        score={16}
        modifier={3}
        saveProficient
        abilityDisplay={prefs.abilityDisplay}
        animateSwap={localChange}
      />
      <Button
        onClick={() =>
          setPref(
            'abilityDisplay',
            prefs.abilityDisplay === 'modifier' ? 'score' : 'modifier'
          )
        }
      >
        Swap numbers
      </Button>
    </div>
  );
}

function clearPrefs() {
  localStorage.removeItem(UI_PREFS_KEY);
  return () => localStorage.removeItem(UI_PREFS_KEY);
}

export const AcrossTabs: Story = {
  render: () => <LivePreference />,
  beforeEach: clearPrefs,
  play: async ({ canvasElement }) => {
    const medallion = medallionIn(canvasElement);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Swap numbers' })
    );
    await waitFor(() =>
      expect(numbersOf(medallion).large).toHaveTextContent('16')
    );
    await expect(swapState(numbersOf(medallion).large).name).toBe(
      'rk-number-swap'
    );
    await expect(JSON.parse(localStorage.getItem(UI_PREFS_KEY)!)).toEqual({
      abilityDisplay: 'score',
    });

    // Another tab switches back: the numbers follow without animating.
    localStorage.setItem(UI_PREFS_KEY, '{"abilityDisplay":"modifier"}');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: UI_PREFS_KEY,
        newValue: '{"abilityDisplay":"modifier"}',
      })
    );
    await waitFor(() =>
      expect(numbersOf(medallion).large).toHaveTextContent('+3')
    );
    await expect(swapState(numbersOf(medallion).large).name).toBe('none');
    await expect(swapState(numbersOf(medallion).small).name).toBe('none');
  },
};
