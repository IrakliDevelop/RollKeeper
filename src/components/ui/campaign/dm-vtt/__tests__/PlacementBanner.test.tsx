import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlacementBanner } from '@/components/ui/campaign/dm-vtt/PlacementBanner';

afterEach(() => cleanup());

describe('PlacementBanner', () => {
  it('asks for a spot and cancels', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PlacementBanner entityName="Goblin" onCancel={onCancel} />);

    expect(
      screen.getByText('Choose a spot on the map for Goblin')
    ).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveAttribute('data-variant', 'ghost');

    await user.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
