import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SheetDrawer } from '..';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

const props = () => ({
  open: true,
  onClose: vi.fn(),
  addToast: vi.fn(),
  showAttackRoll: vi.fn(),
  onRested: vi.fn(),
});
beforeEach(() => {
  window.localStorage.clear();
  const base = useCharacterStore.getState().character;
  useCharacterStore
    .getState()
    .loadCharacterState({ ...base, name: 'Kaelen Voss' } as CharacterState);
});
afterEach(() => cleanup());

describe('SheetDrawer', () => {
  it('opens as a dialog named after the character, locked', () => {
    render(<SheetDrawer {...props()} />);
    expect(
      screen.getByRole('dialog', { name: /kaelen voss/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
  });

  it('shows and dismisses the editing banner', () => {
    render(<SheetDrawer {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /locked/i }));
    expect(screen.getByText(/editing unlocked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(screen.queryByText(/editing unlocked/i)).toBeNull();
  });

  it('confirms a long rest through RestDialog and reports it', () => {
    const p = props();
    render(<SheetDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /long rest/i }));
    // RestDialog confirm button label — check REST_CONFIG in RestDialog.tsx and match it here.
    fireEvent.click(screen.getByRole('button', { name: /take long rest/i }));
    expect(p.onRested).toHaveBeenCalledWith('long');
  });

  it('resets to locked when reopened', () => {
    const p = props();
    const { rerender } = render(<SheetDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /locked/i }));
    rerender(<SheetDrawer {...p} open={false} />);
    rerender(<SheetDrawer {...p} open />);
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
  });

  it('closes via the close button', () => {
    const p = props();
    render(<SheetDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /close sheet/i }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('hides in-app dice rolling while it is behind the flag', () => {
    render(<SheetDrawer {...props()} />);
    expect(
      screen.queryByRole('button', { name: /roll initiative/i })
    ).toBeNull();
  });

  it('renders the Overview body as a tabpanel labelled by its tab', () => {
    render(<SheetDrawer {...props()} />);
    const tab = screen.getByRole('tab', { name: /overview/i });
    const panel = screen.getByRole('tabpanel', { name: /overview/i });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
  });
});
