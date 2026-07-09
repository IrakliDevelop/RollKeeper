import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import { DockSpells } from '@/components/ui/campaign/player-vtt/CharacterDock/DockSpells';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, Spell } from '@/types/character';

function makeSpell(
  overrides: Partial<Spell> & Pick<Spell, 'id' | 'name' | 'level'>
): Spell {
  return {
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test spell.',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const FIRE_BOLT = makeSpell({
  id: 'firebolt',
  name: 'Fire Bolt',
  level: 0,
  isPrepared: true,
});
const SHIELD = makeSpell({
  id: 'shield',
  name: 'Shield',
  level: 1,
  castingTime: '1 reaction',
  duration: '1 round',
  isPrepared: true,
});
const FIREBALL = makeSpell({
  id: 'fireball',
  name: 'Fireball',
  level: 3,
  range: '150 feet',
  components: { verbal: true, somatic: true, material: true },
  aoe: { shape: 'circle', sizeFeet: 20 },
  isPrepared: true,
});
const HOLD_PERSON = makeSpell({
  id: 'holdperson',
  name: 'Hold Person',
  level: 2,
  concentration: true,
  duration: 'Concentration, up to 1 minute',
  isPrepared: true,
});

function seedCharacter(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    class: { name: 'Wizard', isCustom: false, spellcaster: 'full', hitDie: 6 },
    level: 5,
    abilities: { ...base.abilities, intelligence: 18 },
    spellcastingStats: {
      spellcastingAbility: 'intelligence',
      isAbilityOverridden: false,
      spellAttackBonus: undefined,
      spellSaveDC: undefined,
    },
    spellSlots: {
      1: { max: 4, used: 0 },
      2: { max: 3, used: 0 },
      3: { max: 2, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    },
    concentration: { isConcentrating: false },
    reaction: { hasUsedReaction: false },
    spells: [FIRE_BOLT, SHIELD, FIREBALL, HOLD_PERSON],
    ...overrides,
  } as CharacterState);
}

const getChar = () => useCharacterStore.getState().character;

/** The Cast button that lives in the same row as `spellName`. */
function castButtonFor(spellName: string): HTMLElement {
  const row = screen.getByText(spellName).closest('.border-divider');
  return within(row as HTMLElement).getByRole('button', { name: /^cast$/i });
}

function renderDock(
  propOverrides: Partial<Parameters<typeof DockSpells>[0]> = {}
) {
  const addToast = vi.fn();
  const onCastPlacement = vi.fn();
  const onCancelPlacement = vi.fn();
  const utils = render(
    <DockSpells
      addToast={addToast}
      onCastPlacement={onCastPlacement}
      connectionLive
      hasPendingPlacement={false}
      onCancelPlacement={onCancelPlacement}
      {...propOverrides}
    />
  );
  return { ...utils, addToast, onCastPlacement, onCancelPlacement };
}

