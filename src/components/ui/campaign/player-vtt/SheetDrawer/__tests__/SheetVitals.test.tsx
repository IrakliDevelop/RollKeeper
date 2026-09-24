import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SheetVitals } from '../SheetVitals';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

beforeEach(() => {
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    abilities: { ...base.abilities, dexterity: 18 },
    initiative: { ...base.initiative, isOverridden: false },
    hitPoints: { ...base.hitPoints, current: 20, max: 30, temporary: 0 },
  } as CharacterState);
});
afterEach(() => cleanup());

describe('SheetVitals', () => {
  it('applies damage through the store', () => {
    render(<SheetVitals addToast={vi.fn()} roll={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^damage$/i }));
    expect(useCharacterStore.getState().character.hitPoints.current).toBe(15);
  });

  it('rolls initiative with the dex modifier', () => {
    const roll = vi.fn().mockResolvedValue(undefined);
    render(<SheetVitals addToast={vi.fn()} roll={roll} />);
    fireEvent.click(screen.getByRole('button', { name: /roll initiative/i }));
    expect(roll).toHaveBeenCalledWith('Initiative', 4);
  });
});
