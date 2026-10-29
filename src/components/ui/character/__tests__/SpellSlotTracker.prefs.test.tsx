import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SpellSlots } from '@/types/character';

const slots: SpellSlots = {
  1: { max: 4, used: 2 },
  2: { max: 0, used: 0 },
  3: { max: 0, used: 0 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(cleanup);

describe('sheet SpellSlotTracker disclosure', () => {
  it('stores expansion per device without a character action', async () => {
    const Tracker = (await import('../SpellSlotTracker')).default;
    render(
      <Tracker
        spellSlots={slots}
        onSpellSlotChange={vi.fn()}
        onResetSpellSlots={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button', { name: 'Spell slots' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('group', { name: '2 of 4 level 1 slots available' })
    ).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('group', { name: '2 of 4 level 1 slots available' })
    ).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem('rollkeeper-ui-prefs')!)
    ).toMatchObject({ spellSlotsExpanded: true });
  });
});
