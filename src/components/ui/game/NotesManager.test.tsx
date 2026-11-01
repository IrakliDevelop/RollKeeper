import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotesManager from './NotesManager';

const { confirmDialog } = vi.hoisted(() => ({
  confirmDialog: vi.fn(async () => true),
}));
vi.mock('@/components/ui/feedback/confirm-dialog', () => ({ confirmDialog }));
vi.mock('./NoteModal', () => ({ default: () => null }));

beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
);
afterEach(() => {
  cleanup();
  confirmDialog.mockClear();
  vi.unstubAllGlobals();
});

const note = {
  id: 'one',
  title: 'Session one',
  content: '<p>Clue</p>',
  category: 'note' as const,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('NotesManager', () => {
  it('names sort and note actions, and confirms row deletion', async () => {
    const onDelete = vi.fn();
    render(
      <NotesManager
        items={[note]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    );
    expect(
      screen.getByRole('heading', { name: 'Session notes' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Sort notes' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Session one' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Session one' }));
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledWith('one'));
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Session one?',
        confirmLabel: 'Delete note',
      })
    );
  });
});
