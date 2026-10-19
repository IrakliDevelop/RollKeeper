import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationModal } from '@/components/ui/feedback/ConfirmationModal';

describe('ConfirmationModal', () => {
  afterEach(cleanup);

  it('associates the confirmation message with the dialog', () => {
    render(
      <ConfirmationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete magic item template?"
        message="The library copy will be deleted."
      />
    );

    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'The library copy will be deleted.'
    );
  });

  it('confirms a destructive action with the solid danger button', () => {
    render(
      <ConfirmationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete magic item template?"
        message="The library copy will be deleted."
        confirmText="Delete template"
      />
    );

    expect(
      screen.getByRole('button', { name: 'Delete template' })
    ).toHaveAttribute('data-variant', 'danger-solid');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-variant',
      'outline'
    );
  });

  it('keeps the primary button for a non-destructive confirmation', () => {
    render(
      <ConfirmationModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Share this map?"
        message="Players will see it."
        confirmText="Share"
        type="info"
      />
    );

    expect(screen.getByRole('button', { name: 'Share' })).toHaveAttribute(
      'data-variant',
      'primary'
    );
  });

  it('returns focus to the button that opened it', async () => {
    function ResetButton() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Reset character
          </button>
          <ConfirmationModal
            isOpen={open}
            onClose={() => setOpen(false)}
            onConfirm={vi.fn()}
            title="Reset Character"
            message="This action cannot be undone."
            confirmText="Reset Character"
            cancelText="Keep Character"
          />
        </>
      );
    }
    render(<ResetButton />);
    const trigger = screen.getByRole('button', { name: 'Reset character' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Keep Character' })
    );

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
