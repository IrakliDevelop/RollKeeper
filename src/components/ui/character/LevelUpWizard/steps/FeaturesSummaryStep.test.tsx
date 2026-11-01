import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FeaturesSummaryStep from './FeaturesSummaryStep';

afterEach(cleanup);

describe('FeaturesSummaryStep', () => {
  it('shows a feature without details as plain text, not a disabled control', () => {
    render(
      <FeaturesSummaryStep
        className="Fighter"
        newLevel={2}
        features={[
          {
            name: 'Action Surge',
            level: 2,
            source: 'PHB',
            isSubclassFeature: false,
            original: '',
          },
        ]}
        subclassFeatures={[]}
        subclassSpellGrants={[]}
        featureChoices={{}}
        onFeatureChoiceChange={vi.fn()}
      />
    );
    expect(screen.getByText('Action Surge')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Action Surge/ })
    ).not.toBeInTheDocument();
  });
});
