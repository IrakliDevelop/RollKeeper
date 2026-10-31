import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GrantedSpellPicker from './GrantedSpellPicker';

describe('GrantedSpellPicker', () => {
  afterEach(cleanup);

  it('keeps the spell filter inside the active dialog', async () => {
    render(
      <GrantedSpellPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        featName="Synthetic feat"
        parsed={{
          concrete: [],
          choices: [{ filter: 'level=1', count: 1, grantType: 'known' }],
        }}
        allSpells={[]}
        spellsLoading={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Browse level 1/i }));

    const dialog = screen.getByRole('dialog', { name: 'Feat Grants Spells' });
    const filter = await screen.findByRole('textbox', {
      name: 'Filter spells',
    });
    expect(dialog).toContainElement(filter);

    fireEvent.mouseDown(filter);
    fireEvent.click(filter);
    expect(
      screen.getByRole('textbox', { name: 'Filter spells' })
    ).toBeVisible();
  });

  it('exposes each granted spell row as a checkbox', () => {
    render(
      <GrantedSpellPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        featName="Synthetic feat"
        parsed={{
          concrete: [
            { spellName: 'Shield', sourceRef: 'shield', grantType: 'known' },
          ],
          choices: [],
        }}
        allSpells={
          [
            {
              id: 'shield',
              name: 'Shield',
              level: 1,
              school: 'A',
              schoolName: 'Abjuration',
              castingTime: '1 reaction',
              range: 'Self',
              components: { verbal: true, somatic: true, material: false },
              duration: '1 round',
              description: 'An invisible barrier of magical force appears.',
              source: 'PHB',
            },
          ] as never
        }
        spellsLoading={false}
      />
    );
    const row = screen.getByRole('checkbox', { name: /Shield/ });
    expect(row).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(row);
    expect(screen.getByRole('checkbox', { name: /Shield/ })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });
});
