import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import { alertDialog, confirmDialog, promptDialog } from './confirmDialogStore';

type DemoKind = 'danger' | 'safe' | 'alert' | 'prompt';

function Demo({ kind }: { kind: DemoKind }) {
  const [result, setResult] = useState('Nothing answered yet');

  const open = async () => {
    if (kind === 'danger') {
      const ok = await confirmDialog({
        title: 'Delete Fireball?',
        message: 'It is removed from your spell list.',
        confirmLabel: 'Delete spell',
        tone: 'danger',
      });
      setResult(ok ? 'Deleted' : 'Kept');
    } else if (kind === 'safe') {
      const ok = await confirmDialog({
        title: 'Archive Thalia Vane?',
        message: 'You can restore it from your archived characters.',
        confirmLabel: 'Archive character',
      });
      setResult(ok ? 'Archived' : 'Kept');
    } else if (kind === 'alert') {
      await alertDialog({
        title: 'No attunement slots left',
        message:
          'You can attune to 3 items at a time. End attunement to another item first.',
      });
      setResult('Closed');
    } else {
      const name = await promptDialog({
        title: 'Duplicate Thalia Vane',
        label: 'Name',
        defaultValue: 'Thalia Vane (Copy)',
        confirmLabel: 'Duplicate character',
      });
      setResult(name ?? 'Cancelled');
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={() => void open()}>Open dialog</Button>
      <p className="text-body" data-testid="result">
        {result}
      </p>
    </div>
  );
}

/**
 * The shared in-app dialog that replaces window.confirm, alert and prompt.
 * Call confirmDialog / alertDialog / promptDialog; the ConfirmDialogHost
 * mounted at the app root (and in Storybook's preview) renders it.
 */
const meta: Meta<typeof Demo> = {
  title: 'Feedback/ConfirmDialog',
  component: Demo,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Demo>;

const body = () => within(document.body);

export const DestructiveConfirm: Story = {
  args: { kind: 'danger' },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Open dialog' })
    );
    const dialog = await body().findByRole('alertdialog', {
      name: 'Delete Fireball?',
    });
    const confirm = within(dialog).getByRole('button', {
      name: 'Delete spell',
    });
    await expect(confirm).toHaveAttribute('data-variant', 'danger-solid');
    await waitFor(() => expect(confirm).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await expect(
      await within(canvasElement).findByText('Kept')
    ).toBeInTheDocument();
  },
};

export const DestructiveConfirmDark: Story = {
  ...DestructiveConfirm,
  globals: { theme: 'dark' },
};

export const SafeConfirm: Story = {
  args: { kind: 'safe' },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Open dialog' })
    );
    const dialog = await body().findByRole('dialog', {
      name: 'Archive Thalia Vane?',
    });
    await expect(
      within(dialog).getByRole('button', { name: 'Archive character' })
    ).toHaveAttribute('data-variant', 'primary');
    await userEvent.keyboard('{Enter}');
    await expect(
      await within(canvasElement).findByText('Archived')
    ).toBeInTheDocument();
  },
};

export const SafeConfirmDark: Story = {
  ...SafeConfirm,
  globals: { theme: 'dark' },
};

export const Alert: Story = {
  args: { kind: 'alert' },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Open dialog' })
    );
    const dialog = await body().findByRole('alertdialog', {
      name: 'No attunement slots left',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close' })
    );
    await expect(
      await within(canvasElement).findByText('Closed')
    ).toBeInTheDocument();
  },
};

export const AlertDark: Story = {
  ...Alert,
  globals: { theme: 'dark' },
};

export const Prompt: Story = {
  args: { kind: 'prompt' },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Open dialog' })
    );
    const dialog = await body().findByRole('dialog', {
      name: 'Duplicate Thalia Vane',
    });
    const field = within(dialog).getByLabelText('Name');
    await waitFor(() => expect(field).toHaveFocus());
    await userEvent.clear(field);
    await userEvent.type(field, 'Thalia the Second{Enter}');
    await expect(
      await within(canvasElement).findByText('Thalia the Second')
    ).toBeInTheDocument();
  },
};

export const PromptDark: Story = {
  ...Prompt,
  globals: { theme: 'dark' },
};
