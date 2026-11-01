import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PactMagic, SpellSlots } from '@/types/character';
import { SpellSlotTracker } from '../SpellSlotTracker';

afterEach(cleanup);

const spellSlots: SpellSlots = {
  1: { max: 4, used: 1 },
  2: { max: 3, used: 0 },
  3: { max: 2, used: 2 },
  4: { max: 0, used: 0 },
  5: { max: 0, used: 0 },
  6: { max: 0, used: 0 },
  7: { max: 0, used: 0 },
  8: { max: 0, used: 0 },
  9: { max: 0, used: 0 },
};
const pactMagic: PactMagic = { slots: { max: 2, used: 1 }, level: 3 };

describe('SpellSlotTracker', () => {
  it('shows plain level text with available-first lapis pips', () => {
    render(<SpellSlotTracker spellSlots={spellSlots} />);
    expect(screen.getByText('Spell slots')).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.queryByText('L1')).not.toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.queryByText('Level 4')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
  });

  it('spends and restores one slot with each tap', () => {
    const onChange = vi.fn();
    render(
      <SpellSlotTracker spellSlots={spellSlots} onSpellSlotChange={onChange} />
    );
    const group = screen.getByRole('group', {
      name: '3 of 4 level 1 slots available',
    });
    fireEvent.click(group.querySelectorAll('button')[0]);
    fireEvent.click(group.querySelectorAll('button')[3]);
    expect(onChange.mock.calls).toEqual([
      [1, 1],
      [1, -1],
    ]);
  });

  it('names pact slots in one row and restores with an explicit no-arg callback', () => {
    const onReset = vi.fn();
    const onPactChange = vi.fn();
    render(
      <SpellSlotTracker
        spellSlots={spellSlots}
        pactMagic={pactMagic}
        onPactMagicChange={onPactChange}
        onResetPactMagic={onReset}
      />
    );
    expect(screen.getByText('Pact slots (level 3)')).toBeInTheDocument();
    const group = screen.getByRole('group', {
      name: '1 of 2 pact slots available',
    });
    fireEvent.click(group.querySelectorAll('button')[0]);
    fireEvent.click(group.querySelectorAll('button')[1]);
    expect(onPactChange.mock.calls).toEqual([[1], [-1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Restore pact slots' }));
    expect(onReset).toHaveBeenCalledWith();
  });

  it('restores all slots with an explicit no-arg callback', () => {
    const onReset = vi.fn();
    render(
      <SpellSlotTracker spellSlots={spellSlots} onResetSpellSlots={onReset} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restore all slots' }));
    expect(onReset).toHaveBeenCalledWith();
  });

  it('uses static pips when read only or when handlers are absent', () => {
    const onChange = vi.fn();
    render(
      <SpellSlotTracker
        spellSlots={spellSlots}
        onSpellSlotChange={onChange}
        readonly
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
  });

  it('keeps the compact NPC mount free of reset buttons and repeated heading', () => {
    render(
      <SpellSlotTracker
        spellSlots={spellSlots}
        compact
        hideTitle
        hideResetButtons
        onSpellSlotChange={vi.fn()}
      />
    );
    expect(screen.queryByText('Spell slots')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restore all slots' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: '3 of 4 level 1 slots available' })
    ).toBeInTheDocument();
  });

  it('returns null without regular or pact slots', () => {
    const empty = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i + 1, { max: 0, used: 0 }])
    ) as unknown as SpellSlots;
    expect(
      render(<SpellSlotTracker spellSlots={empty} />).container
    ).toBeEmptyDOMElement();
  });

  it('shows the pact count and draws no extra rule above a pact-only ledger', () => {
    const { container } = render(
      <SpellSlotTracker
        spellSlots={{
          ...spellSlots,
          1: { max: 0, used: 0 },
          2: { max: 0, used: 0 },
          3: { max: 0, used: 0 },
        }}
        pactMagic={pactMagic}
      />
    );
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(container.querySelector('.border-t')).toBeNull();
  });

  it('separates the pact row from regular levels with a rule', () => {
    const { container } = render(
      <SpellSlotTracker spellSlots={spellSlots} pactMagic={pactMagic} />
    );
    expect(container.querySelector('.border-t')).not.toBeNull();
  });
});
