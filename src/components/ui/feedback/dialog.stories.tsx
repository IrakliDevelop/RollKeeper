import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../forms/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

/**
 * Felt and Brass dialogs float on surface-elevated with a 1px divider, the
 * 6px object radius and the one overlay shadow, over a plain
 * surface-overlay scrim (no blur). Titles use the Vollkorn heading step.
 */
const meta: Meta<typeof Dialog> = {
  title: 'Feedback/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'Dialogs and confirmations. Escape or the close button closes the dialog and focus goes back to the button that opened it; Tab stays inside while it is open.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function RestDialog() {
  return (
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
        <DialogBody className="text-body text-sm">
          Hit dice: 2 of 5 come back.
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="primary">Take a long rest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ELEVATED = { paper: 'rgb(251, 251, 248)', felt: 'rgb(31, 43, 37)' };

async function checkDialog(
  canvasElement: HTMLElement,
  theme: keyof typeof ELEVATED
) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole('button', { name: 'Take a long rest' });
  await userEvent.click(trigger);

  const dialog = await page.findByRole('dialog', {
    name: 'Take a long rest?',
  });
  const style = getComputedStyle(dialog);
  await expect(style.borderTopLeftRadius).toBe('6px');
  await expect(style.borderTopWidth).toBe('1px');
  await expect(style.boxShadow).not.toBe('none');
  await waitFor(() =>
    expect(getComputedStyle(dialog).backgroundColor).toBe(ELEVATED[theme])
  );

  const overlay = canvasElement.ownerDocument.body.querySelector(
    '[data-state="open"].fixed.inset-0'
  ) as HTMLElement;
  await expect(getComputedStyle(overlay).backdropFilter).toBe('none');

  const title = page.getByRole('heading', { name: 'Take a long rest?' });
  await expect(getComputedStyle(title).fontFamily).toMatch(/Vollkorn/);
  await expect(getComputedStyle(title).fontSize).toBe('22px');

  // Tab cycles inside the dialog and reaches the close button.
  for (let i = 0; i < 4; i += 1) {
    await userEvent.tab();
    await expect(dialog.contains(document.activeElement)).toBe(true);
  }
  const close = page.getByRole('button', { name: 'Close' });
  close.focus();
  await waitFor(() => {
    const outline = getComputedStyle(close);
    expect(outline.outlineStyle).toBe('solid');
    expect(outline.outlineWidth).toBe('2px');
  });

  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await expect(trigger).toHaveFocus();
}

export const Default: Story = {
  render: () => <RestDialog />,
  play: ({ canvasElement }) => checkDialog(canvasElement, 'paper'),
};

export const DefaultDark: Story = {
  render: () => <RestDialog />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkDialog(canvasElement, 'felt'),
};

/**
 * A controlled dialog opened from a plain button (no DialogTrigger), as
 * most of the app's dialogs are: focus still goes back to that button.
 */
function ControlledRestDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Short rest</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Take a short rest?</DialogTitle>
            <DialogDescription>Spend hit dice to heal.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function checkFocusReturn(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  const opener = canvas.getByRole('button', { name: 'Short rest' });

  await userEvent.click(opener);
  await page.findByRole('dialog', { name: 'Take a short rest?' });
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(opener).toHaveFocus());

  await userEvent.click(opener);
  await userEvent.click(await page.findByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(opener).toHaveFocus());
}

export const ControlledFocusReturn: Story = {
  render: () => <ControlledRestDialog />,
  play: ({ canvasElement }) => checkFocusReturn(canvasElement),
};

export const ControlledFocusReturnDark: Story = {
  render: () => <ControlledRestDialog />,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkFocusReturn(canvasElement),
};
