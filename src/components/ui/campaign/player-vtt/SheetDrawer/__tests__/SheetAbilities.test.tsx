import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SheetAbilities } from '../SheetAbilities';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

beforeEach(() => {
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    abilities: { ...base.abilities, strength: 12 },
  } as CharacterState);
});
afterEach(() => cleanup());

describe('SheetAbilities', () => {
  it('rolls checks and saves', () => {
    const roll = vi.fn().mockResolvedValue(undefined);
    render(<SheetAbilities locked roll={roll} />);
    fireEvent.click(
      screen.getByRole('button', { name: /roll strength check/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /roll strength save/i })
    );
    expect(roll).toHaveBeenNthCalledWith(1, 'Strength Check', 1);
    expect(roll.mock.calls[1][0]).toBe('Strength Save');
  });

  it('renders checks and saves as non-interactive when roll is not provided', () => {
    render(<SheetAbilities locked />);
    expect(
      screen.queryByRole('button', { name: /roll strength check/i })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /roll strength save/i })
    ).toBeNull();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText(/save \+1/i)).toBeInTheDocument();
  });

  it('shows score inputs only when unlocked and writes through updateAbilityScore', () => {
    const { rerender } = render(<SheetAbilities locked roll={vi.fn()} />);
    expect(
      screen.queryByRole('textbox', { name: /strength score/i })
    ).toBeNull();
    rerender(<SheetAbilities locked={false} roll={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /strength score/i });
    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.blur(input);
    expect(useCharacterStore.getState().character.abilities.strength).toBe(14);
  });
});
