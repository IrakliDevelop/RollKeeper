import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { StatusEffectTray } from '@/components/ui/campaign/player-vtt/StatusEffectTray';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, ActiveCondition } from '@/types/character';

function seedCharacter(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    ...overrides,
  } as CharacterState);
}

const getChar = () => useCharacterStore.getState().character;

const makeCondition = (
  over: Partial<ActiveCondition> = {}
): ActiveCondition => ({
  id: 'poisoned-1',
  name: 'Poisoned',
  source: 'Self',
  description: '',
  stackable: false,
  count: 1,
  appliedAt: new Date().toISOString(),
  ...over,
});

describe('StatusEffectTray', () => {
  beforeEach(() => {
    seedCharacter();
  });

  afterEach(() => cleanup());

  it('does not render a CONC chip while not concentrating', () => {
    seedCharacter({
      concentration: { isConcentrating: false },
    });
    render(<StatusEffectTray />);
    expect(screen.queryByText(/conc/i)).not.toBeInTheDocument();
  });

  it('renders a CONC chip while concentrating and ends concentration from the dialog', () => {
    seedCharacter({
      concentration: { isConcentrating: true, spellName: 'Bless' },
    });
    render(<StatusEffectTray />);

    fireEvent.click(screen.getByRole('button', { name: /conc/i }));
    expect(screen.getByText(/Concentrating on Bless/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /end concentration/i }));

    expect(getChar().concentration.isConcentrating).toBe(false);
  });

  it('renders a condition chip per active condition and removes it', () => {
    seedCharacter({
      conditionsAndDiseases: {
        ...getChar().conditionsAndDiseases,
        activeConditions: [makeCondition()],
      },
    });
    render(<StatusEffectTray />);

    expect(screen.getByText('Poisoned')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove poisoned/i }));

    expect(getChar().conditionsAndDiseases.activeConditions).toHaveLength(0);
  });

  it('adds a condition from the quick-add picker', () => {
    render(<StatusEffectTray />);

    fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Blinded$/ }));

    const conditions = getChar().conditionsAndDiseases.activeConditions;
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toMatchObject({
      name: 'Blinded',
      source: 'Self',
      count: 1,
    });
  });
});
