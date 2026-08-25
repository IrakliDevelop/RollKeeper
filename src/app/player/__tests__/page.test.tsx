import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';

import { expectCloudProductVocabulary } from '@/test/helpers';

import PlayerDashboardPage from '../page';

describe('PlayerDashboardPage', () => {
  it('renders the "Full browser recovery" heading with R17-clean product vocabulary', async () => {
    const { container } = render(<PlayerDashboardPage />);
    await screen.findByRole('heading', { name: /full browser recovery/i });
    expectCloudProductVocabulary(container);
  });
});
