import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useCallback } from 'react';
import { X } from 'lucide-react';
import { expect, waitFor } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Input } from '@/components/ui/forms/input';
import { Switch } from '@/components/ui/forms/switch';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { remountOnTheme } from './remountOnTheme';
import { useComputedValue } from './useComputedValue';

/**
 * Some players use an iPad at the table, so everything works by touch
 * alone. The values are measured from the real controls; the touch stories
 * copy the coarse-pointer rules in before rendering, since the test browser
 * has a mouse.
 */
const meta: Meta = {
  title: 'Foundations/Touch',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const field = (wrapper: HTMLElement) => wrapper.querySelector('input');
const checkbox = (wrapper: HTMLElement) =>
  wrapper.querySelector('[role="checkbox"]');
const toggle = (wrapper: HTMLElement) =>
  wrapper.querySelector('[role="switch"]');

function Measured({ id, value }: { id: string; value: string }) {
  return <span data-measure={id}>{value}</span>;
}

/**
 * Both sides of a control's `::after` hit area. With a mouse it isn't drawn
 * (0px): the control and its label take the click.
 */
function useHitArea(pick: (wrapper: HTMLDivElement) => Element | null) {
  const width = useComputedValue<HTMLDivElement>('width', {
    pick,
    pseudoElement: '::after',
  });
  const height = useComputedValue<HTMLDivElement>('height', {
    pick,
    pseudoElement: '::after',
  });
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      width.ref.current = element;
      height.ref.current = element;
    },
    [width.ref, height.ref]
  );
  let value = '';
  if (width.value && height.value) {
    value =
      width.value === '0px' && height.value === '0px'
        ? 'the control and its label'
        : `${width.value} by ${height.value}`;
  }
  return { ref, value };
}

function TouchPage() {
  const button = useComputedValue<HTMLButtonElement>('height');
  const icon = useComputedValue<HTMLButtonElement>('width');
  const input = useComputedValue<HTMLDivElement>('font-size', { pick: field });
  const box = useHitArea(checkbox);
  const track = useHitArea(toggle);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-3">
        <h2 className="type-heading text-heading">Measured sizes</h2>
        <ul className="space-y-4">
          <li className="flex flex-wrap items-center gap-4">
            <Button ref={button.ref} size="sm">
              Add condition
            </Button>
            <p className="type-small text-body">
              Button height: <Measured id="Button" value={button.value} />
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-4">
            <Button
              ref={icon.ref}
              variant="ghost"
              size="sm"
              className="w-9 px-0"
              aria-label="Close spell details"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
            <p className="type-small text-body">
              Icon button width:{' '}
              <Measured id="Icon button" value={icon.value} />
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-4">
            <div ref={input.ref} className="w-48">
              <Input aria-label="Character name" placeholder="Thalia Vane" />
            </div>
            <p className="type-small text-body">
              Input text: <Measured id="Input" value={input.value} />
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-4">
            <div ref={box.ref}>
              <Checkbox label="Proficient" />
            </div>
            <p className="type-small text-body">
              Checkbox hit area: <Measured id="Checkbox" value={box.value} />
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-4">
            <div ref={track.ref}>
              <Switch label="Inspiration" size="sm" />
            </div>
            <p className="type-small text-body">
              Switch hit area: <Measured id="Switch" value={track.value} />
            </p>
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="type-heading text-heading">Rules</h2>
        <ul className="type-body text-body list-disc space-y-1 pl-5">
          <li>
            Targets are at least 44 by 44px on touch. With a mouse they are at
            least 24 by 24px, counting the space around a small control (WCAG
            2.5.8). Small controls such as a checkbox or a switch keep their
            size and get a larger hit area on touch.
          </li>
          <li>
            Rows that hold a tappable control are at least 44px tall on touch.
          </li>
          <li>
            Nothing is shown only on hover. Hover styles apply only on devices
            that can hover, and a tooltip is never the only place a fact
            appears.
          </li>
          <li>
            No action needs a double click, right click or long press: each has
            a visible tap path.
          </li>
          <li>
            Every keyboard shortcut has a touch equivalent: steppers for the
            arrow keys, Cancel for Escape, Save for Enter.
          </li>
          <li>
            Inputs use at least 16px text on touch, so iPad Safari doesn&apos;t
            zoom in on focus.
          </li>
          <li>
            Check layouts at iPad portrait (820 by 1180) and landscape (1180 by
            820).
          </li>
        </ul>
      </div>
    </div>
  );
}

const measured = (canvasElement: HTMLElement, id: string) =>
  canvasElement.querySelector(`[data-measure="${id}"]`)?.textContent;

async function checkTouch(canvasElement: HTMLElement) {
  for (const id of ['Button', 'Icon button']) {
    await waitFor(() => expect(measured(canvasElement, id), id).toBe('44px'));
  }
  for (const id of ['Checkbox', 'Switch']) {
    await waitFor(() =>
      expect(measured(canvasElement, id), id).toBe('44px by 44px')
    );
  }
  await waitFor(() => expect(measured(canvasElement, 'Input')).toBe('16px'));
}

export const OnTouch: Story = {
  render: () => <TouchPage />,
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => checkTouch(canvasElement),
};

export const OnTouchDark: Story = {
  render: () => <TouchPage />,
  globals: { theme: 'dark' },
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => checkTouch(canvasElement),
};

/** The same controls with a mouse: compact sizes, 14px input text. */
export const WithMouse: Story = {
  render: () => <TouchPage />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(measured(canvasElement, 'Button')).toBe('36px'));
    await waitFor(() =>
      expect(measured(canvasElement, 'Icon button')).toBe('36px')
    );
    await waitFor(() => expect(measured(canvasElement, 'Input')).toBe('14px'));
    for (const id of ['Checkbox', 'Switch']) {
      await waitFor(() =>
        expect(measured(canvasElement, id), id).toBe(
          'the control and its label'
        )
      );
    }
  },
};
