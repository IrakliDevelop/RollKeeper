import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FeatureModal from '@/components/ui/character/ExtendedFeatures/FeatureModal';
import type { ExtendedFeature } from '@/types/character';

const FEATURE: ExtendedFeature = {
  id: 'feat-action-surge',
  name: 'Action Surge',
  maxUses: 1,
  usedUses: 0,
  restType: 'short',
  sourceType: 'class',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('FeatureModal', () => {
  afterEach(cleanup);

  it('asks before deleting and confirms with the solid danger button', () => {
    const onDelete = vi.fn();
    render(
      <FeatureModal
        feature={FEATURE}
        isOpen
        mode="view"
        characterLevel={2}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        onUse={vi.fn()}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toHaveAttribute('data-variant', 'danger');
    fireEvent.click(deleteButton);

    const confirm = screen.getByRole('button', { name: 'Delete Feature' });
    expect(confirm).toHaveAttribute('data-variant', 'danger-solid');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-variant',
      'outline'
    );
    fireEvent.click(confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
