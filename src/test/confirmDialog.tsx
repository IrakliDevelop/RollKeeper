import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { onTestFinished } from 'vitest';
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

type DialogAnswer = 'confirm' | 'cancel';

let stopAnswering: (() => void) | null = null;

/**
 * Answers every shared dialog that opens, in order, by clicking its real
 * buttons: a single answer for all of them, or one per dialog (dialogs past
 * the end of the list are cancelled). `titles` records what was asked.
 * Answers stop when the test ends, or earlier with `stop()`.
 */
export function answerConfirmDialogs(answers: DialogAnswer | DialogAnswer[]) {
  // A later call replaces the earlier answers instead of adding to them.
  stopAnswering?.();
  const titles: string[] = [];
  const answered = new WeakSet<Element>();
  const answer = () => {
    const dialog = queryConfirmDialog();
    if (!dialog || answered.has(dialog)) return;
    answered.add(dialog);
    titles.push(dialog.querySelector('h2')?.textContent ?? '');
    const choice = Array.isArray(answers)
      ? (answers[titles.length - 1] ?? 'cancel')
      : answers;
    const buttons = [...dialog.querySelectorAll('button')];
    // Footer order is Cancel, then the confirm button (alerts have one).
    const target =
      choice === 'confirm' || buttons.length === 1
        ? buttons[buttons.length - 1]
        : buttons[0];
    fireEvent.click(target);
  };
  const observer = new MutationObserver(answer);
  observer.observe(document.body, { childList: true, subtree: true });
  const stop = () => {
    observer.disconnect();
    if (stopAnswering === stop) stopAnswering = null;
  };
  stopAnswering = stop;
  // Never let one test's answers leak into the next.
  onTestFinished(stop);
  answer();
  return { titles, stop };
}
