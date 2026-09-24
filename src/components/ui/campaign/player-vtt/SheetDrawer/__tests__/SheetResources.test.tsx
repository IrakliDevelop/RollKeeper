import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SheetResources } from '../SheetResources';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

function seed(overrides: Partial<CharacterState> = {}) {
  const base = useCharacterStore.getState().character;
  useCharacterStore.getState().loadCharacterState({
    ...base,
    ...overrides,
  } as CharacterState);
}

function fighter(level: number) {
  seed({
    classes: [
      {
        className: 'Fighter',
        level,
        isCustom: false,
        hitDie: 10,
        classSource: 'XPHB',
      },
    ],
    totalLevel: level,
  });
}

function paladin(level: number) {
  seed({
    classes: [
      {
        className: 'Paladin',
        level,
        isCustom: false,
        hitDie: 10,
        classSource: 'XPHB',
      },
    ],
    totalLevel: level,
  });
}

afterEach(() => cleanup());

beforeEach(() => {
  seed({ classes: [] });
});

describe('SheetResources', () => {
  it('renders nothing when there are no active resources', () => {
    seed({ classes: [] });
    const { container } = render(<SheetResources />);
    expect(container).toBeEmptyDOMElement();
  });

  it('spends and restores a pips resource through the store', () => {
    fighter(1); // Second Wind, max 2

    render(<SheetResources />);
    const spendButtons = screen.getAllByRole('button', {
      name: /spend second wind/i,
    });
    expect(spendButtons).toHaveLength(2);

    fireEvent.click(spendButtons[0]);
    expect(
      useCharacterStore.getState().character.classResources?.['second-wind']
        ?.usesExpended
    ).toBe(1);

    fireEvent.click(
      screen.getByRole('button', { name: /restore second wind/i })
    );
    expect(
      useCharacterStore.getState().character.classResources?.['second-wind']
        ?.usesExpended
    ).toBe(0);
  });

  it('spends and restores a pool resource by 1 and by 5 when max is at least 20', () => {
    paladin(4); // Lay on Hands, max 20

    render(<SheetResources />);
    fireEvent.click(
      screen.getByRole('button', { name: /spend 1 lay on hands/i })
    );
    expect(
      useCharacterStore.getState().character.classResources?.['lay-on-hands']
        ?.usesExpended
    ).toBe(1);

    fireEvent.click(
      screen.getByRole('button', { name: /spend 5 lay on hands/i })
    );
    expect(
      useCharacterStore.getState().character.classResources?.['lay-on-hands']
        ?.usesExpended
    ).toBe(6);

    fireEvent.click(
      screen.getByRole('button', { name: /restore 1 lay on hands/i })
    );
    expect(
      useCharacterStore.getState().character.classResources?.['lay-on-hands']
        ?.usesExpended
    ).toBe(5);

    fireEvent.click(
      screen.getByRole('button', { name: /restore 5 lay on hands/i })
    );
    expect(
      useCharacterStore.getState().character.classResources?.['lay-on-hands']
        ?.usesExpended
    ).toBe(0);
  });

  it('hides the ±5 buttons for a pool resource under 20 max uses', () => {
    paladin(1); // Lay on Hands, max 5

    render(<SheetResources />);
    expect(
      screen.queryByRole('button', { name: /spend 5 lay on hands/i })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /restore 5 lay on hands/i })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: /spend 1 lay on hands/i })
    ).toBeInTheDocument();
  });

  it('resets a resource through the store', () => {
    fighter(1);
    seed({
      classes: [
        {
          className: 'Fighter',
          level: 1,
          isCustom: false,
          hitDie: 10,
          classSource: 'XPHB',
        },
      ],
      totalLevel: 1,
      classResources: { 'second-wind': { usesExpended: 2 } },
    });

    render(<SheetResources />);
    fireEvent.click(screen.getByRole('button', { name: /reset second wind/i }));
    expect(
      useCharacterStore.getState().character.classResources?.['second-wind']
        ?.usesExpended
    ).toBe(0);
  });

  it('disables the pool spend buttons at 0 remaining and restore buttons at max', () => {
    paladin(4);
    seed({
      classes: [
        {
          className: 'Paladin',
          level: 4,
          isCustom: false,
          hitDie: 10,
          classSource: 'XPHB',
        },
      ],
      totalLevel: 4,
      classResources: { 'lay-on-hands': { usesExpended: 20 } },
    });

    render(<SheetResources />);
    expect(
      screen.getByRole('button', { name: /spend 1 lay on hands/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /spend 5 lay on hands/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /restore 1 lay on hands/i })
    ).not.toBeDisabled();
  });

  it('does not render spend pips once fully expended', () => {
    fighter(1);
    seed({
      classes: [
        {
          className: 'Fighter',
          level: 1,
          isCustom: false,
          hitDie: 10,
          classSource: 'XPHB',
        },
      ],
      totalLevel: 1,
      classResources: { 'second-wind': { usesExpended: 2 } },
    });

    render(<SheetResources />);
    expect(
      screen.queryByRole('button', { name: /spend second wind/i })
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /restore second wind/i })
    ).toHaveLength(2);
  });
});
