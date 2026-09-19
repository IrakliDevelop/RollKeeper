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

  it('keeps the default warning glyph for a missing or unknown icon', () => {
    const plain = renderCard(base);
    const heading = plain.container.querySelector('h4');
    expect(plain.container.querySelector('.lucide-droplet')).toBeNull();
    // The glyph is the heading's previous sibling in the header row.
    expect(heading?.previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    cleanup();

    const unknown = renderCard({ ...base, icon: 'not-an-icon' });
    expect(unknown.container.querySelector('.lucide-droplet')).toBeNull();
    expect(
      unknown.container
        .querySelector('h4')
        ?.previousElementSibling?.tagName.toLowerCase()
    ).toBe('svg');
    expect(screen.getByText('Cursed Blood')).toBeTruthy();
  });
});
