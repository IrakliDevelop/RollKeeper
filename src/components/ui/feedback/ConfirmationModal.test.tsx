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
});
