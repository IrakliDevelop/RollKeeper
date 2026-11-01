import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import ASIFeatStep from './ASIFeatStep';

vi.mock('@/hooks/useFeatsData', () => ({
  useFeatsData: () => ({
    loading: false,
    feats: Array.from({ length: 51 }, (_, index) => ({
      id: `feat-${index + 1}`,
      name: `Feat ${index + 1}`,
      source: 'PHB',
      description: '',
      prerequisites: [],
    })),
  }),
}));

afterEach(cleanup);

describe('ASIFeatStep', () => {
  it('keeps feats after the fiftieth result available', () => {
    render(
      <ASIFeatStep
        abilities={DEFAULT_CHARACTER_STATE.abilities}
        asiChoice={undefined}
        onChoiceChange={vi.fn()}
        allSpells={[]}
        spellsLoading={false}
        newTotalLevel={4}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Take a feat' }));
    expect(screen.getByText('Feat 51')).toBeInTheDocument();
  });

  it('matches feats when the search has surrounding spaces', () => {
    render(
      <ASIFeatStep
        abilities={DEFAULT_CHARACTER_STATE.abilities}
        asiChoice={undefined}
        onChoiceChange={vi.fn()}
        allSpells={[]}
        spellsLoading={false}
        newTotalLevel={4}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Take a feat' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search feats' }), {
      target: { value: ' feat 51 ' },
    });
    expect(screen.getByText('Feat 51')).toBeInTheDocument();
    expect(screen.queryByText('Feat 2')).toBeNull();
  });
});
