import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { ConfirmDialogHost } from '@/components/ui/feedback/confirm-dialog';

/** Mounts the dialog host next to the component under test. */
export function renderConfirmDialogHost() {
  return render(<ConfirmDialogHost />);
}

/** Waits for the shared confirm, alert or prompt dialog to open. */
export async function findConfirmDialog(): Promise<HTMLElement> {
  return waitFor(() => {
    const dialog = document.querySelector<HTMLElement>('[data-confirm-dialog]');
    if (!dialog) throw new Error('No confirm dialog is open');
    return dialog;
  });
}

export function queryConfirmDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-confirm-dialog]');
}

/** Clicks a button in the open dialog, e.g. "Delete spell" or "Cancel". */
export async function clickConfirmDialogButton(name: string | RegExp) {
  const dialog = await findConfirmDialog();
  fireEvent.click(within(dialog).getByRole('button', { name }));
  await waitFor(() => {
    if (queryConfirmDialog() === dialog) {
      throw new Error('Confirm dialog is still open');
    }
  });
}
