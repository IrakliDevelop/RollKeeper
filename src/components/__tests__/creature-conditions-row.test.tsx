// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CreatureConditionsRow } from '@/components/ui/encounter/combat-screen/detail/CreatureConditionsRow';

afterEach(cleanup);

describe('CreatureConditionsRow', () => {
  it('shows only a one-line plain summary and keeps full rules for Apply', () => {
    const onApply = vi.fn();
    const item = {
      condition: {
        id: 'web',
        name: 'Webbed',
        icon: 'link' as const,
        kind: 'debuff' as const,
        description: "<strong>Can't See</strong> **Webbed.** Full rules text.",
      },
      sourceName: 'Giant Spider',
    };
    render(
      <CreatureConditionsRow
        items={[item]}
        activeNames={new Set()}
        onApply={onApply}
      />
    );
    const summary = screen.getByText(/Can't See/);
    expect(summary).toHaveClass('line-clamp-1');
    expect(summary).not.toHaveTextContent(/<|\*\*/);
    screen
      .getByRole('button', { name: 'Apply Webbed (from Giant Spider)' })
      .click();
    expect(onApply).toHaveBeenCalledWith(item);
  });
});
