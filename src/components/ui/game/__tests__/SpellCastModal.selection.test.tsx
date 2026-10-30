import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import type { ConcentrationState, Spell, SpellSlots } from '@/types/character';

afterEach(cleanup);

const detectMagic: Spell = {
  id: 's-detect',
  name: 'Detect Magic',
  level: 1,
  school: 'Divination',
  castingTime: '1 action',
  range: 'Self',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Concentration, up to 10 minutes',
  description: 'You sense magic.',
  ritual: true,
  concentration: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function slots(level3Used: number): SpellSlots {
  return {
    1: { max: 4, used: 0 },
    2: { max: 3, used: 0 },
    3: { max: 2, used: level3Used },
    4: { max: 0, used: 0 },
    5: { max: 0, used: 0 },
    6: { max: 0, used: 0 },
    7: { max: 0, used: 0 },
    8: { max: 0, used: 0 },
    9: { max: 0, used: 0 },
  };
}

const noConc = { isConcentrating: false } as ConcentrationState;

describe('SpellCastModal choice', () => {
  it('keeps the chosen option when slots change but the same levels stay available', () => {
    const onCastSpell = vi.fn();
    const props = {
      isOpen: true,
      onClose: () => {},
      spell: detectMagic,
      concentration: noConc,
      onCastSpell,
    };
    const { rerender } = render(
      <SpellCastModal {...props} spellSlots={slots(0)} />
    );
    fireEvent.click(screen.getByRole('radio', { name: /ritual/i }));
    // Another tab spends a level 3 slot: a new spellSlots object arrives.
    rerender(<SpellCastModal {...props} spellSlots={slots(1)} />);
    expect(screen.getByRole('radio', { name: /ritual/i })).toHaveAttribute(
      'data-state',
      'checked'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cast Detect Magic' }));
    expect(onCastSpell).toHaveBeenCalledWith(1, false, true, false);
  });

  it('warns in one line that casting ends the current concentration', () => {
    render(
      <SpellCastModal
        isOpen
        onClose={() => {}}
        spell={detectMagic}
        spellSlots={slots(0)}
        concentration={
          { isConcentrating: true, spellName: 'Bless' } as ConcentrationState
        }
        onCastSpell={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent === 'Casting this ends your concentration on Bless.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Ends your concentration')
    ).not.toBeInTheDocument();
  });
});
