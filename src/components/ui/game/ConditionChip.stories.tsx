import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import { ConditionChip } from './ConditionChip';

/**
 * Condition chips: an ember `Badge` with the condition's name, and lapis for
 * concentration. The name is never cut short. The remove button keeps its
 * size and gets a 24px hit area (44px on touch).
 */
const meta: Meta = {
  title: 'Game/Condition chip',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

function ChipsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          <div className="flex flex-wrap gap-2">
            <ConditionChip name="Poisoned" />
            <ConditionChip name="Exhaustion" stackCount={2} />
            <ConditionChip name="Concentrating on Bless" kind="concentration" />
          </div>
          {/* Reference swatches the play test compares against. */}
          <span
            hidden
            data-probe="ember"
            style={{
              color: 'var(--ember-text)',
              borderColor: 'var(--ember-border)',
            }}
          />
          <span
            hidden
            data-probe="lapis"
            style={{
              color: 'var(--lapis-text)',
              borderColor: 'var(--lapis-border)',
            }}
          />
        </section>
      ))}
    </div>
  );
}

export const Chips: Story = {
  render: () => <ChipsPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label } of THEMES) {
      const panel = canvas
        .getByRole('heading', { name: label })
        .closest<HTMLElement>('[data-theme]')!;
      const probe = (name: string) =>
        getComputedStyle(panel.querySelector(`[data-probe="${name}"]`)!);
      const chip = (text: string) =>
        getComputedStyle(within(panel).getByText(text).closest('[data-kind]')!);
      for (const [text, role] of [
        ['Poisoned', 'ember'],
        ['Exhaustion', 'ember'],
        ['Concentrating on Bless', 'lapis'],
      ] as const) {
        await expect(chip(text).color).toBe(probe(role).color);
        await expect(chip(text).borderTopColor).toBe(
          probe(role).borderTopColor
        );
        // An outline, no fill.
        await expect(chip(text).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      }
      await expect(within(panel).getByText('x2')).toBeInTheDocument();
    }
  },
};

const START = ['Poisoned', 'Prone', 'Frightened'];

function RemovableChips() {
  const [conditions, setConditions] = useState(START);
  const [concentrating, setConcentrating] = useState(true);
  return (
    // On touch the list spaces out so the 44px hit areas overlap nothing.
    <div className="flex max-w-xs flex-wrap gap-2 pointer-coarse:gap-x-3 pointer-coarse:gap-y-6">
      {concentrating && (
        <ConditionChip
          name="Concentrating on Hold Person"
          kind="concentration"
          onRemove={() => setConcentrating(false)}
        />
      )}
      {conditions.map(name => (
        <ConditionChip
          key={name}
          name={name}
          onRemove={() => setConditions(prev => prev.filter(c => c !== name))}
        />
      ))}
      {/* Reference swatch the play test compares the focus ring against. */}
      <span hidden data-probe="ring" style={{ color: 'var(--ring)' }} />
    </div>
  );
}

/** Remove buttons: by mouse, by keyboard, and the hit area. */
export const Removable: Story = {
  render: () => <RemovableChips />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prone = canvas.getByRole('button', { name: 'Remove Prone' });
    const after = getComputedStyle(prone, '::after');
    await expect(after.width).toBe('24px');
    await expect(after.height).toBe('24px');
    await userEvent.click(prone);
    await expect(canvas.queryByText('Prone')).toBeNull();

    const frightened = canvas.getByRole('button', {
      name: 'Remove Frightened',
    });
    frightened.focus();
    await expect(getComputedStyle(frightened).outlineStyle).toBe('solid');
    await expect(getComputedStyle(frightened).outlineColor).toBe(
      getComputedStyle(canvasElement.querySelector('[data-probe="ring"]')!)
        .color
    );
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByText('Frightened')).toBeNull();

    await userEvent.click(
      canvas.getByRole('button', { name: 'End concentration' })
    );
    await expect(canvas.queryByText('Concentrating on Hold Person')).toBeNull();
    await expect(canvas.getByText('Poisoned')).toBeInTheDocument();
  },
};

export const RemovableDark: Story = {
  render: () => <RemovableChips />,
  globals: { theme: 'dark' },
};

/**
 * On touch each remove button's hit area grows to 44px. A wrapping list
 * spaces out (`pointer-coarse:gap-x-3 pointer-coarse:gap-y-6`) so a hit
 * area covers no other chip and no other hit area.
 */
export const RemovableOnTouch: Story = {
  render: () => <RemovableChips />,
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const button of canvas.getAllByRole('button')) {
      const after = getComputedStyle(button, '::after');
      await expect(after.width).toBe('44px');
      await expect(after.height).toBe('44px');
      await expect(button.getBoundingClientRect().width).toBe(16);
    }
    const hitArea = (button: HTMLElement) => {
      const box = button.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      return { left: x - 22, right: x + 22, top: y - 22, bottom: y + 22 };
    };
    type Box = ReturnType<typeof hitArea>;
    const overlaps = (a: Box, b: Box) =>
      a.left < b.right &&
      b.left < a.right &&
      a.top < b.bottom &&
      b.top < a.bottom;
    const buttons = canvas.getAllByRole('button');
    const chips = buttons.map(button => button.closest('[data-kind]')!);
    for (const [i, button] of buttons.entries()) {
      for (const [j, other] of buttons.entries()) {
        if (i === j) continue;
        await expect(
          overlaps(hitArea(button), chips[j].getBoundingClientRect())
        ).toBe(false);
        await expect(overlaps(hitArea(button), hitArea(other))).toBe(false);
      }
    }
  },
};

const LONG_NAMES = [
  'Cursed by the Hag of Greywater Fen',
  'Greywaterfenhagcursedforevermore',
];

/**
 * A long custom condition wraps, even one long word, instead of being cut
 * short. It wraps in a block column and in a wrapping flex list (the layout
 * callers use), where `max-w-full` keeps the chip from growing past the list.
 */
export const LongName: Story = {
  render: () => (
    <div className="space-y-4">
      <div data-testid="column" className="w-40 space-y-2">
        {LONG_NAMES.map(name => (
          <ConditionChip key={name} name={name} onRemove={() => {}} />
        ))}
      </div>
      <div data-testid="flex-column" className="flex w-40 flex-wrap gap-2">
        <ConditionChip name={LONG_NAMES[1]} onRemove={() => {}} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const column = canvas.getByTestId('column').getBoundingClientRect();
    for (const name of LONG_NAMES) {
      const text = within(canvas.getByTestId('column')).getByText(name);
      const chip = text.closest('[data-kind]')!.getBoundingClientRect();
      await expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
      await expect(chip.right).toBeLessThanOrEqual(column.right);
      await expect(text.getBoundingClientRect().height).toBeGreaterThan(20);
    }

    const flexList = canvas.getByTestId('flex-column');
    const flexText = within(flexList).getByText(LONG_NAMES[1]);
    const flexChip = flexText.closest('[data-kind]')!.getBoundingClientRect();
    await expect(flexChip.right).toBeLessThanOrEqual(
      flexList.getBoundingClientRect().right
    );
    await expect(flexText.scrollWidth).toBeLessThanOrEqual(
      flexText.clientWidth
    );
  },
};
