import { cleanup, render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
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
});
