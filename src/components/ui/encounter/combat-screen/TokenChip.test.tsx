// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenChip } from './TokenChip';
import type { EncounterEntity } from '@/types/encounter';

const entity: EncounterEntity = {
  id: 'goblin-1',
  type: 'monster',
  name: 'Goblin',
  initiative: 12,
  initiativeModifier: 2,
  currentHp: 7,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
};
afterEach(cleanup);

describe('TokenChip', () => {
  it('keeps token choices in entity updates and returns focus after Done', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<TokenChip entity={entity} size="sm" actions={{ onUpdate }} />);
    await user.click(screen.getByRole('button', { name: 'Edit Goblin token' }));
    expect(
      screen.getByRole('button', { name: 'king for Goblin' })
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'king for Goblin' }));
    expect(onUpdate).toHaveBeenCalledWith('goblin-1', { chessPiece: 'king' });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.getByRole('button', { name: 'Edit Goblin token' })
    ).toHaveFocus();
  });
});
