import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { AnchoredEditor } from './index';

/**
 * Edits a number inside an ornament. Not used by any screen yet: the
 * medallions and the AC shield adopt it with the sheet's edit mode.
 */
const meta: Meta<typeof AnchoredEditor> = {
  title: 'Forms/AnchoredEditor',
  component: AnchoredEditor,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'A popover next to its trigger from 640px, a bottom sheet below that. Enter or Save keeps the value (clamped to the range); Escape, Cancel or a tap outside drops it, and focus goes back to the trigger. In edit mode the trigger has a dashed outline.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

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

const modifier = (score: number | undefined) =>
  score === undefined ? '—' : String(Math.floor((score - 10) / 2));

function StrengthMedallion() {
  const [score, setScore] = useState(15);
  return (
    <AnchoredEditor
      label="Strength"
      value={score}
      min={1}
      max={30}
      editing
      onSave={setScore}
      context={draft => (
        <p className="type-small text-muted">Modifier {modifier(draft)}</p>
      )}
    >
      <button
        type="button"
        className="type-num-lg text-heading rounded-full px-4 py-2"
      >
        STR {score}
      </button>
    </AnchoredEditor>
  );
}

async function openEditor(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole('button', { name: /^STR/ });
  await userEvent.click(trigger);
  const editor = await page.findByRole('dialog', { name: 'Strength' });
  const field = page.getByRole('textbox', { name: 'Strength' });
  await waitFor(() => expect(field).toHaveFocus());
  return { page, trigger, editor, field };
}

async function checkPopover(canvasElement: HTMLElement) {
  const trigger = within(canvasElement).getByRole('button', { name: /^STR/ });
  const cue = getComputedStyle(trigger);
  await expect(cue.outlineStyle).toBe('dashed');
  await expect(cue.outlineWidth).toBe('1px');

  const { page, editor, field } = await openEditor(canvasElement);
  await expect(editor).toHaveAttribute('data-anchored-editor', 'popover');
  await expect(getComputedStyle(editor).boxShadow).not.toBe('none');
  await expect(getComputedStyle(editor).borderTopWidth).toBe('1px');
  await expect(field.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
  await expect(getComputedStyle(field).fontSize).toBe('20px');
  // Tab stays inside the editor (a modal popover).
  for (let i = 0; i < 6; i += 1) {
    await userEvent.tab();
    await expect(editor.contains(document.activeElement)).toBe(true);
  }
  // The editor opens below the trigger, clear of it, once Radix has
  // positioned it.
  await waitFor(() =>
    expect(editor.getBoundingClientRect().top).toBeGreaterThan(
      trigger.getBoundingClientRect().bottom
    )
  );

  await userEvent.click(
    page.getByRole('button', { name: 'Increase Strength' })
  );
  await expect(field).toHaveValue('16');
  await expect(page.getByText('Modifier 3')).toBeVisible();
  field.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(trigger).toHaveTextContent('STR 16');

  const reopened = await openEditor(canvasElement);
  await userEvent.keyboard('9{Escape}');
  await waitFor(() => expect(reopened.page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(trigger).toHaveTextContent('STR 16');
}

export const Popover: Story = {
  render: () => <StrengthMedallion />,
  parameters: DESKTOP,
  play: ({ canvasElement }) => checkPopover(canvasElement),
};

export const PopoverDark: Story = {
  render: () => <StrengthMedallion />,
  parameters: DESKTOP,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkPopover(canvasElement),
};

/**
 * A 390px phone with a touch pointer: a bottom sheet clear of the home
 * indicator, 44px steppers and buttons, and a field large enough that iOS
 * Safari doesn't zoom.
 */
async function checkSheet(canvasElement: HTMLElement) {
  const { page, trigger, editor, field } = await openEditor(canvasElement);
  await expect(editor).toHaveAttribute('data-anchored-editor', 'sheet');
  await expect(editor.getBoundingClientRect().width).toBe(390);
  // Sits on the bottom edge once the 180ms slide-in ends.
  await waitFor(() =>
    expect(editor.getBoundingClientRect().bottom).toBe(window.innerHeight)
  );

  const restore = emulateCoarsePointer();
  try {
    for (const name of [
      'Decrease Strength',
      'Increase Strength',
      'Cancel',
      'Save',
    ]) {
      const target = page.getByRole('button', { name }).getBoundingClientRect();
      await expect(target.height).toBeGreaterThanOrEqual(44);
      await expect(target.width).toBeGreaterThanOrEqual(44);
    }
    await expect(
      parseFloat(getComputedStyle(field).fontSize)
    ).toBeGreaterThanOrEqual(16);
  } finally {
    restore();
  }

  await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
}

export const Sheet: Story = {
  render: () => <StrengthMedallion />,
  parameters: PHONE,
  play: ({ canvasElement }) => checkSheet(canvasElement),
};

export const SheetDark: Story = {
  render: () => <StrengthMedallion />,
  parameters: PHONE,
  globals: { theme: 'dark' },
  play: ({ canvasElement }) => checkSheet(canvasElement),
};

/**
 * Inside a dialog (the creature drawer, a stat-block editor): the editor's
 * popover works without closing the dialog, and Escape closes only the
 * top layer.
 */
function EditorInDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit goblin</Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Goblin</DialogTitle>
          <DialogDescription>Small humanoid.</DialogDescription>
        </DialogHeader>
        <StrengthMedallion />
      </DialogContent>
    </Dialog>
  );
}

export const InsideDialog: Story = {
  render: () => <EditorInDialog />,
  parameters: DESKTOP,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Edit goblin' })
    );
    const dialog = await page.findByRole('dialog', { name: 'Goblin' });
    const trigger = within(dialog).getByRole('button', { name: /^STR/ });

    await userEvent.click(trigger);
    const editor = await page.findByRole('dialog', { name: 'Strength' });
    await userEvent.click(
      page.getByRole('button', { name: 'Increase Strength' })
    );
    await expect(editor).toBeVisible();
    await expect(dialog).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: 'Strength' })).toBeNull()
    );
    await expect(page.getByRole('dialog', { name: 'Goblin' })).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());

    // A tap on the dialog outside the editor closes only the editor. The
    // modal popover turns pointer events off under it, so skip that check.
    await userEvent.click(trigger);
    await page.findByRole('dialog', { name: 'Strength' });
    const tap = userEvent.setup({ pointerEventsCheck: 0 });
    await tap.click(within(dialog).getByText('Small humanoid.'));
    await waitFor(() =>
      expect(page.queryByRole('dialog', { name: 'Strength' })).toBeNull()
    );
    await expect(page.getByRole('dialog', { name: 'Goblin' })).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
  },
};
