import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/campaign/table/workspace', () => ({
  TableWorkspace: (props: { campaignCode: string }) => (
    <div data-testid="workspace">{props.campaignCode}</div>
  ),
}));

import TableWorkspacePage from './page';

describe('W1 canonical /table route', () => {
  it('awaits params and renders the client workspace for the campaign', async () => {
    const element = await TableWorkspacePage({
      params: Promise.resolve({ code: 'CAMP' }),
    });
    render(element);
    expect(screen.getByTestId('workspace')).toHaveTextContent('CAMP');
  });
});
