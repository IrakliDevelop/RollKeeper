import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeaturesTraitsManager from './FeaturesTraitsManager';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog/confirmDialogStore';

vi.mock('@/components/ui/forms', () => ({ RichTextEditor: () => <div /> }));
vi.mock('@/components/ui/feedback/confirm-dialog/confirmDialogStore', () => ({
  confirmDialog: vi.fn(),
}));
afterEach(cleanup);

describe('FeaturesTraitsManager', () => {
  it('confirms a trait deletion and moves focus to the Add control', async () => {
    const onDelete = vi.fn();
    vi.mocked(confirmDialog).mockResolvedValue(true);
    const user = userEvent.setup();
    render(
      <FeaturesTraitsManager
        items={[
          {
            id: 'trait-1',
            title: 'Brave',
            content: '<p>Never backs down.</p>',
            category: 'trait',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        category="trait"
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete Brave' }));
    expect(confirmDialog).toHaveBeenCalledWith({
      title: 'Delete Brave?',
      confirmLabel: 'Delete trait',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    expect(onDelete).toHaveBeenCalledWith('trait-1');
    expect(screen.getByRole('button', { name: 'Add trait' })).toHaveFocus();
  });
});
