import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import type {
  Spell,
  SpellSlots,
  ConcentrationState,
  PactMagic,
} from '@/types/character';

const spell: Spell = {
  id: 's1',
  name: 'Hunger of Hadar',
  level: 3,
  school: 'Conjuration',
  castingTime: '1 action',
  range: '150 feet',
  components: { verbal: true, somatic: true, material: true },
  duration: 'Concentration, up to 1 minute',
  description: 'A void opens.',
  aoe: { shape: 'circle', sizeFeet: 20 },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const emptySlots = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [i + 1, { max: 0, used: 0 }])
) as unknown as SpellSlots;

const noConc: ConcentrationState = {
  isConcentrating: false,
} as ConcentrationState;

function renderModal(pactMagic: PactMagic | null, onCastSpell = vi.fn()) {
  render(
    <SpellCastModal
      isOpen
      onClose={() => {}}
      spell={spell}
      spellSlots={emptySlots}
      concentration={noConc}
      onCastSpell={onCastSpell}
      pactMagic={pactMagic}
    />
  );
  return onCastSpell;
}

describe('SpellCastModal pact magic', () => {
  it('offers a pact slot and casts with usePact=true at pact level', () => {
    const onCastSpell = renderModal({ slots: { max: 2, used: 0 }, level: 3 });
    const pactButton = screen.getByRole('button', { name: /pact/i });
    fireEvent.click(pactButton);
    fireEvent.click(screen.getByRole('button', { name: /^cast/i }));
    // If multiple buttons match /^cast/i, read the confirm button's actual
    // label from the DialogFooter at the end of SpellCastModal.tsx and
    // tighten the query — do not weaken the assertion below.
    expect(onCastSpell).toHaveBeenCalledWith(3, false, false, true);
  });

  it('disables the pact option when pact slots are exhausted', () => {
    renderModal({ slots: { max: 2, used: 2 }, level: 3 });
    expect(screen.getByRole('button', { name: /pact/i })).toBeDisabled();
  });

  it('hides the pact option when pact level is below the spell level', () => {
    renderModal({ slots: { max: 2, used: 0 }, level: 2 });
    expect(screen.queryByRole('button', { name: /pact/i })).toBeNull();
  });

  it('renders no pact option without the prop (existing consumers)', () => {
    renderModal(null);
    expect(screen.queryByRole('button', { name: /pact/i })).toBeNull();
  });
});
