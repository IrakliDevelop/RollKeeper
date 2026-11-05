// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import { MagicItemLibraryDialog } from '../MagicItemLibraryDialog';

vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({ items: [], loading: false }),
}));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({ items: [], loading: false }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MagicItemLibraryDialog', () => {
  it('uses the shared magic item form and submits the entered item', () => {
    const onSave = vi.fn();
    render(
      <MagicItemLibraryDialog
        open
        onOpenChange={() => {}}
        item={null}
        onSave={onSave}
      />
    );

    expect(screen.getByText('Basic information')).toBeInTheDocument();
    expect(
      screen.getByText('Charges and abilities (optional)')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add magic item' })
    ).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Moonlit Compass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add magic item' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Moonlit Compass' })
    );
  });

  it('titles the dialog and labels group and tags', () => {
    const { rerender } = render(
      <MagicItemLibraryDialog
        open
        onOpenChange={() => {}}
        item={null}
        onSave={() => {}}
      />
    );

    expect(
      screen.getByRole('dialog', { name: 'Create magic item' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Group (optional)' })
    ).toHaveAttribute('placeholder', 'Feywild rewards');
    const tags = screen.getByRole('textbox', { name: 'Tags' });
    expect(tags).toHaveAccessibleDescription('Separate tags with commas.');
    expect(tags).toHaveAttribute('placeholder', 'quest, utility, level 5');
    expect(
      screen.getByRole('textbox', { name: 'Start from any compendium item' })
    ).toHaveAttribute('placeholder', 'Cloak of elvenkind');

    const stored = (name: string): CustomMagicItem => ({
      id: 'm1',
      campaignCode: 'K7QX2M',
      name,
      category: 'wondrous',
      rarity: 'rare',
      description: '',
      properties: [],
      requiresAttunement: false,
      isAttuned: false,
      isEquipped: false,
      tags: [],
      createdAt: '',
      updatedAt: '',
    });
    rerender(
      <MagicItemLibraryDialog
        open
        onOpenChange={() => {}}
        item={stored('Moonlit Compass')}
        onSave={() => {}}
      />
    );
    expect(
      screen.getByRole('dialog', { name: 'Edit Moonlit Compass' })
    ).toBeInTheDocument();

    rerender(
      <MagicItemLibraryDialog
        open
        onOpenChange={() => {}}
        item={stored('')}
        onSave={() => {}}
      />
    );
    expect(
      screen.getByRole('dialog', { name: 'Edit magic item' })
    ).toBeInTheDocument();

    rerender(
      <MagicItemLibraryDialog
        open
        onOpenChange={() => {}}
        item={stored('  Moonlit Compass ')}
        onSave={() => {}}
      />
    );
    // Accessible names collapse whitespace, so read the raw title text.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Edit Moonlit Compass'
    );
  });
});
