import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { emulateReducedMotion } from '@/test/storybook/emulateCoarsePointer';
import { ToastContainer, type ToastData } from './Toast';

/**
 * Toasts float on surface-elevated with a 3px left rule in their role
 * colour: verdigris for healing and success, blood for harm and errors, a
 * neutral rule for rolls and information. A thin bar counts down their
 * life, and is hidden when motion is reduced.
 */
const meta: Meta<typeof ToastContainer> = {
  title: 'Feedback/Toast',
  component: ToastContainer,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Long enough that nothing dismisses itself while a test runs.
const LONG = 10 * 60 * 1000;

const SAMPLE_TOASTS: ToastData[] = [
  {
    id: 'rest',
    type: 'rest',
    title: 'Long rest taken',
    message: 'Hit points and spell slots are back',
    icon: 'restLong',
    details: ['All spell slots restored', 'Hit dice: 2 of 5 back'],
    duration: LONG,
  },
  {
    id: 'damage',
    type: 'damage',
    title: 'Longsword',
    message: 'Damage: 1d8 + 3',
    details: [{ icon: 'weapon', text: 'Slashing damage' }],
    duration: LONG,
  },
  {
    id: 'attack',
    type: 'attack',
    title: 'Longsword',
    message: '14 + 5 = 19',
    duration: LONG,
  },
];

const RULES = {
  paper: {
    elevated: 'rgb(251, 251, 248)',
    rest: 'rgb(39, 108, 86)',
    damage: 'rgb(158, 47, 40)',
    attack: 'rgb(120, 128, 111)',
  },
  felt: {
    elevated: 'rgb(31, 43, 37)',
    rest: 'rgb(111, 179, 160)',
    damage: 'rgb(194, 74, 64)',
    attack: 'rgb(104, 119, 110)',
  },
};

function ToastStack() {
  const [toasts, setToasts] = useState(SAMPLE_TOASTS);
  return (
    <ToastContainer
      toasts={toasts}
      onDismiss={id => setToasts(current => current.filter(t => t.id !== id))}
    />
  );
}

async function checkToasts(
  canvasElement: HTMLElement,
  theme: keyof typeof RULES
) {
  const colours = RULES[theme];
  const doc = canvasElement.ownerDocument;
  const page = within(doc.body);
  const card = (type: string) =>
    doc.querySelector(`[data-toast-type="${type}"]`) as HTMLElement;

  // The dismiss buttons live in the cards, never in the live region. The
  // region's text and its 1s clearing are covered by Toast.test.tsx.
  await expect(
    doc.querySelectorAll('[data-toast-type] button').length
  ).toBeGreaterThanOrEqual(3);
  await expect(page.getByRole('status').querySelector('button')).toBeNull();
  await expect(card('rest')).toHaveTextContent('Long rest taken');

  for (const type of ['rest', 'damage', 'attack'] as const) {
    await waitFor(() => {
      const style = getComputedStyle(card(type));
      expect(style.opacity).toBe('1');
      expect(style.borderLeftWidth).toBe('3px');
      expect(style.borderLeftColor).toBe(colours[type]);
      expect(style.backgroundColor).toBe(colours.elevated);
      expect(style.boxShadow).not.toBe('none');
    });
  }

  // The countdown shows normally and disappears under reduced motion.
  const countdown = card('rest').querySelector(
    '[data-toast-countdown]'
  ) as HTMLElement;
  await expect(getComputedStyle(countdown).display).toBe('block');
  const restore = emulateReducedMotion();
  try {
    await expect(getComputedStyle(countdown).display).toBe('none');
  } finally {
    restore();
  }

  // Dismiss by tap or click.
  const damage = within(card('damage'));
  await userEvent.click(
    damage.getByRole('button', { name: 'Dismiss notification' })
  );
  await waitFor(() => expect(card('damage')).toBeNull());
  await expect(card('rest')).not.toBeNull();
}

export const Stack: Story = {
  render: () => <ToastStack />,
  play: ({ canvasElement }) => checkToasts(canvasElement, 'paper'),
};

export const StackDark: Story = {
  render: () => <ToastStack />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkToasts(canvasElement, 'felt'),
};
