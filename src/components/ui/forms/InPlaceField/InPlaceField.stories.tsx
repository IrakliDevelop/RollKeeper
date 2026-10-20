import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { InPlaceField } from './index';

/**
 * A number edited where it is shown. Not used by any screen yet: call sites
 * adopt it when the character sheet gets its play and edit modes.
 */
const meta: Meta<typeof InPlaceField> = {
  title: 'Forms/InPlaceField',
  component: InPlaceField,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'Takes the font of the text around it, with an underline as the only edit cue. Enter or leaving the field saves, Escape puts the old value back, the arrow keys step by 1 and Shift+arrow by 10. Out-of-range values show a blood underline and are clamped when saved. In play mode it is plain text.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function StatLines({ editing }: { editing: boolean }) {
  const [speed, setSpeed] = useState(30);
  const [score, setScore] = useState(15);
  return (
    <div className="text-body w-80 space-y-4">
      <button type="button">Before</button>
      <p className="type-body" data-testid="speed-line">
        Speed{' '}
        <InPlaceField
          label="Speed"
          value={speed}
          min={0}
          max={120}
          editing={editing}
          onCommit={setSpeed}
        />{' '}
        ft
      </p>
      <p className="type-num-xl text-heading" data-testid="score-line">
        <InPlaceField
          label="Strength"
          value={score}
          min={1}
          max={30}
          editing={editing}
          onCommit={setScore}
        />
      </p>
      <p className="type-body text-muted" data-testid="speed-view">
        Speed{' '}
        <InPlaceField
          label="Speed preview"
          value={speed}
          editing={false}
          onCommit={() => {}}
        />{' '}
        ft
      </p>
      <button type="button">After</button>
    </div>
  );
}

/**
 * The computed colour of a token inside the story's theme scope. Read it
 * before a waitFor: the probe is a DOM change, which re-runs the callback.
 */
