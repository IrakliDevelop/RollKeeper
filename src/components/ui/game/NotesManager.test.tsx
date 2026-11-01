import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
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

  it('uses the same untitled deletion confirmation as the note dialog', async () => {
    const onDelete = vi.fn();
    render(
      <NotesManager
        items={[{ ...note, title: '' }]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Edit untitled note' })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete untitled note' })
    );
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('one'));
    expect(confirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete this note?',
        message: "This can't be undone.",
        confirmLabel: 'Delete note',
      })
    );
  });

  it('returns focus to Add note after a confirmed row deletion', async () => {
    function Notes() {
      const [items, setItems] = useState([note]);
      return (
        <NotesManager
          items={items}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onDelete={id =>
            setItems(current => current.filter(item => item.id !== id))
          }
        />
      );
    }
    render(<Notes />);
    const remove = screen.getByRole('button', { name: 'Delete Session one' });
    remove.focus();
    fireEvent.click(remove);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add note' })).toHaveFocus()
    );
  });
});
