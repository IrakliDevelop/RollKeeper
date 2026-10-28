import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { Button } from '@/components/ui/forms/button';
import {
  emulateCoarsePointer,
  emulateReducedMotion,
} from '@/test/storybook/emulateCoarsePointer';
import { calculateModifier } from '@/utils/calculations';
import type { AbilityName } from '@/types/character';
import { LedgerRow, type LedgerCell } from './LedgerRow';
import type { AbilityDisplay } from './abilityNumbers';

/**
 * The six abilities in one row for drawers and the DM's view of a player:
 * name, the two numbers, and the save line. Six across from 32rem of its
 * own width, three by two below. Names and saves become roll buttons only
 * when the caller passes roll callbacks.
 */
const meta: Meta = {
  title: 'Game/Ledger row',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const SCORES: [AbilityName, number][] = [
  ['strength', 16],
  ['dexterity', 14],
  ['constitution', 15],
  ['intelligence', 8],
  ['wisdom', 12],
  ['charisma', 10],
];
const PROFICIENT: AbilityName[] = ['strength', 'constitution'];

function cellsFor(scores: Record<string, number> = {}): LedgerCell[] {
  return SCORES.map(([ability, base]) => {
    const score = scores[ability] ?? base;
    const modifier = calculateModifier(score);
    const saveProficient = PROFICIENT.includes(ability);
    return {
      ability,
      score,
      modifier,
      save: modifier + (saveProficient ? 2 : 0),
      saveProficient,
    };
  });
}

const CELLS = cellsFor();

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

const WIDTHS = [580, 512, 390];

function LayoutPage() {
  return (
    <div className="space-y-6">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          {WIDTHS.map(width => (
            <div key={width} data-width={width} style={{ width }}>
              <LedgerRow cells={CELLS} abilityDisplay="modifier" />
            </div>
          ))}
          <span
            hidden
            data-probe="divider"
            style={{ borderColor: 'var(--divider)' }}
          />
        </section>
      ))}
    </div>
  );
}

function cellsIn(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLElement>('[data-ledger-cell]'));
}

export const Layout: Story = {
  render: () => <LayoutPage />,
  parameters: {
    viewport: {
      viewports: {
        desktop: {
          name: 'Desktop',
          styles: { width: '1024px', height: '900px' },
        },
      },
      defaultViewport: 'desktop',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label } of THEMES) {
      const panel = canvas
        .getByRole('heading', { name: label })
        .closest<HTMLElement>('[data-theme]')!;
      const divider = getComputedStyle(
        panel.querySelector('[data-probe="divider"]')!
      ).borderTopColor;
      const rowAt = (width: number) =>
        panel.querySelector<HTMLElement>(`[data-width="${width}"]`)!;

      // 580px (the sheet drawer) and 512px: six across, one line each.
      for (const width of [580, 512]) {
        const cells = cellsIn(rowAt(width));
        const tops = cells.map(c => c.getBoundingClientRect().top);
        await expect(new Set(tops).size).toBe(1);
        for (const cell of cells) {
          const caption = cell.firstElementChild!.getBoundingClientRect();
          await expect(caption.height).toBeLessThan(20);
        }
        const [first, second, , fourth] = cells.map(c => getComputedStyle(c));
        await expect(first.borderLeftWidth).toBe('0px');
        await expect(second.borderLeftWidth).toBe('1px');
        await expect(second.borderLeftColor).toBe(divider);
        await expect(fourth.borderLeftWidth).toBe('1px');
        await expect(fourth.borderTopWidth).toBe('0px');
      }

      // 390px (a phone): three by two.
      const cells = cellsIn(rowAt(390));
      const tops = cells.map(c => c.getBoundingClientRect().top);
      await expect(tops[0]).toBe(tops[2]);
      await expect(tops[3]).toBeGreaterThan(tops[0]);
      await expect(tops[3]).toBe(tops[5]);
      const styles = cells.map(c => getComputedStyle(c));
      await expect(styles[3].borderLeftWidth).toBe('0px');
      await expect(styles[3].borderTopWidth).toBe('1px');
      await expect(styles[4].borderLeftWidth).toBe('1px');
      await expect(styles[0].borderTopWidth).toBe('0px');

      // No box around the row.
      const row = rowAt(390).firstElementChild as HTMLElement;
      await expect(getComputedStyle(row).borderTopWidth).toBe('0px');
    }
  },
};

