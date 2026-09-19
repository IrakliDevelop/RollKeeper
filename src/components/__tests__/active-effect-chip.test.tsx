// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ActiveEffectChip } from '@/components/ui/encounter/combat-screen/detail/ActiveEffectChip';
import type { EncounterCondition } from '@/types/encounter';

afterEach(cleanup);

const actions = {
  onSetConditionRounds: vi.fn(),
  onRemoveCondition: vi.fn(),
};

function renderChip(cond: EncounterCondition) {
  return render(
    <ActiveEffectChip cond={cond} entityId="e1" actions={actions} />
  );
}

describe('ActiveEffectChip', () => {
  it('shows the custom icon and uses the description as hover text', () => {
    const { container } = renderChip({
      id: 'c1',
      name: 'Cursed Blood',
      description: 'Lose 1d4 HP at the start of each turn.',
      icon: 'droplet',
      kind: 'debuff',
    });
    expect(container.querySelector('.lucide-droplet')).not.toBeNull();
    expect(container.firstElementChild?.getAttribute('title')).toBe(
      'Lose 1d4 HP at the start of each turn.'
    );
  });

  it('keeps the kind dot and the spell source when there is no icon', () => {
    const { container } = renderChip({
      id: 'c2',
      name: 'Blessed',
      kind: 'buff',
      sourceSpell: 'Bless',
    });
    expect(container.querySelector('svg.lucide-droplet')).toBeNull();
    expect(container.querySelector('span.rounded-full.h-2')).not.toBeNull();
    expect(container.firstElementChild?.getAttribute('title')).toBe(
      'From: Bless'
    );
  });

  it('joins description and spell source, and has no title when neither exists', () => {
    const both = renderChip({
      id: 'c3',
      name: 'Hexed',
      description: 'Disadvantage on Wisdom checks.',
      sourceSpell: 'Hex',
    });
    expect(both.container.firstElementChild?.getAttribute('title')).toBe(
      'Disadvantage on Wisdom checks. — From: Hex'
    );
    cleanup();
    const none = renderChip({ id: 'c4', name: 'Prone' });
    expect(none.container.firstElementChild?.hasAttribute('title')).toBe(false);
  });
});
