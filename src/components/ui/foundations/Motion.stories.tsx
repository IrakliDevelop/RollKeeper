import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import { emulateReducedMotion } from '@/test/storybook/emulateCoarsePointer';
import { remountOnTheme } from './remountOnTheme';
import { useComputedValue } from './useComputedValue';

/**
 * Motion follows an action or a change on the sheet. Durations are measured from
 * the real Button, Switch and Dialog: 120ms for a state change, 180ms to
 * enter or leave, ease-out. Under reduced motion they drop to almost zero.
 */
const meta: Meta = {
  title: 'Foundations/Motion',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** `0.12s` → `120ms`, `1e-05s` → `0.01ms`; a list keeps its first entry. */
function formatDuration(value: string): string {
  const first = value.split(',')[0].trim();
  const seconds = Number.parseFloat(first);
  if (!first.endsWith('s') || Number.isNaN(seconds)) return first;
  return `${Number((seconds * 1000).toFixed(2))}ms`;
}

const switchControl = (wrapper: HTMLElement) =>
  wrapper.querySelector('[role="switch"]');
const dialogContent = (probe: HTMLElement) => probe.closest('[role="dialog"]');

function Measured({ id, value }: { id: string; value: string }) {
  return <span data-measure={id}>{value}</span>;
}

// Measured while open; dialog.tsx uses the same duration class for the exit.
function DialogTiming() {
  const timing = useComputedValue<HTMLParagraphElement>('animation-duration', {
    pick: dialogContent,
  });
  return (
    <p ref={timing.ref} className="type-small text-body">
      Opens in <Measured id="Dialog" value={formatDuration(timing.value)} />.
    </p>
  );
}

function MotionPage() {
  const button = useComputedValue<HTMLButtonElement>('transition-duration');
  const easing = useComputedValue<HTMLButtonElement>(
    'transition-timing-function'
  );
  const toggle = useComputedValue<HTMLDivElement>('transition-duration', {
    pick: switchControl,
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-3">
        <h2 className="type-heading text-heading">Durations</h2>
        <ul className="space-y-4">
          <li className="flex flex-wrap items-center gap-4">
            <Button
              ref={el => {
                button.ref.current = el;
                easing.ref.current = el;
              }}
            >
              Take a short rest
            </Button>
            <p className="type-small text-body">
              State change (hover, colour):{' '}
              <Measured id="Button" value={formatDuration(button.value)} />
              , <Measured id="Easing" value={easing.value} />
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-4">
            <div ref={toggle.ref}>
              <Switch label="Concentrating" />
            </div>
            <p className="type-small text-body">
              Switch:{' '}
              <Measured id="Switch" value={formatDuration(toggle.value)} />
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Take a long rest</Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Take a long rest?</DialogTitle>
                  <DialogDescription>
                    Thalia regains all hit points and spell slots.
                  </DialogDescription>
                </DialogHeader>
                <DialogTiming />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <p className="type-small text-body">
              Enter and exit: open the dialog to measure it.
            </p>
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="type-heading text-heading">Rules</h2>
        <ul className="type-body text-body list-disc space-y-1 pl-5">
          <li>
            Motion answers a user action: opening or closing, expanding,
            confirming a change, taking damage.
          </li>
          <li>
            Never: hover lift or scale, scroll reveal, floating orbs, shimmer,
            or a looping pulse on anything that isn&apos;t loading.
          </li>
          <li>
            Reduced motion turns motion off. framer-motion follows it through
            the app&apos;s MotionConfig; spinners keep turning, slowly.
          </li>
          <li>
            The opt-in overlays (You died, Level up, Combat start) are exempt
            and still respect reduced motion.
          </li>
        </ul>
      </div>
    </div>
  );
}

async function openDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(
    canvas.getByRole('button', { name: 'Take a long rest' })
  );
  const dialog = await page.findByRole('dialog', { name: 'Take a long rest?' });
  return within(dialog);
}

async function closeDialog(canvasElement: HTMLElement) {
  await userEvent.keyboard('{Escape}');
  const page = within(canvasElement.ownerDocument.body);
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
}

const measured = (root: ParentNode, id: string) =>
  root.querySelector(`[data-measure="${id}"]`)?.textContent;

async function checkMotion(canvasElement: HTMLElement) {
  await waitFor(() => expect(measured(canvasElement, 'Button')).toBe('120ms'));
  await waitFor(() => expect(measured(canvasElement, 'Switch')).toBe('120ms'));
  // Tailwind's ease-out curve.
  await waitFor(() =>
    expect(measured(canvasElement, 'Easing')).toBe('cubic-bezier(0, 0, 0.2, 1)')
  );
  const dialog = await openDialog(canvasElement);
  await waitFor(() =>
    expect(dialog.getByText('180ms')).toHaveAttribute('data-measure', 'Dialog')
  );
  await closeDialog(canvasElement);
}

export const Motion: Story = {
  render: () => <MotionPage />,
  play: async ({ canvasElement }) => checkMotion(canvasElement),
};

export const MotionDark: Story = {
  render: () => <MotionPage />,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => checkMotion(canvasElement),
};

/**
 * What a player with reduced motion turned on gets: every duration drops to
 * 0.01ms. The story copies the reduced-motion rules in before it renders,
 * since the test browser can't switch the setting.
 */
export const ReducedMotion: Story = {
  render: () => <MotionPage />,
  beforeEach: () => emulateReducedMotion(),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(measured(canvasElement, 'Button')).toBe('0.01ms')
    );
    await waitFor(() =>
      expect(measured(canvasElement, 'Switch')).toBe('0.01ms')
    );
    const dialog = await openDialog(canvasElement);
    await waitFor(() =>
      expect(dialog.getByText('0.01ms')).toHaveAttribute(
        'data-measure',
        'Dialog'
      )
    );
    await closeDialog(canvasElement);
  },
};