describe('DockSpells', () => {
  beforeEach(() => {
    seedCharacter();
  });

  afterEach(() => cleanup());

  it('groups spells by level ascending, cantrips first', () => {
    renderDock();
    const headers = screen
      .getAllByRole('button')
      .map(b => b.textContent)
      .filter(t => t && /Cantrips|Level \d/.test(t));

    expect(headers[0]).toMatch(/Cantrips/);
    expect(headers[1]).toMatch(/Level 1/);
    expect(headers[2]).toMatch(/Level 2/);
    expect(headers[3]).toMatch(/Level 3/);

    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Shield')).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('search filters spells by name (case-insensitive)', () => {
    renderDock();
    fireEvent.change(screen.getByRole('textbox', { name: /search spells/i }), {
      target: { value: 'fire' },
    });

    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.queryByText('Shield')).not.toBeInTheDocument();
    expect(screen.queryByText('Hold Person')).not.toBeInTheDocument();
  });

  it('cantrip Cast casts immediately with no modal, effect visible in store', () => {
    renderDock();
    fireEvent.click(castButtonFor('Fire Bolt'));

    // No slot spent (cantrip), no modal opened.
    expect(screen.queryByText('Cast Spell')).not.toBeInTheDocument();
    expect(getChar().spellSlots[1].used).toBe(0);
  });

  it('AoE spell cast via modal spends the slot and calls onCastPlacement with no toast', () => {
    const { addToast, onCastPlacement } = renderDock();

    fireEvent.click(castButtonFor('Fireball'));
    fireEvent.click(screen.getByRole('button', { name: /^cast fireball/i }));

    expect(getChar().spellSlots[3].used).toBe(1);
    expect(onCastPlacement).toHaveBeenCalledWith('Fireball', {
      shape: 'circle',
      sizeFeet: 20,
    });
    expect(addToast).not.toHaveBeenCalled();
  });

  it('AoE cast while offline skips onCastPlacement and fires an offline toast', () => {
    const { addToast, onCastPlacement } = renderDock({ connectionLive: false });

    fireEvent.click(castButtonFor('Fireball'));
    fireEvent.click(screen.getByRole('button', { name: /^cast fireball/i }));

    expect(onCastPlacement).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        title: 'Fireball cast',
        message: 'Offline — template not placed',
      })
    );
  });

  it('non-AoE leveled cast fires a success toast', () => {
    const { addToast } = renderDock();

    fireEvent.click(castButtonFor('Shield'));
    fireEvent.click(screen.getByRole('button', { name: /^cast shield/i }));

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Shield cast' })
    );
  });

  it('casting a concentration spell with no aoe cancels a stale pending placement', () => {
    const { onCancelPlacement } = renderDock({ hasPendingPlacement: true });

    fireEvent.click(castButtonFor('Hold Person'));
    fireEvent.click(screen.getByRole('button', { name: /^cast hold person/i }));

    expect(onCancelPlacement).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a non-caster', () => {
    seedCharacter({
      class: {
        name: 'Fighter',
        isCustom: false,
        spellcaster: 'none',
        hitDie: 10,
      },
      spellcastingStats: {
        spellcastingAbility: null,
        isAbilityOverridden: false,
        spellAttackBonus: undefined,
        spellSaveDC: undefined,
      },
    });
    const { container } = renderDock();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the character has zero spells', () => {
    seedCharacter({ spells: [] });
    const { container } = renderDock();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only castable spells: prepared/always-prepared spells and prepared cantrips', () => {
    const preparedCantrip = makeSpell({
      id: 'mage-hand',
      name: 'Mage Hand',
      level: 0,
      isPrepared: true,
    });
    const unpreparedCantrip = makeSpell({
      id: 'prestidigitation',
      name: 'Prestidigitation',
      level: 0,
      isPrepared: false,
    });
    const preparedSpell = makeSpell({
      id: 'magic-missile',
      name: 'Magic Missile',
      level: 1,
      isPrepared: true,
    });
    const unpreparedSpell = makeSpell({
      id: 'sleep',
      name: 'Sleep',
      level: 1,
      isPrepared: false,
    });
    const alwaysPreparedSpell = makeSpell({
      id: 'hunter-mark',
      name: "Hunter's Mark",
      level: 1,
      isPrepared: false,
      isAlwaysPrepared: true,
    });

    seedCharacter({
      spells: [
        preparedCantrip,
        unpreparedCantrip,
        preparedSpell,
        unpreparedSpell,
        alwaysPreparedSpell,
      ],
    });

    renderDock();

    // Castable spells should render
    expect(screen.getByText('Mage Hand')).toBeInTheDocument();
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    expect(screen.getByText("Hunter's Mark")).toBeInTheDocument();

    // Non-castable spells should NOT render
    expect(screen.queryByText('Prestidigitation')).not.toBeInTheDocument();
    expect(screen.queryByText('Sleep')).not.toBeInTheDocument();
  });
});
