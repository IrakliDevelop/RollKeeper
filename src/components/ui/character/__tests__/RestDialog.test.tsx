import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { RestSlots } from '@/utils/calculations';

import RestDialog from '../RestDialog';

const FIGHTER: RestSlots = { pactMagic: false, spellSlots: false };
const WIZARD: RestSlots = { pactMagic: false, spellSlots: true };
const WARLOCK: RestSlots = { pactMagic: true, spellSlots: true };

function openDialog(restType: 'short' | 'long', slots: RestSlots) {
  render(
    <RestDialog
      restType={restType}
      slots={slots}
      onConfirm={() => {}}
      onClose={() => {}}
    />
  );
  return screen.getByRole('dialog');
}

describe('RestDialog', () => {
  afterEach(cleanup);

  it('promises Pact Magic slots on a short rest only to characters who have them', () => {
    expect(openDialog('short', FIGHTER)).toHaveAccessibleDescription(
      'Take a short rest (about 1 hour). This will reset abilities that recharge on a short rest and reset your reaction.'
    );
    cleanup();
    expect(openDialog('short', WARLOCK)).toHaveAccessibleDescription(
      'Take a short rest (about 1 hour). This will reset abilities that recharge on a short rest, restore Pact Magic slots, and reset your reaction.'
    );
  });

  it('promises spell slots on a long rest only to characters who have them', () => {
    expect(openDialog('long', FIGHTER)).toHaveAccessibleDescription(
      'Take a long rest (about 8 hours). This will fully restore HP, reset all abilities, restore hit dice, and clear temporary effects.'
    );
    cleanup();
    expect(openDialog('long', WIZARD)).toHaveAccessibleDescription(
      'Take a long rest (about 8 hours). This will fully restore HP, reset all abilities, restore all spell slots, restore hit dice, and clear temporary effects.'
    );
  });
});
