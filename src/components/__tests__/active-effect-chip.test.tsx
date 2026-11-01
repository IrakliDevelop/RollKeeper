// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  it('keeps the custom icon and excludes long rules text from the compact chip', () => {
    const { container } = renderChip({
      id: 'c1',
      name: 'Cursed Blood',
      description: 'Lose 1d4 HP at the start of each turn.',
      icon: 'droplet',
      kind: 'debuff',
    });
    expect(container.querySelector('.lucide-droplet')).not.toBeNull();
    expect(container).not.toHaveTextContent(
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
    expect(container.querySelector('span.rounded-full')).not.toBeNull();
    expect(container).toHaveTextContent('From Bless');
    expect(
      screen.getByRole('img', { name: 'No round limit' })
    ).toBeInTheDocument();
  });

  it('shows spell source without a rules paragraph or title tooltip', () => {
    const both = renderChip({
      id: 'c3',
      name: 'Hexed',
      description: 'Disadvantage on Wisdom checks.',
      sourceSpell: 'Hex',
    });
    expect(both.container).not.toHaveTextContent(
      'Disadvantage on Wisdom checks.'
    );
    expect(both.container).toHaveTextContent('From Hex');
    cleanup();
    const none = renderChip({ id: 'c4', name: 'Prone' });
    expect(none.container.firstElementChild?.hasAttribute('title')).toBe(false);
  });
});
