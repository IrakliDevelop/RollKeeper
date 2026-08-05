// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NpcResourceList } from '@/components/ui/encounter/combat-screen/detail/NpcResourceList';
import type { NpcResource } from '@/types/encounter';

afterEach(cleanup);

function res(overrides: Partial<NpcResource> = {}): NpcResource {
  return {
    id: 'res-1',
    name: 'Wild Shape',
    icon: 'paw-print',
    color: 'emerald',
    displayStyle: 'pips',
    maxUses: 3,
    usesExpended: 1,
    shortRestReset: 1,
    ...overrides,
  };
}

describe('NpcResourceList', () => {
  it('pips: clicking an available pip spends 1, a spent pip restores 1', async () => {
    const onSpend = vi.fn();
    const onRestore = vi.fn();
    const user = userEvent.setup();
    render(
      <NpcResourceList
        resources={[res()]}
        onSpend={onSpend}
        onRestore={onRestore}
      />
    );
    await user.click(
      screen.getByRole('button', { name: 'Wild Shape use 1 (spent)' })
    );
    expect(onRestore).toHaveBeenCalledWith('res-1', 1);
    await user.click(
      screen.getByRole('button', { name: 'Wild Shape use 2 (available)' })
    );
    expect(onSpend).toHaveBeenCalledWith('res-1', 1);
  });

  it('pool: renders remaining/max with −/+ and handles large values', async () => {
    const onSpend = vi.fn();
    const user = userEvent.setup();
    render(
      <NpcResourceList
        resources={[
          res({
            displayStyle: 'pool',
            name: 'Lay on Hands',
            maxUses: 60,
            usesExpended: 12,
          }),
        ]}
        onSpend={onSpend}
        onRestore={vi.fn()}
      />
    );
    expect(screen.getByText('48/60')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Spend Lay on Hands' })
    );
    expect(onSpend).toHaveBeenCalledWith('res-1', 1);
  });

  it('readOnly: renders no buttons at all (pips become static, pool loses −/+)', async () => {
    const { container } = render(
      <NpcResourceList
        resources={[res(), res({ id: 'b', name: 'Ki', displayStyle: 'pool' })]}
        onSpend={vi.fn()}
        onRestore={vi.fn()}
        readOnly
      />
    );
    expect(screen.getByText('2/3')).toBeVisible();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('pool: spend disabled at 0 remaining, restore disabled at 0 expended', async () => {
    render(
      <NpcResourceList
        resources={[
          res({ displayStyle: 'pool', maxUses: 2, usesExpended: 2, id: 'a' }),
          res({
            displayStyle: 'pool',
            maxUses: 2,
            usesExpended: 0,
            id: 'b',
            name: 'Ki',
          }),
        ]}
        onSpend={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Spend Wild Shape' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore Ki' })).toBeDisabled();
  });
});