export const States: Story = {
  render: () => (
    <div className="max-w-xl space-y-6">
      <LedgerRow cells={CELLS} abilityDisplay="modifier" />
      <LedgerRow cells={CELLS} abilityDisplay="score" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [byModifier, byScore] = canvas.getAllByRole('img', {
      name: 'Strength: modifier +3, score 16',
    });
    await expect(
      byModifier.querySelector('[data-number="large"]')
    ).toHaveTextContent('+3');
    await expect(
      byScore.querySelector('[data-number="large"]')
    ).toHaveTextContent('16');
    const large = byModifier.querySelector<HTMLElement>(
      '[data-number="large"]'
    )!;
    const small = byModifier.querySelector<HTMLElement>(
      '[data-number="small"]'
    )!;
    await expect(getComputedStyle(large).fontSize).toBe('20px');
    await expect(getComputedStyle(small).fontSize).toBe('13px');

    await expect(
      canvas.getAllByRole('img', {
        name: 'Strength saving throw +5, proficient',
      })
    ).toHaveLength(2);
    await expect(
      canvas.getAllByRole('img', { name: 'Dexterity saving throw +2' })
    ).toHaveLength(2);
    await expect(canvas.getAllByText('Save +5')).toHaveLength(2);
    // Rolls stay gated: nothing to press.
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

const onRollCheck = fn();
const onRollSave = fn();

/** Roll buttons, at 512px: the narrowest width that keeps six across. */
export const WithRolls: Story = {
  render: () => (
    <div style={{ width: 512 }}>
      <LedgerRow
        cells={CELLS}
        abilityDisplay="modifier"
        onRollCheck={onRollCheck}
        onRollSave={onRollSave}
      />
    </div>
  ),
  beforeEach: () => {
    onRollCheck.mockClear();
    onRollSave.mockClear();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const check = canvas.getByRole('button', { name: 'Roll Strength check' });
    const save = canvas.getByRole('button', {
      name: 'Roll Strength saving throw',
    });
    await expect(check).toHaveTextContent('Strength');
    await expect(save).toHaveTextContent('Save +5');
    // Six across, and every name and save line stays on one line.
    const rolls = canvas.getAllByRole('button');
    await expect(rolls).toHaveLength(12);
    const tops = new Set(
      rolls
        .filter(b => b.textContent?.startsWith('Save') === false)
        .map(b => b.getBoundingClientRect().top)
    );
    await expect(tops.size).toBe(1);
    for (const button of rolls) {
      // One line, inside the cell's padding (a long name overflows rather
      // than wraps, so check the width too).
      await expect(button.getBoundingClientRect().height).toBeLessThan(30);
      const cell = button.closest<HTMLElement>('[data-ledger-cell]')!;
      const padding = parseFloat(getComputedStyle(cell).paddingLeft) * 2;
      await expect(button.getBoundingClientRect().width).toBeLessThanOrEqual(
        cell.clientWidth - padding
      );
    }
    await userEvent.click(check);
    await expect(onRollCheck).toHaveBeenCalledWith('strength');
    await userEvent.click(save);
    await expect(onRollSave).toHaveBeenCalledWith('strength');

    // Keyboard: Tab reaches the next roll and shows the focus ring.
    check.focus();
    await userEvent.tab();
    await expect(save).toHaveFocus();
    await expect(getComputedStyle(save).outlineStyle).toBe('solid');

    const restore = emulateCoarsePointer();
    try {
      for (const button of canvas.getAllByRole('button')) {
        const box = button.getBoundingClientRect();
        await expect(box.height).toBeGreaterThanOrEqual(44);
        await expect(box.width).toBeGreaterThanOrEqual(44);
      }
    } finally {
      restore();
    }
  },
};

function EditableLedger() {
  const [scores, setScores] = useState<Record<string, number>>({});
  return (
    <div className="max-w-xl">
      <LedgerRow
        cells={cellsFor(scores)}
        abilityDisplay="modifier"
        editing
        onScoreChange={(ability, score) =>
          setScores(current => ({ ...current, [ability]: score }))
        }
        onRollCheck={onRollCheck}
        onRollSave={onRollSave}
      />
    </div>
  );
}

const DESKTOP = {
  viewport: {
    viewports: {
      desktop: {
        name: 'Desktop',
        styles: { width: '1024px', height: '768px' },
      },
    },
    defaultViewport: 'desktop',
  },
};

const PHONE = {
  viewport: {
    viewports: {
      phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
    },
    defaultViewport: 'phone',
  },
};

async function editDexterity(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  // Editing: no roll buttons, one action per cell.
  await expect(canvas.queryByRole('button', { name: /^Roll/ })).toBeNull();
  const trigger = canvas.getByRole('button', {
    name: 'Dexterity: modifier +2, score 14',
  });
  await expect(getComputedStyle(trigger).outlineStyle).toBe('dashed');
  // Keyboard: Tab from Strength's score reaches Dexterity's.
  canvas.getByRole('button', { name: /^Strength: modifier/ }).focus();
  await userEvent.tab();
  await expect(trigger).toHaveFocus();
  await waitFor(() =>
    expect(getComputedStyle(trigger).outlineStyle).toBe('solid')
  );
  await userEvent.click(trigger);
  const editor = await page.findByRole('dialog', { name: 'Dexterity score' });
  await userEvent.click(
    page.getByRole('button', { name: 'Increase Dexterity score' })
  );
  await userEvent.click(
    page.getByRole('button', { name: 'Increase Dexterity score' })
  );
  await waitFor(() => expect(page.getByText('Modifier +3')).toBeVisible());
  await userEvent.click(page.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(trigger).toHaveAccessibleName(
    'Dexterity: modifier +3, score 16'
  );
  return editor;
}

export const Editing: Story = {
  render: () => <EditableLedger />,
  parameters: DESKTOP,
  play: async ({ canvasElement }) => {
    const editor = await editDexterity(canvasElement);
    await expect(editor).toHaveAttribute('data-anchored-editor', 'popover');
  },
};

export const EditingOnPhone: Story = {
  render: () => <EditableLedger />,
  parameters: PHONE,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const restore = emulateCoarsePointer();
    try {
      for (const trigger of within(canvasElement).getAllByRole('button')) {
        const box = trigger.getBoundingClientRect();
        await expect(box.height).toBeGreaterThanOrEqual(44);
        await expect(box.width).toBeGreaterThanOrEqual(44);
        // The numbers sit in the middle of the taller touch box.
        const large = trigger
          .querySelector('[data-number="large"]')!
          .getBoundingClientRect();
        const middle = (box.top + box.bottom) / 2;
        await expect(
          Math.abs((large.top + large.bottom) / 2 - middle)
        ).toBeLessThan(4);
      }
    } finally {
      restore();
    }
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole('button', { name: /^Wisdom: modifier/ })
    );
    const editor = await page.findByRole('dialog', { name: 'Wisdom score' });
    await expect(editor).toHaveAttribute('data-anchored-editor', 'sheet');
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
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
    <div className="max-w-xl space-y-4">
      <LedgerRow
        cells={CELLS}
        abilityDisplay={display}
        animateSwap={animateSwap}
      />
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

function strengthNumbers(canvasElement: HTMLElement) {
  const pair = within(canvasElement).getByRole('img', {
    name: 'Strength: modifier +3, score 16',
  });
  return {
    large: pair.querySelector<HTMLElement>('[data-number="large"]')!,
    small: pair.querySelector<HTMLElement>('[data-number="small"]')!,
  };
}

export const Swap: Story = {
  render: () => <SwapHarness initial="modifier" animateSwap />,
  play: async ({ canvasElement }) => {
    await expect(
      getComputedStyle(strengthNumbers(canvasElement).large).animationName
    ).toBe('none');
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Swap numbers' })
    );
    const { large, small } = strengthNumbers(canvasElement);
    await expect(large).toHaveTextContent('16');
    await expect(small).toHaveTextContent('+3');
    for (const el of [large, small]) {
      const style = getComputedStyle(el);
      await expect(style.animationName).toBe('rk-number-swap');
      await expect(style.animationDuration).toBe('0.18s');
    }
    await expect(
      getComputedStyle(large).getPropertyValue('--rk-swap-from')
    ).toMatch(/^translateX\(20px\) scale\(0\.65\)$/);
    await expect(
      getComputedStyle(small).getPropertyValue('--rk-swap-from')
    ).toMatch(/^translateX\(-20px\) scale\(1\.5\)$/);
    // One play: the class comes off when it ends.
    await waitFor(() =>
      expect(getComputedStyle(large).animationName).toBe('none')
    );
  },
};

export const SwapReducedMotion: Story = {
  render: () => <SwapHarness initial="modifier" animateSwap />,
  beforeEach: () => emulateReducedMotion(),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Swap numbers' })
    );
    const { large, small } = strengthNumbers(canvasElement);
    for (const el of [large, small]) {
      await waitFor(() =>
        expect(getComputedStyle(el).animationDuration).toBe('1e-05s')
      );
    }
  },
};

export const NoAnimationOnMount: Story = {
  render: () => <SwapHarness initial="score" animateSwap />,
  play: async ({ canvasElement }) => {
    const { large, small } = strengthNumbers(canvasElement);
    await expect(large).toHaveTextContent('16');
    for (const el of [large, small]) {
      await expect(getComputedStyle(el).animationName).toBe('none');
    }
  },
};
