import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlayerLocationView from './PlayerLocationView';

vi.mock('@/hooks/useLocationSync', () => ({
  useLocationSync: () => ({
    locations: [{ id: 'ruins', name: 'Ruins', mapImageUrl: '/ruins.png' }],
    loading: false,
    fetchLocationState: async () => ({ mapImageUrl: '/ruins.png' }),
  }),
}));

afterEach(() => vi.clearAllMocks());

describe('PlayerLocationView', () => {
  it('zooms with the wheel after the map dialog opens', async () => {
    render(<PlayerLocationView characterId="hero" campaignCode="camp" />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Expand map of Ruins' })
    );

    const dialog = screen.getByRole('dialog', { name: 'Ruins' });
    const container = dialog.querySelector<HTMLElement>('.cursor-grab');
    expect(container).not.toBeNull();
    fireEvent.wheel(container!, { deltaY: -100 });
    await waitFor(() =>
      expect(container!.firstElementChild).toHaveStyle({
        transform: 'translate(0px, 0px) scale(1.1)',
      })
    );
  });
});
