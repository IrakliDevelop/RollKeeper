// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
