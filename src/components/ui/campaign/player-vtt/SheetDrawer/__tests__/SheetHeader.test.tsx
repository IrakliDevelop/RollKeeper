import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SheetHeader } from '../SheetHeader';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

beforeEach(() => {
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    name: 'Kaelen Voss',
    race: 'Half-Elf',
    background: 'Outlander',
    concentration: { isConcentrating: true, spellName: "Hunter's Mark" },
  } as CharacterState);
});
afterEach(() => cleanup());

const props = () => ({
  locked: true,
  onToggleLock: vi.fn(),
  onClose: vi.fn(),
  onShortRest: vi.fn(),
  onLongRest: vi.fn(),
});

describe('SheetHeader', () => {
  it('shows name and concentration chip', () => {
    render(<SheetHeader {...props()} />);
    expect(
      screen.getByRole('heading', { name: 'Kaelen Voss' })
    ).toBeInTheDocument();
    expect(screen.getByText("Hunter's Mark")).toBeInTheDocument();
  });

  it('toggles lock, closes, and requests rests', () => {
    const p = props();
    render(<SheetHeader {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /locked/i }));
    fireEvent.click(screen.getByRole('button', { name: /close sheet/i }));
    fireEvent.click(screen.getByRole('button', { name: /short rest/i }));
    fireEvent.click(screen.getByRole('button', { name: /long rest/i }));
    expect(p.onToggleLock).toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onShortRest).toHaveBeenCalled();
    expect(p.onLongRest).toHaveBeenCalled();
  });

  it('labels the lock button Editing when unlocked', () => {
    render(<SheetHeader {...props()} locked={false} />);
    expect(
      screen.getByRole('button', { name: /editing/i })
    ).toBeInTheDocument();
  });
});