function tokenColour(scope: HTMLElement, token: string) {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  scope.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

async function checkEditing(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const speed = canvas.getByRole('textbox', {
    name: 'Speed',
  }) as HTMLInputElement;
  const score = canvas.getByRole('textbox', { name: 'Strength' });
  const line = canvas.getByTestId('speed-line');
  const preview = within(canvas.getByTestId('speed-view')).getByText('30');
  const inputBorder = tokenColour(canvasElement, '--input-border');
  const brass = tokenColour(canvasElement, '--ring');
  const blood = tokenColour(canvasElement, '--blood-border');

  // Same box as the text: the field takes the line's font and the plain
  // text's height, and is two digits wide.
  const field = getComputedStyle(speed);
  await expect(field.fontSize).toBe(getComputedStyle(line).fontSize);
  await expect(field.fontFamily).toBe(getComputedStyle(line).fontFamily);
  await expect(field.borderTopWidth).toBe('0px');
  await expect(field.paddingLeft).toBe('0px');
  await expect(field.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  const rest = speed.getBoundingClientRect();
  await expect(rest.height).toBeCloseTo(
    preview.getBoundingClientRect().height,
    0
  );
  await expect(rest.width).toBeCloseTo(
    preview.getBoundingClientRect().width,
    0
  );
  await expect(getComputedStyle(score).fontSize).toBe('34px');
  // A fine pointer still gets a 24px target (WCAG 2.5.8).
  const target = getComputedStyle(speed.parentElement!, '::after');
  await expect(target.minHeight).toBe('24px');
  await expect(target.minWidth).toBe('24px');

  // Rest: 1.5px input-border underline. Focus: 2px brass, nothing moves.
  await expect(field.boxShadow).toContain(inputBorder);
  await expect(field.boxShadow).toContain('-1.5px');
  await userEvent.click(speed);
  await waitFor(() => {
    const focused = getComputedStyle(speed).boxShadow;
    expect(focused).toContain(brass);
    expect(focused).toContain('-2px');
  });
  await expect(getComputedStyle(speed).outlineStyle).toBe('none');
  const focusedBox = speed.getBoundingClientRect();
  await expect(focusedBox.height).toBe(rest.height);
  await expect(focusedBox.left).toBe(rest.left);

  // Text is selected on focus, so typing replaces it.
  await waitFor(() => expect(speed.selectionEnd).toBe(2));
  await userEvent.keyboard('125');
  await waitFor(() =>
    expect(getComputedStyle(speed).boxShadow).toContain(blood)
  );
  await expect(speed).toHaveAccessibleDescription(
    'Enter a number from 0 to 120.'
  );
  await expect(speed.getBoundingClientRect().width).toBeGreaterThan(rest.width);
  await userEvent.keyboard('{Enter}');
  await expect(speed).toHaveValue('120');

  // Arrows step the draft; Escape puts the saved value back.
  await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}{ArrowDown}');
  await expect(speed).toHaveValue('109');
  await userEvent.keyboard('{Escape}');
  await expect(speed).toHaveValue('120');
  await userEvent.tab();
  await expect(score).toHaveFocus();

  // Tabular figures in both modes: the field keeps the plain text's width
  // for digits that differ in proportional width, so a mode switch moves
  // nothing.
  await expect(getComputedStyle(speed).fontVariantNumeric).toContain(
    'tabular-nums'
  );
  await userEvent.click(speed);
  await waitFor(() => expect(speed.selectionEnd).toBe(3));
  await userEvent.keyboard('11{Enter}');
  await expect(speed).toHaveValue('11');
  const plain = within(canvas.getByTestId('speed-view')).getByText('11');
  await expect(getComputedStyle(plain).fontVariantNumeric).toContain(
    'tabular-nums'
  );
  await expect(speed.getBoundingClientRect().width).toBeCloseTo(
    plain.getBoundingClientRect().width,
    0
  );
}

export const Editing: Story = {
  render: () => <StatLines editing />,
  play: ({ canvasElement }) => checkEditing(canvasElement),
};

export const EditingDark: Story = {
  render: () => <StatLines editing />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkEditing(canvasElement),
};

async function checkPlay(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expect(canvas.queryByRole('textbox')).toBeNull();
  canvas.getByRole('button', { name: 'Before' }).focus();
  await userEvent.tab();
  await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
}

export const PlayMode: Story = {
  render: () => <StatLines editing={false} />,
  play: ({ canvasElement }) => checkPlay(canvasElement),
};

export const PlayModeDark: Story = {
  render: () => <StatLines editing={false} />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkPlay(canvasElement),
};

/**
 * On a touch device the field is at least 16px in edit mode, at rest and
 * focused, so iOS Safari doesn't zoom; large numbers keep their size and
 * play-mode text keeps the line's size.
 */
export const CoarsePointer: Story = {
  render: () => <StatLines editing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const speed = canvas.getByRole('textbox', { name: 'Speed' });
    const score = canvas.getByRole('textbox', { name: 'Strength' });
    const preview = within(canvas.getByTestId('speed-view')).getByText('30');

    await expect(getComputedStyle(speed).fontSize).toBe('15px');
    const restore = emulateCoarsePointer();
    try {
      await expect(getComputedStyle(speed).fontSize).toBe('16px');
      speed.focus();
      await expect(getComputedStyle(speed).fontSize).toBe('16px');
      await expect(getComputedStyle(score).fontSize).toBe('34px');
      await expect(getComputedStyle(preview).fontSize).toBe('15px');
      // The tap target is 44px square around the two-digit field.
      const target = getComputedStyle(speed.parentElement!, '::after');
      await expect(target.minHeight).toBe('44px');
      await expect(target.minWidth).toBe('44px');
      await expect(target.position).toBe('absolute');
      // Taps on the digits reach the field (caret, selection); taps just
      // beside it land on the label, which focuses the field.
      const box = speed.getBoundingClientRect();
      const midY = box.top + box.height / 2;
      await expect(
        document.elementFromPoint(box.left + box.width / 2, midY)
      ).toBe(speed);
      await expect(document.elementFromPoint(box.left - 6, midY)).toBe(
        speed.parentElement
      );
    } finally {
      restore();
    }
  },
};
