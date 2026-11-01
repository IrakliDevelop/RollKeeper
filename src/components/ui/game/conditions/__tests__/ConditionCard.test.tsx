// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ConditionCard } from '@/components/ui/game/conditions/ConditionCard';
import type { ActiveCondition } from '@/types/character';

afterEach(cleanup);

const base: ActiveCondition = {
  id: 'c1',
  name: 'Cursed Blood',
  source: 'DM',
  description: 'Lose 1d4 HP each turn.',
  stackable: false,
  count: 1,
  appliedAt: '2026-09-19T10:00:00.000Z',
};

function renderCard(condition: ActiveCondition) {
  return render(
    <ConditionCard
      condition={condition}
      onView={vi.fn()}
      onRemove={vi.fn()}
      onUpdateCount={vi.fn()}
    />
  );
}

describe('ConditionCard', () => {
  it('renders the custom icon in the header when the condition has a registry icon', () => {
    const { container } = renderCard({ ...base, icon: 'droplet' });
    expect(screen.getByText('Cursed Blood')).toBeTruthy();
    expect(container.querySelector('.lucide-droplet')).not.toBeNull();
  });

  it('does not invent an icon when the condition has none or an unknown icon', () => {
    const plain = renderCard(base);
    expect(plain.container.querySelector('.lucide-droplet')).toBeNull();
    expect(
      plain.container.querySelector('[data-effect-row] svg')
    ).not.toBeNull();
    cleanup();

    const unknown = renderCard({ ...base, icon: 'not-an-icon' });
    expect(unknown.container.querySelector('.lucide-droplet')).toBeNull();
    expect(
      unknown.container.querySelector('.lucide-triangle-alert')
    ).toBeNull();
    expect(screen.getByText('Cursed Blood')).toBeTruthy();
  });
});
