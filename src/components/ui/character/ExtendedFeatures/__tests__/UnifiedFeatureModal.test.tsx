import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import UnifiedFeatureModal from '@/components/ui/character/ExtendedFeatures/UnifiedFeatureModal';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState, ExtendedFeature } from '@/types/character';

vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({ spells: [], loading: false }),
}));
vi.mock('@/hooks/useFeatureSourcesData', () => ({
  useFeatureSourcesData: () => ({
    allFeatures: [],
    loading: false,
    filterBySourceType: () => [],
    filterByClass: () => [],
    filterBySubclass: () => [],
  }),
}));

function featureWith(description: string): ExtendedFeature {
  return {
    id: 'feat-1',
    name: 'Cursed Gift',
    description,
    maxUses: 0,
    usedUses: 0,
    restType: 'long',
    sourceType: 'other',
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as ExtendedFeature;
}

function renderView(description: string) {
  render(
    <UnifiedFeatureModal
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      existingFeatures={[]}
      feature={featureWith(description)}
      character={DEFAULT_CHARACTER_STATE as unknown as CharacterState}
      readonly
    />
  );
  return screen.getByRole('dialog');
}

describe('UnifiedFeatureModal view', () => {
  afterEach(cleanup);

  it('keeps description formatting', () => {
    const dialog = renderView(
      '<p><strong>Once</strong> per day, cast <span class="font-medium underline decoration-dotted underline-offset-2" title="Bless (PHB)">Bless</span>.</p>'
    );
    expect(dialog.querySelector('strong')).toHaveTextContent('Once');
    expect(screen.getByText('Bless')).toHaveAttribute('title', 'Bless (PHB)');
  });

  it('renders a hostile description as inert text', () => {
    const dialog = renderView(
      '<p onmouseover="alert(1)">Gift</p><img src=x onerror="alert(2)"><script>alert(3)</script><a href="javascript:alert(4)">link</a>'
    );
    expect(screen.getByText('Gift')).not.toHaveAttribute('onmouseover');
    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog.querySelector('script')).toBeNull();
    expect(screen.getByText('link')).not.toHaveAttribute('href');
  });
});
