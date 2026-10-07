import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InitiativeRow } from '@/components/ui/campaign/dm-vtt/StudioPanel/InitiativeRow';
import type { EncounterEntity } from '@/types/encounter';

afterEach(cleanup);

const entity: EncounterEntity = {
  id: 'm-aria',
  type: 'player',
  name: 'Aria',
  initiative: 15,
  initiativeModifier: 0,
  currentHp: 0,
  maxHp: 0,
  tempHp: 0,
  armorClass: 0,
  conditions: [],
  concentrationSpell: 'Bless',
  isHidden: true,
};

describe('InitiativeRow hpUnknown (N3)', () => {
  it('replaces HP/AC with unknown markers but keeps stripe and indicators', () => {
    const { container } = render(
      <ul>
        <InitiativeRow
          entity={entity}
          isActive={false}
          isSelected={false}
          onSelect={vi.fn()}
          hpUnknown
        />
      </ul>
    );
    expect(screen.getByText(/HP —/)).toBeVisible();
    expect(screen.queryByText('0/0')).toBeNull();
    expect(screen.queryByText('AC 0')).toBeNull();
    expect(screen.getByTitle('Concentrating: Bless')).toBeInTheDocument();
    expect(screen.getByText('hidden')).toBeVisible();
    expect(
      container.querySelector('[aria-hidden="true"].h-8.w-1')
    ).not.toBeNull();
  });
});
