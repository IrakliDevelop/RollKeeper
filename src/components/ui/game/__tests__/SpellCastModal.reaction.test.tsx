import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import type { Spell, SpellSlots, ConcentrationState } from '@/types/character';

function makeSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 's1',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction',
    range: 'Self',
    components: { verbal: true, somatic: true, material: false },
    duration: '1 round',
    description: 'An invisible barrier.',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as Spell;
}

const slotsWithLevel1 = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [
    i + 1,
    i + 1 === 1 ? { max: 2, used: 0 } : { max: 0, used: 0 },
  ])
) as unknown as SpellSlots;

const noConc: ConcentrationState = {
  isConcentrating: false,
} as ConcentrationState;

function renderModal(
  spell: Spell,
  hasUsedReaction: boolean,
  onReactionSpellCast = vi.fn()
) {
  render(
    <SpellCastModal
      isOpen
      onClose={() => {}}
      spell={spell}
      spellSlots={slotsWithLevel1}
      concentration={noConc}
      hasUsedReaction={hasUsedReaction}
      onCastSpell={vi.fn()}
      onReactionSpellCast={onReactionSpellCast}
    />
  );
  return onReactionSpellCast;
}

function clickCast() {
  fireEvent.click(screen.getByRole('button', { name: /^cast shield/i }));
}

describe('SpellCastModal reaction auto-mark', () => {
  it('fires onReactionSpellCast when casting a reaction spell with reaction available', () => {
    const spy = renderModal(makeSpell(), false);
    clickCast();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the reaction is already used (warning path)', () => {
    const spy = renderModal(makeSpell(), true);
    expect(screen.getByText(/reaction already used/i)).toBeInTheDocument();
    clickCast();
    expect(spy).not.toHaveBeenCalled();
  });

  it('never fires for a non-reaction spell', () => {
    const spy = renderModal(
      makeSpell({ name: 'Shield', castingTime: '1 action' }),
      false
    );
    clickCast();
    expect(spy).not.toHaveBeenCalled();
  });
});
