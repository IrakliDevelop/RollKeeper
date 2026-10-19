import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import {
  ConfirmDialogHost,
  alertDialog,
  cancelAllDialogs,
  confirmDialog,
  promptDialog,
} from '@/components/ui/feedback/confirm-dialog';
import {
  clickConfirmDialogButton,
  findConfirmDialog,
  queryConfirmDialog,
} from '@/test/confirmDialog';

let mockPathname = '/player';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const DELETE_SPELL = {
  title: 'Delete Fireball?',
  message: 'It is removed from your spell list.',
  confirmLabel: 'Delete spell',
  tone: 'danger' as const,
};

describe('confirm dialog', () => {
  beforeEach(() => {
    mockPathname = '/player';
  });

  afterEach(() => {
    act(() => cancelAllDialogs());
    cleanup();
    vi.restoreAllMocks();
  });

  it('resolves true when the confirm button is pressed', async () => {
    render(<ConfirmDialogHost />);
    const result = confirmDialog(DELETE_SPELL);

    await clickConfirmDialogButton('Delete spell');

    await expect(result).resolves.toBe(true);
  });

  it('resolves false on Cancel and on Escape', async () => {
    render(<ConfirmDialogHost />);

    const cancelled = confirmDialog(DELETE_SPELL);
    await clickConfirmDialogButton('Cancel');
    await expect(cancelled).resolves.toBe(false);

    const escaped = confirmDialog(DELETE_SPELL);
    const dialog = await findConfirmDialog();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await expect(escaped).resolves.toBe(false);
  });

  it('marks a destructive confirm as an alertdialog with a blood button', async () => {
    render(<ConfirmDialogHost />);
    void confirmDialog(DELETE_SPELL);

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete Fireball?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'It is removed from your spell list.'
    );
    expect(
      within(dialog).getByRole('button', { name: 'Delete spell' })
    ).toHaveAttribute('data-variant', 'danger-solid');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' })
    ).toHaveAttribute('data-variant', 'outline');
  });

  it('uses a plain dialog and the primary button for a safe confirm', async () => {
    render(<ConfirmDialogHost />);
    void confirmDialog({
      title: 'Archive Thalia Vane?',
      message: 'You can restore it from your archived characters.',
      confirmLabel: 'Archive character',
    });

    const dialog = await screen.findByRole('dialog', {
      name: 'Archive Thalia Vane?',
    });
    expect(
      within(dialog).getByRole('button', { name: 'Archive character' })
    ).toHaveAttribute('data-variant', 'primary');
  });

  it('focuses the confirm button so Enter confirms', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialogHost />);
    const result = confirmDialog(DELETE_SPELL);

    const dialog = await findConfirmDialog();
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Delete spell' })
      ).toHaveFocus()
    );
    await user.keyboard('{Enter}');

    await expect(result).resolves.toBe(true);
  });

  it('returns focus to the control that opened it', async () => {
    render(
      <>
        <button type="button" onClick={() => void confirmDialog(DELETE_SPELL)}>
          Delete Fireball
        </button>
        <ConfirmDialogHost />
      </>
    );
    const trigger = screen.getByRole('button', { name: 'Delete Fireball' });
    trigger.focus();
    fireEvent.click(trigger);

    await clickConfirmDialogButton('Cancel');

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('ignores clicks outside the dialog', async () => {
    render(<ConfirmDialogHost />);
    void confirmDialog(DELETE_SPELL);
    await findConfirmDialog();

    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);

    expect(queryConfirmDialog()).not.toBeNull();
  });

  it('shows an alert with one Close button', async () => {
    render(<ConfirmDialogHost />);
    const closed = alertDialog({ title: 'No attunement slots left' });

    const dialog = await screen.findByRole('alertdialog', {
      name: 'No attunement slots left',
    });
    expect(within(dialog).getAllByRole('button')).toHaveLength(1);
    await clickConfirmDialogButton('Close');

    await expect(closed).resolves.toBeUndefined();
  });

  it('returns the trimmed prompt text, and null on Cancel', async () => {
    render(<ConfirmDialogHost />);
    const named = promptDialog({
      title: 'Duplicate Thalia Vane',
      label: 'Name',
      defaultValue: 'Thalia Vane (Copy)',
      confirmLabel: 'Duplicate character',
    });

    const dialog = await findConfirmDialog();
    const field = within(dialog).getByLabelText('Name');
    expect(field).toHaveValue('Thalia Vane (Copy)');
    await waitFor(() => expect(field).toHaveFocus());

    fireEvent.change(field, { target: { value: '   ' } });
    expect(
      within(dialog).getByRole('button', { name: 'Duplicate character' })
    ).toBeDisabled();

    fireEvent.change(field, { target: { value: '  Thalia the Second ' } });
    await clickConfirmDialogButton('Duplicate character');
    await expect(named).resolves.toBe('Thalia the Second');

    const cancelled = promptDialog({
      title: 'Duplicate Thalia Vane',
      label: 'Name',
      confirmLabel: 'Duplicate character',
    });
    await clickConfirmDialogButton('Cancel');
    await expect(cancelled).resolves.toBeNull();
  });

  it('shows queued requests one at a time, in order', async () => {
    render(<ConfirmDialogHost />);
    const first = confirmDialog({ ...DELETE_SPELL, title: 'First?' });
    const second = confirmDialog({ ...DELETE_SPELL, title: 'Second?' });

    expect(
      await screen.findByRole('alertdialog', { name: 'First?' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: 'Second?' })).toBeNull();

    await clickConfirmDialogButton('Cancel');
    await expect(first).resolves.toBe(false);

    expect(
      await screen.findByRole('alertdialog', { name: 'Second?' })
    ).toBeInTheDocument();
    await clickConfirmDialogButton('Delete spell');
    await expect(second).resolves.toBe(true);
  });

  it('cancels when no host is mounted, and says why', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(confirmDialog(DELETE_SPELL)).resolves.toBe(false);
    await expect(
      promptDialog({ title: 'Name?', label: 'Name', confirmLabel: 'Save' })
    ).resolves.toBeNull();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('No <ConfirmDialogHost /> is mounted')
    );
  });

  it('cancels an open dialog when the route changes', async () => {
    const { rerender } = render(<ConfirmDialogHost />);
    const result = confirmDialog(DELETE_SPELL);
    await findConfirmDialog();

    mockPathname = '/dm';
    rerender(<ConfirmDialogHost />);

    await expect(result).resolves.toBe(false);
    await waitFor(() => expect(queryConfirmDialog()).toBeNull());
  });

  it('opens over another dialog, and Escape closes only the top one', async () => {
    const onParentOpenChange = vi.fn();
    render(
      <>
        <Dialog open onOpenChange={onParentOpenChange}>
          <DialogContent>
            <DialogTitle>Note</DialogTitle>
            <DialogDescription>Session notes</DialogDescription>
            <button
              type="button"
              onClick={() =>
                void confirmDialog({
                  ...DELETE_SPELL,
                  title: 'Delete this note?',
                })
              }
            >
              Delete note
            </button>
          </DialogContent>
        </Dialog>
        <ConfirmDialogHost />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete this note?',
    });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(queryConfirmDialog()).toBeNull());
    expect(onParentOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Note' })).toBeInTheDocument();
  });
});
