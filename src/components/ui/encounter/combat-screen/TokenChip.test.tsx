// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
      screen.getByRole('button', { name: 'King for Goblin' })
    ).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'King for Goblin' }));
    expect(onUpdate).toHaveBeenCalledWith('goblin-1', { chessPiece: 'king' });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.getByRole('button', { name: 'Edit Goblin token' })
    ).toHaveFocus();
  });

  it('closes on Escape and an outside click, restoring focus to the trigger', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <TokenChip entity={entity} size="sm" actions={{ onUpdate: vi.fn() }} />
      </div>
    );
    const trigger = screen.getByRole('button', { name: 'Edit Goblin token' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('group', { name: 'Goblin token appearance' })
    ).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Goblin token' })
      ).toHaveFocus()
    );
    await user.click(screen.getByRole('button', { name: 'Edit Goblin token' }));
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(
      screen.queryByRole('group', { name: 'Goblin token appearance' })
    ).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit Goblin token' })
      ).toHaveFocus()
    );
  });
});
