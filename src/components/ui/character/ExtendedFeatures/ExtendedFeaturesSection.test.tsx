import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import ExtendedFeaturesSection from './ExtendedFeaturesSection';
import type { ExtendedFeature } from '@/types/character';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const { confirmDialog } = vi.hoisted(() => ({
  confirmDialog: vi.fn(async () => true),
}));
vi.mock('@/components/ui/feedback/confirm-dialog', () => ({ confirmDialog }));
vi.mock('./UnifiedFeatureModal', () => ({
  default: ({
    isOpen,
    feature,
  }: {
    isOpen: boolean;
    feature?: ExtendedFeature;
  }) =>
    isOpen ? <div role="dialog">{feature?.name || 'Add feature'}</div> : null,
}));
vi.mock('@/components/ui/layout/DragDropList', () => ({
  default: ({
    items,
    onReorder,
    renderItem,
  }: {
    items: ExtendedFeature[];
    onReorder: (source: number, target: number) => void;
    renderItem: (
      feature: ExtendedFeature,
      index: number,
      dragging: boolean
    ) => React.ReactNode;
  }) => (
    <div>
      {items.map((feature, index) => (
        <div key={feature.id}>{renderItem(feature, index, false)}</div>
      ))}
      {items.length > 1 && (
        <button onClick={() => onReorder(0, 1)}>Drag first to second</button>
      )}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  confirmDialog.mockClear();
});

function feature(
  id: string,
  name: string,
  overrides: Partial<ExtendedFeature> = {}
): ExtendedFeature {
  return {
    id,
    name,
    description: '<p>Extra action</p>',
    sourceType: 'class',
    source: 'Fighter',
    sourceDetail: 'Fighter 9',
    maxUses: 2,
    usedUses: 1,
    restType: 'short',
    isPassive: false,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderSection(
  features: ExtendedFeature[],
  { editing = false }: { editing?: boolean } = {}
) {
  const callbacks = {
    onAddFeature: vi.fn(),
    onUpdateFeature: vi.fn(),
    onDeleteFeature: vi.fn(),
    onUseFeature: vi.fn(),
    onResetFeatures: vi.fn(),
    onReorderFeatures: vi.fn(),
    onToggleFavoriteFeature: vi.fn(),
  };
  render(
    <ExtendedFeaturesSection
      features={features}
      character={makeCharacter({ extendedFeatures: features })}
      favoriteFeatureIds={[]}
      editing={editing}
      {...callbacks}
    />
  );
  return callbacks;
}

describe('03h1 Abilities list', () => {
  it('has one primary Add feature action and one plain empty state', () => {
    renderSection([]);
    expect(screen.getAllByRole('button', { name: 'Add feature' })).toHaveLength(
      1
    );
    expect(screen.getByText('No features yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Class features, racial traits and feats you add appear here.'
      )
    ).toBeInTheDocument();
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );
  });

  it('keeps a flat row with source, full name and details', () => {
    const longName =
      'Superiority Die — Precision Attack and Tactical Assessment';
    renderSection([feature('one', longName)]);
    const row = document.querySelector(
      '[data-feature-row="one"]'
    ) as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText(longName)).toBeInTheDocument();
    expect(within(row).getByText('Fighter 9')).toBeInTheDocument();
    expect(within(row).queryByText('Extra action')).not.toBeInTheDocument();
    fireEvent.click(
      within(row).getByRole('button', { name: `Open ${longName}` })
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(longName);
  });

  it('searches name, description and source without losing the detail path', () => {
    renderSection([
      feature('one', 'Second Wind', { description: '<p>Regain HP</p>' }),
      feature('two', 'Action Surge', { sourceDetail: 'Fighter 9' }),
      feature('three', 'Fey Ancestry', { source: 'Elf' }),
    ]);
    const search = screen.getByRole('searchbox', { name: 'Search abilities' });
    fireEvent.change(search, { target: { value: 'Regain' } });
    expect(document.querySelectorAll('[data-feature-row]')).toHaveLength(1);
    expect(screen.getByText('Second Wind')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Elf' } });
    expect(screen.getByText('Fey Ancestry')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Action' } });
    expect(screen.getByText('Action Surge')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'No match' } });
    expect(
      screen.getByText('No abilities match your search')
    ).toBeInTheDocument();
  });

  it('spends and restores one use with direct named pips', () => {
    const callbacks = renderSection([feature('one', 'Second Wind')]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Spend a use of Second Wind' })
    );
    expect(callbacks.onUpdateFeature).toHaveBeenCalledWith('one', {
      usedUses: 2,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore a use of Second Wind' })
    );
    expect(callbacks.onUpdateFeature).toHaveBeenCalledWith('one', {
      usedUses: 0,
    });
  });

  it('changes only one use even when a later pip is chosen', () => {
    const callbacks = renderSection([
      feature('one', 'Second Wind', { maxUses: 3, usedUses: 0 }),
    ]);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Spend a use of Second Wind' })[2]
    );
    expect(callbacks.onUpdateFeature).toHaveBeenCalledWith('one', {
      usedUses: 1,
    });
  });

  it('keeps Edit and Delete in play, asks before deleting, and returns focus to Add', async () => {
    const callbacks = renderSection([feature('one', 'Second Wind')]);
    const row = document.querySelector(
      '[data-feature-row="one"]'
    ) as HTMLElement;
    expect(
      within(row).getByRole('button', { name: 'Edit feature' })
    ).toBeInTheDocument();
    const deleteButton = within(row).getByRole('button', {
      name: 'Delete feature',
    });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    await waitFor(() =>
      expect(confirmDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Delete Second Wind?',
          confirmLabel: 'Delete feature',
          tone: 'danger',
        })
      )
    );
    await waitFor(() =>
      expect(callbacks.onDeleteFeature).toHaveBeenCalledWith('one')
    );
    expect(screen.getByRole('button', { name: 'Add feature' })).toHaveFocus();
  });

  it('maps drag and edit-mode Move controls to feature IDs', () => {
    const callbacks = renderSection(
      [feature('one', 'Second Wind'), feature('two', 'Action Surge')],
      { editing: true }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Drag first to second' })
    );
    expect(callbacks.onReorderFeatures).toHaveBeenCalledWith('one', 'two');
    const first = document.querySelector(
      '[data-feature-row="one"]'
    ) as HTMLElement;
    fireEvent.click(within(first).getByRole('button', { name: 'Move down' }));
    expect(callbacks.onReorderFeatures).toHaveBeenCalledWith('one', 'two');
    expect(
      within(first).getByRole('button', { name: 'Move up' })
    ).toBeDisabled();
  });
});
