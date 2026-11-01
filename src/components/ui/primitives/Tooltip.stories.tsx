import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../forms/button';
import { Tooltip, TooltipProvider } from './Tooltip';

/**
 * Tooltips float on surface-elevated with a 1px divider, the 6px object
 * radius and the overlay shadow. They open on keyboard focus as well as
 * hover, but never carry information that has no other home: touch has no
 * hover.
 */
const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const ELEVATED = { paper: 'rgb(251, 251, 248)', felt: 'rgb(31, 43, 37)' };

function ArmorTooltip() {
  return (
    <TooltipProvider>
      <div className="p-16">
        <Tooltip content="Chain mail 16, shield +2">
          <Button>Armor class 18</Button>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

async function checkTooltip(
  canvasElement: HTMLElement,
  theme: keyof typeof ELEVATED
) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);

  await userEvent.tab();
  await expect(
    canvas.getByRole('button', { name: 'Armor class 18' })
  ).toHaveFocus();
  await page.findByRole('tooltip');

  const content = canvasElement.ownerDocument.body.querySelector(
    '[data-side]'
  ) as HTMLElement;
  const style = getComputedStyle(content);
  await expect(style.borderTopLeftRadius).toBe('6px');
  await expect(style.borderTopWidth).toBe('1px');
  await expect(style.boxShadow).not.toBe('none');
  await expect(style.overflow).toBe('visible');
  await waitFor(() =>
    expect(getComputedStyle(content).backgroundColor).toBe(ELEVATED[theme])
  );

  // The arrow hangs below the box and takes the same fill.
  const arrow = content.querySelector('svg')!;
  await waitFor(() =>
    expect(arrow.getBoundingClientRect().bottom).toBeGreaterThan(
      content.getBoundingClientRect().bottom
    )
  );
  await expect(getComputedStyle(arrow).fill).toBe(ELEVATED[theme]);

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(page.queryByRole('tooltip')).toBeNull());
}

export const OnFocus: Story = {
  render: () => <ArmorTooltip />,
  play: ({ canvasElement }) => checkTooltip(canvasElement, 'paper'),
};

export const OnFocusDark: Story = {
  render: () => <ArmorTooltip />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkTooltip(canvasElement, 'felt'),
};
